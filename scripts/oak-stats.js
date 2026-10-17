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

const DATA_FILE = "data/oak/science-secondary.json";
const DONE_FILE = "data/oak-done.json";
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

// ---------- load + filter Oak data ----------
const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const unitCats = new Map<string, string>();
for (const u of data.sequence as OakUnit[]) {
  const c = u.categories?.[0]?.categorySlug;
  if (c && !unitCats.has(u.unitSlug)) unitCats.set(u.unitSlug, c);
}

function categoryOf(l: OakLesson): string | null {
  if (SCIENCES.includes(l.subjectSlug)) return l.subjectSlug;
  const c = unitCats.get(l.unitSlug);
  return c && SCIENCES.includes(c) ? c : null;
}
const levelOf = (l: OakLesson): Level | null =>
  l.keyStageSlug === "ks3" ? "JSS" : l.keyStageSlug === "ks4" ? "SS" : null;

function eligible(lv: Level, cat: string, dedupe: boolean): OakLesson[] {
  const seen = new Set<string>();
  const out: OakLesson[] = [];
  for (const l of data.lessons as OakLesson[]) {
    if (l.restricted || !l.keyLearningPoints?.length) continue;
    if (levelOf(l) !== lv || categoryOf(l) !== cat) continue;
    if (dedupe) {
      const key = norm(l.lessonTitle);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(l);
  }
  return out;
}

// ---------- dry run: show what's available ----------
if (dry) {
  console.log("Usable lessons (not restricted, have key learning points):");
  for (const lv of ["JSS", "SS"] as Level[]) {
    for (const cat of SCIENCES) {
      const raw = eligible(lv, cat, false).length;
      const uniq = eligible(lv, cat, true).length;
      console.log(`  ${lv} ${cat}: ${uniq} unique lessons (${raw} before removing same-title duplicates)`);
    }
  }
  process.exit(0);
}

if ((level !== "JSS" && level !== "SS") || !SCIENCES.includes(category)) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/generate-from-oak.ts <JSS|SS> <biology|chemistry|physics> [--limit N]");
  console.error("       npx tsx scripts/generate-from-oak.ts --dry");
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VERIFIER_MODEL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !GEMINI_MODEL) {
  throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL");
}
const GENERATOR = GEMINI_MODEL;
const VERIFIER = GEMINI_VERIFIER_MODEL ?? GEMINI_MODEL;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function gemini(model: string, prompt: string, temperature: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: "application/json" },
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const body: any = await res.json();
    return body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error("Gemini: retries exhausted");
}

function isValid(g: any): g is Gen {
  if (!g || typeof g.stem !== "string" || g.stem.trim().length < 10) return false;
  // questions must stand alone: no references to the source lesson
  if (/\b(lesson|transcript|video|the teacher|the speaker|the passage|the text)\b/i.test(g.stem)) return false;
  if (!Array.isArray(g.options) || g.options.length !== 4) return false;
  const ids = g.options.map((o: any) => o?.id);
  const texts = g.options.map((o: any) => norm(String(o?.text ?? "")));
  if (new Set(ids).size !== 4 || new Set(texts).size !== 4) return false;
  if (texts.some((t: string) => !t)) return false;
  return ids.includes(g.correct);
}

function generationPrompt(l: OakLesson): string {
  const kl = l.keyLearningPoints!.map((k) => `- ${k.keyLearningPoint}`).join("\n");
  const kw = (l.lessonKeywords ?? []).map((k) => `- ${k.keyword}: ${k.description}`).join("\n");
  const mc = (l.misconceptionsAndCommonMistakes ?? [])
    .map((m) => `- Misconception: ${m.misconception} | Correct idea: ${m.response}`)
    .join("\n");
  const tr = (l.transcript_sentences ?? "").slice(0, 6000);
  return `You write multiple-choice science questions for secondary school pupils in a British-curriculum school in Nigeria.
Level: ${level === "JSS" ? "junior secondary (ages 11-14)" : "senior secondary (ages 14-17)"}. Subject: ${category}. Unit: ${l.unitTitle}. Lesson topic: ${l.lessonTitle}.

SOURCE MATERIAL (base every question ONLY on facts stated here):
Key learning points:
${kl}
Keywords:
${kw || "(none)"}
Common misconceptions:
${mc || "(none)"}
Lesson transcript (may be partial):
${tr || "(none)"}

Write 4 questions with difficulties 1 (recall), 2, 2 (understanding), 3 (application). Rules:
- Exactly 4 options, one unambiguously correct. Use the misconceptions above to make plausible wrong options.
- Each question must make sense on its own. Never mention "the lesson", "the video", "the transcript" or "the teacher".
- No "all of the above" / "none of the above". Do not test the same fact twice.
- One-sentence explanation of why the answer is correct.
Return ONLY a JSON array: [{"difficulty":1,"stem":"","options":[{"id":"a","text":""},{"id":"b","text":""},{"id":"c","text":""},{"id":"d","text":""}],"correct":"a","explanation":""}]`;
}

function verifyPrompt(items: Gen[]): string {
  const body = items
    .map((q, i) => `Q${i}: ${q.stem}\n` + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n"))
    .join("\n\n");
  return `Answer each ${category} multiple-choice question below with the single best option.
${body}

Return ONLY a JSON array: [{"i":0,"answer":"a"}, ...] with one entry per question.`;
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
  const todo = eligible(level, category, true).filter((l) => !doneSet.has(l.lessonSlug)).slice(0, LIMIT);
  console.log(`${level} ${category}: processing ${todo.length} lessons (limit ${LIMIT})`);

  const rows = await fetchAll((a, b) =>
    db.from("questions").select("stem").eq("subject", category).eq("level", level).range(a, b),
  );
  const seen = new Set<string>(rows.map((r) => norm(r.stem)));
  const totals = { generated: 0, invalid: 0, duplicate: 0, rejected: 0, saved: 0 };

  for (const l of todo) {
    try {
      const raw = await gemini(GENERATOR, generationPrompt(l), 0.7);
      await sleep(PAUSE_MS);
      const parsed = parseJson<unknown[]>(raw);
      if (!Array.isArray(parsed)) { console.warn(`  ! unparseable: ${l.lessonTitle}`); done.push(l.lessonSlug); continue; }
      totals.generated += parsed.length;

      const candidates: { q: Gen; correctId: string; difficulty: number }[] = [];
      for (const g of parsed) {
        if (!isValid(g)) { totals.invalid++; continue; }
        if (seen.has(norm(g.stem))) { totals.duplicate++; continue; }
        const correctText = g.options.find((o) => o.id === g.correct)!.text;
        const options = shuffle(g.options.map((o) => o.text)).map((text, i) => ({ id: "abcd"[i], text }));
        const correctId = options.find((o) => o.text === correctText)!.id;
        const difficulty = Math.min(3, Math.max(1, Math.round(Number(g.difficulty) || 2)));
        candidates.push({ q: { ...g, options, correct: correctId }, correctId, difficulty });
      }

      if (candidates.length) {
        const vraw = await gemini(VERIFIER, verifyPrompt(candidates.map((c) => c.q)), 0);
        await sleep(PAUSE_MS);
        const answers = parseJson<{ i: number; answer: string }[]>(vraw) ?? [];
        const answerOf = new Map(answers.map((a) => [a.i, a.answer]));

        for (let i = 0; i < candidates.length; i++) {
          const { q, correctId, difficulty } = candidates[i];
          if (answerOf.get(i) !== correctId) { totals.rejected++; continue; }
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
          seen.add(norm(q.stem));
          totals.saved++;
        }
      }
      console.log(`done: ${l.lessonTitle} (saved so far: ${totals.saved})`);
    } catch (e) {
      console.error(`  ! error on ${l.lessonSlug} (will retry next run):`, (e as Error).message);
      continue;
    }
    done.push(l.lessonSlug);
    writeFileSync(DONE_FILE, JSON.stringify(done));
  }

  const rej = totals.generated ? ((totals.rejected / totals.generated) * 100).toFixed(1) : "0";
  console.log("\nSummary", totals, `| verifier rejection rate: ${rej}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});