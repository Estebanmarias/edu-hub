/**
 * Generate MCQs from Oak lessons (key learning points, keywords, misconceptions, transcript),
 * blind-verify them, and load them into Supabase as status 'verified'.
 *
 * Usage (run from the project root):
 *   npx tsx scripts/generate-from-oak.ts --dry
 *   npx tsx --env-file=.env.local scripts/generate-from-oak.ts JSS biology --limit 10
 *   npx tsx --env-file=.env.local scripts/generate-from-oak.ts SS physics --limit 20
 *
 * Levels: JSS (Oak KS3) | SS (Oak KS4). Subjects: biology | chemistry | physics.
 * Lessons already attempted are remembered in data/oak-done.json, so re-running continues
 * where the last run stopped.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Level = "JSS" | "SS";
type OakLesson = {
  lessonTitle: string;
  lessonSlug: string;
  unitSlug: string;
  unitTitle: string;
  subjectSlug: string;
  keyStageSlug: string;
  restricted?: boolean;
  lessonKeywords?: { keyword: string; description: string }[];
  keyLearningPoints?: { keyLearningPoint: string }[];
  misconceptionsAndCommonMistakes?: { misconception: string; response: string }[];
  pupilLessonOutcome?: string;
  transcript_sentences?: string | null;
};
type OakUnit = { unitSlug: string; categories?: { categorySlug: string }[] };
type Gen = {
  stem: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation?: string;
  difficulty?: number;
};


const DONE_FILE = "data/oak-done.json";
const CACHE_FILE = "data/oak-gen-cache.json";
const SCIENCES = ["biology", "chemistry", "physics"];
const PAUSE_MS = 4000; // stay under free-tier per-minute limits

// ---------- args ----------
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 20;
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");
const level = (positional[0] ?? "").toUpperCase() as Level;
const category = (positional[1] ?? "").toLowerCase();

// ---------- helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return null;
  }
}

// ---------- which Oak file feeds which of our subjects ----------
type SubjectSource = { file: string; science?: string };
const SUBJECTS: Record<string, SubjectSource> = {
  biology: { file: "data/oak/science-secondary.json", science: "biology" },
  chemistry: { file: "data/oak/science-secondary.json", science: "chemistry" },
  physics: { file: "data/oak/science-secondary.json", science: "physics" },
  math: { file: "data/oak/maths-secondary.json" },
};
const SUBJECT_NAMES: Record<string, string> = { math: "mathematics" };
const subjectName = SUBJECT_NAMES[category] ?? category;

type OakData = { lessons: OakLesson[]; unitCats: Map<string, string> };
const loaded = new Map<string, OakData | null>();
function loadData(file: string): OakData | null {
  if (loaded.has(file)) return loaded.get(file)!;
  let out: OakData | null = null;
  if (existsSync(file)) {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const unitCats = new Map<string, string>();
    for (const u of (raw.sequence ?? []) as OakUnit[]) {
      const c = u.categories?.[0]?.categorySlug;
      if (c && !unitCats.has(u.unitSlug)) unitCats.set(u.unitSlug, c);
    }
    out = { lessons: raw.lessons as OakLesson[], unitCats };
  }
  loaded.set(file, out);
  return out;
}

// In the science file, KS3 lessons are plain "science"; the unit says whether it is biology, chemistry or physics
function scienceOf(l: OakLesson, data: OakData): string | null {
  if (SCIENCES.includes(l.subjectSlug)) return l.subjectSlug;
  const c = data.unitCats.get(l.unitSlug);
  return c && SCIENCES.includes(c) ? c : null;
}
const levelOf = (l: OakLesson): Level | null =>
  l.keyStageSlug === "ks3" ? "JSS" : l.keyStageSlug === "ks4" ? "SS" : null;

function eligible(lv: Level, subject: string, dedupe: boolean): OakLesson[] {
  const src = SUBJECTS[subject];
  const data = src ? loadData(src.file) : null;
  if (!src || !data) return [];
  const seen = new Set<string>();
  const out: OakLesson[] = [];
  for (const l of data.lessons) {
    if (l.restricted || !l.keyLearningPoints?.length) continue;
    if (levelOf(l) !== lv) continue;
    if (src.science && scienceOf(l, data) !== src.science) continue;
    if (dedupe) {
      const key = norm(l.lessonTitle);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(l);
  }
  if (!dedupe) return out;
  // Spread across units: one lesson from each unit in turn, so early batches cover the whole syllabus
  const byUnit = new Map<string, OakLesson[]>();
  for (const l of out) byUnit.set(l.unitSlug, [...(byUnit.get(l.unitSlug) ?? []), l]);
  const queues = [...byUnit.values()];
  const spread: OakLesson[] = [];
  for (let round = 0; spread.length < out.length; round++) {
    for (const q of queues) if (q[round]) spread.push(q[round]);
  }
  return spread;
}

// ---------- dry run: show what's available ----------
if (dry) {
  console.log("Usable lessons (not restricted, have key learning points):");
  for (const subject of Object.keys(SUBJECTS)) {
    if (!loadData(SUBJECTS[subject].file)) {
      console.log(`  ${subject}: ${SUBJECTS[subject].file} not found`);
      continue;
    }
    for (const lv of ["JSS", "SS"] as Level[]) {
      const raw = eligible(lv, subject, false).length;
      const uniq = eligible(lv, subject, true).length;
      console.log(`  ${lv} ${subject}: ${uniq} unique lessons (${raw} before removing same-title duplicates)`);
    }
  }
  process.exit(0);
}

if ((level !== "JSS" && level !== "SS") || !SUBJECTS[category]) {
  console.error(`Usage: npx tsx --env-file=.env.local scripts/generate-from-oak.ts <JSS|SS> <${Object.keys(SUBJECTS).join("|")}> [--limit N]`);
  console.error("       npx tsx scripts/generate-from-oak.ts --dry");
  process.exit(1);
}
if (!loadData(SUBJECTS[category].file)) {
  console.error(`Missing ${SUBJECTS[category].file}. Download it from the Oak bulk download page first.`);
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VERIFIER_MODEL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !GEMINI_MODEL) {
  throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL");
}
// Free-tier quotas are per model, so each variable may hold a comma-separated list of models.
// When one model runs out of quota (or is retired), the script moves on to the next one.
const parseModels = (v?: string) => (v ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const GEN_MODELS = parseModels(GEMINI_MODEL);
const VER_MODELS = parseModels(GEMINI_VERIFIER_MODEL).length ? parseModels(GEMINI_VERIFIER_MODEL) : GEN_MODELS;
const GEN_BATCH = 3; // lessons per generation call
const VERIFY_BATCH = 5; // lessons per verification call
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

class DailyQuotaError extends Error {}
class ModelGoneError extends Error {}

async function gemini(model: string, prompt: string, temperature: number, maxAttempts = 6): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let lastMsg = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY! },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, responseMimeType: "application/json" },
        }),
      });
    } catch (e) {
      lastMsg = `network error: ${(e as Error).message}`;
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const text = await res.text();
      lastMsg = `${model} HTTP ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 400)}`;
      if (res.status === 429 && /perday|per day|daily/i.test(text)) {
        throw new DailyQuotaError(lastMsg);
      }
      const m = text.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
      const waitMs = m ? Math.min(120000, Number(m[1]) * 1000 + 1000) : Math.min(120000, 5000 * 2 ** attempt);
      console.warn(`  ... ${model} busy (HTTP ${res.status}), waiting ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }
    if (res.status === 404) throw new ModelGoneError(`${model} is not available to this key`);
    if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const body: any = await res.json();
    return body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error(`retries exhausted. Last response: ${lastMsg}`);
}

const deadModels = new Set<string>();
const preferred = new Map<string, string>(); // per model list: the model that worked last, tried first next time
async function callPool(models: string[], prompt: string, temperature: number): Promise<string> {
  const key = models.join(",");
  const first = preferred.get(key);
  const order = first && models.includes(first) ? [first, ...models.filter((m) => m !== first)] : models;
  let lastErr: Error | null = null;
  for (const m of order) {
    if (deadModels.has(m)) continue;
    const othersLeft = order.some((x) => x !== m && !deadModels.has(x));
    try {
      // if another model is available, give up on a busy one sooner (3 tries) instead of waiting minutes
      const out = await gemini(m, prompt, temperature, othersLeft ? 3 : 6);
      preferred.set(key, m);
      return out;
    } catch (e) {
      if (e instanceof DailyQuotaError) { deadModels.add(m); console.warn(`  ! ${m}: daily quota used up, trying the next model`); continue; }
      if (e instanceof ModelGoneError) { deadModels.add(m); console.warn(`  ! ${m}: not available, skipping it`); continue; }
      lastErr = e as Error; // overloaded etc: try the next model, but don't mark this one dead
    }
  }
  if (lastErr) throw lastErr;
  throw new DailyQuotaError("every model in the list is out of quota or unavailable");
}

// Phrases that mean a question points at its source material or at something the pupil can't see.
const LEAK =
  /\b(lessons?|transcript|video|teacher|speaker|passage|source material|the source|the facts|key (concepts?|points?|learning)|misconceptions?|according to the|the (diagram|figure|graph|image|picture)|shown (above|below)|scientific facts|based on key|these specific|the specified|the above)\b/i;

function isValid(g: any): g is Gen {
  if (!g || typeof g.stem !== "string" || g.stem.trim().length < 10) return false;
  if (LEAK.test(g.stem)) return false;
  if (!Array.isArray(g.options) || g.options.length !== 4) return false;
  const ids = g.options.map((o: any) => o?.id);
  const texts = g.options.map((o: any) => norm(String(o?.text ?? "")));
  if (new Set(ids).size !== 4 || new Set(texts).size !== 4) return false;
  if (texts.some((t: string) => !t)) return false;
  if (!ids.includes(g.correct)) return false;
  // reject "longest option is the answer" giveaways
  const lens: number[] = g.options.map((o: any) => String(o.text).length);
  const ci = ids.indexOf(g.correct);
  const others = lens.filter((_, i) => i !== ci);
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  if (lens[ci] > Math.max(...others) && lens[ci] > 1.3 * mean) return false;
  return true;
}

// Near-duplicate detection: stems that share most of their meaningful words.
const STOP = new Set(["the","what","which","following","are","was","were","and","that","this","these","those","for","with","how","why","does","did","from","into","not","can","will","their","its","has","have","best","correct","most","about","when","where","who","whom","describes","statement"]);
const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
function tooSimilar(a: Set<string>, b: Set<string>): boolean {
  const min = Math.min(a.size, b.size);
  if (min < 2) return false;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / min >= 0.8;
}

function sectionText(l: OakLesson, n: number, trChars: number): string {
  const kl = l.keyLearningPoints!.map((k) => `- ${k.keyLearningPoint}`).join("\n");
  const kw = (l.lessonKeywords ?? []).map((k) => `- ${k.keyword}: ${k.description}`).join("\n");
  const mc = (l.misconceptionsAndCommonMistakes ?? [])
    .map((m) => `- Misconception: ${m.misconception} | Correct idea: ${m.response}`)
    .join("\n");
  const tr = (l.transcript_sentences ?? "").slice(0, trChars);
  return `SECTION ${n} (unit: ${l.unitTitle}; topic: ${l.lessonTitle})
Key learning points:
${kl}
Keywords:
${kw || "(none)"}
Common misconceptions:
${mc || "(none)"}
Transcript (may be partial):
${tr || "(none)"}`;
}

const subjectRules =
  category === "math"
    ? `
- Write maths in plain text: x^2, sqrt(16), fractions like 3/4. No LaTeX and no symbols that need special rendering.
- You may choose your own numbers, but only for the skills and methods in the section. Every question has ONE exact answer: work it out carefully before writing the options. Wrong options must be the results of common errors (wrong sign, wrong operation, forgetting to square, rounding too early), not random numbers.
- A question must never depend on a picture, graph, table of data or shape that is not fully described in words inside the question. If a topic is mostly visual, ask about its rules and calculations instead.`
    : "";

function generationPrompt(group: OakLesson[]): string {
  const sections = group.map((l, i) => sectionText(l, i + 1, group.length > 1 ? 4000 : 6000)).join("\n\n");
  return `You write multiple-choice ${subjectName} questions for secondary school pupils in a British-curriculum school in Nigeria.
Level: ${level === "JSS" ? "junior secondary (ages 11-14)" : "senior secondary (ages 14-17)"}. Subject: ${category}.

SOURCE MATERIAL. Base every question ONLY on facts stated in its own section:

${sections}

For EACH section write 4 questions about 4 DIFFERENT facts, with difficulties 1, 2, 2, 3. Rules:
- Difficulty 1 = recall one fact. Difficulty 2 = explain or apply one idea. Difficulty 3 = a short scenario that needs two ideas combined. Never label simple recall as 3.
- Exactly 4 options, one clearly correct. Wrong options must be definitely wrong, never partly correct. For "why" questions, no wrong option may be a valid reason.
- Every wrong option must be something a real pupil might plausibly believe. No absurd options. No two options may overlap in meaning (for example "black" and "blue/black").
- Test ONE idea per question. Do not combine two claims in a stem or in an option. A difficulty 3 question is a short scenario about one idea, not a stack of claims.
- Never use phrases like "these organs", "the specified items" or "the above". Name what you are asking about.
- Use the misconceptions ONLY to build plausible wrong options. Never write a question that asks about the misconception itself.
- All four options must be similar in length and detail. The correct answer must not be the longest or most carefully worded option.
- Each question must make sense completely on its own. Never refer to "the lesson", "the video", "the transcript", "the source", "the facts", "key concepts", "the material", or any diagram, graph or image.
- Use British spelling (oesophagus, haemoglobin, colour, litre).
- No "all of the above" / "none of the above". Do not ask for a definition and then the same definition again.
- One-sentence explanation of why the answer is correct.${subjectRules}
Return ONLY a JSON array containing the questions from every section: [{"section":1,"difficulty":1,"stem":"","options":[{"id":"a","text":""},{"id":"b","text":""},{"id":"c","text":""},{"id":"d","text":""}],"correct":"a","explanation":""}]`;
}

function verifyPrompt(items: Gen[], existingStems: string[]): string {
  const body = items
    .map((q, i) => `Q${i}: ${q.stem}\n` + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n"))
    .join("\n\n");
  const existing = existingStems.length
    ? `\nEXISTING QUESTIONS ALREADY IN THE BANK:\n${existingStems.map((e) => `- ${e}`).join("\n")}\n`
    : "";
  const mathNote =
    category === "math" ? 'Work out each question step by step before choosing, and put a line of working in "working".\n' : "";
  const shape =
    category === "math"
      ? '[{"i":0,"answer":"a","working":"","ambiguous":false,"duplicate":false}, ...]'
      : '[{"i":0,"answer":"a","ambiguous":false,"duplicate":false}, ...]';
  return `You are checking draft ${subjectName} multiple-choice questions for secondary school pupils.
For each draft question decide:
1. "answer": the single best option.
2. "ambiguous": true if more than one option could reasonably be defended as correct, or the wording is unclear or refers to something not shown.
3. "duplicate": true if it tests essentially the same fact as an EXISTING QUESTION below, or as an earlier draft in this list (different wording of the same fact still counts).
${existing}
DRAFT QUESTIONS:
${body}

${mathNote}Return ONLY a JSON array: ${shape} with one entry per draft question.`;
}

async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(rows ?? []));
    if (!rows || rows.length < 1000) break;
  }
  return out;
}

async function main() {
  const done: string[] = existsSync(DONE_FILE) ? JSON.parse(readFileSync(DONE_FILE, "utf8")) : [];
  const doneSet = new Set(done);
  const cache: Record<string, any[]> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
  const todo = eligible(level, category, true).filter((l) => !doneSet.has(l.lessonSlug)).slice(0, LIMIT);
  console.log(`${level} ${category}: ${todo.length} lessons (limit ${LIMIT})`);
  console.log(`  generate with: ${GEN_MODELS.join(", ")}\n  verify with:   ${VER_MODELS.join(", ")}`);

  const rows = await fetchAll((a, b) =>
    db.from("questions").select("stem").eq("subject", category).eq("level", level).range(a, b),
  );
  const existing: { stem: string; tok: Set<string> }[] = rows.map((r) => ({ stem: r.stem as string, tok: tokens(r.stem) }));
  const totals = { generated: 0, invalid: 0, duplicate: 0, ambiguous: 0, rejected: 0, saved: 0 };

  // ---- Stage 1: generate (several lessons per call), cache the results ----
  const needGen = todo.filter((l) => !cache[l.lessonSlug]);
  for (let i = 0; i < needGen.length; i += GEN_BATCH) {
    const group = needGen.slice(i, i + GEN_BATCH);
    try {
      const raw = await callPool(GEN_MODELS, generationPrompt(group), 0.7);
      await sleep(PAUSE_MS);
      const parsed = parseJson<any[]>(raw);
      if (!Array.isArray(parsed)) { console.warn("  ! unparseable generation (will retry next run)"); continue; }
      let ok = 0;
      group.forEach((l, idx) => {
        const qs = parsed.filter((g) => Number(g?.section) === idx + 1);
        if (qs.length) { cache[l.lessonSlug] = qs; ok++; }
      });
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      console.log(`generated ${ok}/${group.length}: ${group.map((l) => l.lessonTitle).join("; ")}`);
    } catch (e) {
      if (e instanceof DailyQuotaError) { console.error(`\nGeneration stopped: ${(e as Error).message}`); break; }
      console.error("  ! generation error (will retry next run):", (e as Error).message);
    }
  }

  // ---- Stage 2: check + save (several lessons per call) ----
  const ready = todo.filter((l) => cache[l.lessonSlug]?.length);
  for (let i = 0; i < ready.length; i += VERIFY_BATCH) {
    const group = ready.slice(i, i + VERIFY_BATCH);
    try {
      const candidates: { l: OakLesson; q: Gen; correctId: string; difficulty: number }[] = [];
      const batchTok: Set<string>[] = [];
      for (const l of group) {
        for (const g of cache[l.lessonSlug]) {
          totals.generated++;
          if (!isValid(g)) { totals.invalid++; continue; }
          const tk = tokens(g.stem);
          if (existing.some((e) => tooSimilar(e.tok, tk)) || batchTok.some((t) => tooSimilar(t, tk))) { totals.duplicate++; continue; }
          batchTok.push(tk);
          const correctText = g.options.find((o: any) => o.id === g.correct)!.text;
          const options = shuffle<string>(g.options.map((o: any) => o.text)).map((text, k) => ({ id: "abcd"[k], text }));
          const correctId = options.find((o) => o.text === correctText)!.id;
          const difficulty = Math.min(3, Math.max(1, Math.round(Number(g.difficulty) || 2)));
          candidates.push({ l, q: { ...g, options, correct: correctId }, correctId, difficulty });
        }
      }

      if (candidates.length) {
        // existing questions most likely to overlap, so the checker can judge paraphrased duplicates
        const union = new Set<string>();
        for (const t of batchTok) for (const w of t) union.add(w);
        const nearby = existing
          .map((e) => ({ stem: e.stem, score: [...e.tok].filter((w) => union.has(w)).length }))
          .filter((e) => e.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 40)
          .map((e) => e.stem);
        const vraw = await callPool(VER_MODELS, verifyPrompt(candidates.map((c) => c.q), nearby), 0);
        await sleep(PAUSE_MS);
        const verdicts = parseJson<{ i: number; answer: string; ambiguous?: boolean; duplicate?: boolean }[]>(vraw);
        if (!Array.isArray(verdicts)) throw new Error("unparseable verification response");
        const verdictOf = new Map(verdicts.map((v) => [v.i, v]));

        for (let k = 0; k < candidates.length; k++) {
          const { l, q, correctId, difficulty } = candidates[k];
          const v = verdictOf.get(k);
          if (!v || v.answer !== correctId) { totals.rejected++; continue; }
          if (v.ambiguous === true) { totals.ambiguous++; continue; }
          if (v.duplicate === true) { totals.duplicate++; continue; }
          const { data: row, error: qErr } = await db
            .from("questions")
            .insert({
              subject: category,
              topic: l.unitTitle,
              level,
              curriculum: level === "JSS" ? "uk-ks3" : "uk-ks4",
              difficulty,
              stem: q.stem.trim(),
              options: q.options,
              explanation: q.explanation ?? null,
              source: "oak",
              source_ref: `oak:${l.lessonSlug}`,
              status: "verified",
            })
            .select("id")
            .single();
          if (qErr || !row) { console.warn("  ! insert failed:", qErr?.message); continue; }
          const { error: aErr } = await db
            .from("question_answers")
            .insert({ question_id: row.id, correct_option: correctId });
          if (aErr) { await db.from("questions").delete().eq("id", row.id); console.warn("  ! answer insert failed:", aErr.message); continue; }
          existing.push({ stem: q.stem.trim(), tok: tokens(q.stem) });
          totals.saved++;
        }
      }
      for (const l of group) { delete cache[l.lessonSlug]; done.push(l.lessonSlug); }
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      writeFileSync(DONE_FILE, JSON.stringify(done));
      console.log(`checked ${group.length} lessons (saved so far: ${totals.saved})`);
    } catch (e) {
      if (e instanceof DailyQuotaError) {
        console.error(`\nChecking stopped: ${(e as Error).message}\nGenerated questions are cached. Run again later.`);
        break;
      }
      console.error("  ! checking error (will retry next run):", (e as Error).message);
    }
  }

  const rej = totals.generated ? ((totals.rejected / totals.generated) * 100).toFixed(1) : "0";
  console.log("\nSummary", totals, `| verifier rejection rate: ${rej}%`);
  if (deadModels.size) console.log("Models out of quota / unavailable this run:", [...deadModels].join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});