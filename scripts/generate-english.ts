/**
 * Generate original English-language MCQs from a topic list (no source text needed),
 * blind-check them with a second model, and load them into Supabase as status 'verified'.
 *
 * Usage (run from the project root):
 *   npx tsx scripts/generate-english.ts --dry
 *   npx tsx --env-file=.env.local scripts/generate-english.ts JSS --limit 6
 *   npx tsx --env-file=.env.local scripts/generate-english.ts SS --limit 6 --pass 2
 *
 * --limit N : how many topics to process this run (2 topics = 1 generation call)
 * --pass N  : round N over the topic list. Pass 1 writes 8 questions per topic; later passes
 *             write 8 more per topic and are told not to repeat what is already in the bank.
 * Progress is remembered in data/english-done.json, so re-running continues where it stopped.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Level = "JSS" | "SS";
type Topic = { topic: string; focus: string };
type Gen = {
  stem: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation?: string;
  difficulty?: number;
};

const TOPICS: Record<Level, Topic[]> = {
  JSS: [
    { topic: "Nouns: common, proper, abstract and collective", focus: "classifying the nouns in a sentence" },
    { topic: "Pronouns: personal, possessive, reflexive and relative", focus: "choosing the correct pronoun" },
    { topic: "Verbs: action, linking, auxiliary and modal", focus: "identifying and using verb types" },
    { topic: "Simple tenses: present, past and future", focus: "choosing the correct tense form" },
    { topic: "Continuous and perfect tenses", focus: "forming and recognising these tenses" },
    { topic: "Adjectives and comparison", focus: "comparative and superlative forms, adjective order" },
    { topic: "Adverbs: manner, time, place and frequency", focus: "identifying and placing adverbs" },
    { topic: "Prepositions of time, place and direction", focus: "choosing the correct preposition" },
    { topic: "Conjunctions and linking words", focus: "joining ideas with the right connective" },
    { topic: "Articles and determiners", focus: "a, an, the, some, any, much, many, few, little" },
    { topic: "Subject-verb agreement", focus: "making the verb agree with its subject" },
    { topic: "Sentence types: statement, question, command, exclamation", focus: "recognising purpose and punctuation" },
    { topic: "Simple, compound and complex sentences", focus: "identifying sentence structure" },
    { topic: "Phrases and clauses", focus: "main and subordinate clauses, noun and adverb phrases" },
    { topic: "Active and passive voice", focus: "recognising and changing voice" },
    { topic: "Direct and reported speech", focus: "changing tense, pronouns and time words" },
    { topic: "Full stops, commas and capital letters", focus: "choosing correct punctuation" },
    { topic: "Apostrophes: possession and contraction", focus: "placing the apostrophe correctly" },
    { topic: "Speech marks, colons and semicolons", focus: "punctuating speech and lists" },
    { topic: "Plural nouns and spelling rules", focus: "regular and irregular plurals, i before e, doubling letters" },
    { topic: "Prefixes and suffixes", focus: "word building and changes in meaning" },
    { topic: "Commonly confused words", focus: "their/there/they're, its/it's, to/too/two, your/you're, were/where" },
    { topic: "Homophones and homonyms", focus: "choosing the right word for the meaning" },
    { topic: "Synonyms", focus: "words with the same or similar meaning" },
    { topic: "Antonyms", focus: "words with opposite meaning" },
    { topic: "Vocabulary in context", focus: "working out a word's meaning from a short sentence" },
    { topic: "Idioms and proverbs", focus: "meaning of common English idioms and proverbs" },
    { topic: "Simile, metaphor and personification", focus: "identifying and explaining these devices" },
    { topic: "Alliteration, onomatopoeia and hyperbole", focus: "identifying sound and exaggeration devices" },
    { topic: "Paragraphs and topic sentences", focus: "organising ideas, finding the topic sentence" },
    { topic: "Formal and informal language", focus: "choosing the right register for the situation" },
    { topic: "Letter and email conventions", focus: "layout, greetings, endings and tone" },
    { topic: "Story structure", focus: "opening, build-up, climax, resolution, narrator and viewpoint" },
    { topic: "Fact and opinion", focus: "telling statements of fact from opinion" },
    { topic: "Main idea and simple inference", focus: "short text of 2 to 3 sentences written inside the question" },
    { topic: "Sentence fragments and run-on sentences", focus: "spotting and fixing them" },
  ],
  SS: [
    { topic: "Sentence structure: simple, compound, complex, compound-complex", focus: "identifying and building sentence types" },
    { topic: "Relative clauses and relative pronouns", focus: "who, whom, whose, which, that; defining and non-defining clauses" },
    { topic: "Conditionals and the subjunctive", focus: "zero, first, second, third conditionals, if I were" },
    { topic: "Modal verbs and degrees of certainty", focus: "must, may, might, could, should, ought to" },
    { topic: "Tense consistency", focus: "keeping tenses consistent and sequencing past events" },
    { topic: "Active and passive voice: when and why", focus: "effect on emphasis and tone" },
    { topic: "Direct to reported speech", focus: "tense, pronoun and time-word changes" },
    { topic: "Subject-verb agreement: tricky cases", focus: "collective nouns, either/or, indefinite pronouns, plural-looking singulars" },
    { topic: "Pronoun reference and ambiguity", focus: "unclear antecedents and how to fix them" },
    { topic: "Misplaced and dangling modifiers", focus: "spotting and correcting them" },
    { topic: "Parallel structure", focus: "keeping lists and comparisons grammatically balanced" },
    { topic: "Commas: clauses, lists and non-essential information", focus: "comma rules and comma errors" },
    { topic: "Semicolons, colons and dashes", focus: "choosing the correct mark" },
    { topic: "Apostrophes in difficult cases", focus: "plurals, names ending in s, joint possession" },
    { topic: "Hyphens, brackets and quotation punctuation", focus: "compound adjectives, parenthesis, punctuating quotations" },
    { topic: "Comma splices, run-ons and fragments", focus: "identifying and fixing them" },
    { topic: "Commonly confused words: advanced", focus: "affect/effect, principal/principle, complement/compliment, imply/infer, stationary/stationery" },
    { topic: "Spelling: tricky patterns and word families", focus: "silent letters, doubled consonants, -ible/-able, -ence/-ance" },
    { topic: "Prefixes, suffixes and Latin and Greek roots", focus: "using roots to work out meaning" },
    { topic: "Synonyms, antonyms and shades of meaning", focus: "choosing the most precise word" },
    { topic: "Denotation and connotation", focus: "literal meaning versus associations" },
    { topic: "Vocabulary in context", focus: "inferring the meaning of a word from a short extract written inside the question" },
    { topic: "Collocations and idiomatic expressions", focus: "words that naturally go together; common idioms" },
    { topic: "Redundancy and concise writing", focus: "removing unnecessary words without changing meaning" },
    { topic: "Formal and informal register", focus: "matching language to audience and purpose" },
    { topic: "Tone and mood in short extracts", focus: "an extract of 2 to 4 sentences written inside the question" },
    { topic: "Writer's purpose and audience", focus: "inform, persuade, entertain, advise, argue" },
    { topic: "Rhetorical devices", focus: "rhetorical question, repetition, tricolon, direct address, anaphora" },
    { topic: "Imagery: simile, metaphor, personification, symbolism", focus: "identifying and explaining the effect" },
    { topic: "Irony, sarcasm, oxymoron, euphemism and understatement", focus: "identifying and explaining the effect" },
    { topic: "Persuasive techniques in short texts", focus: "emotive language, statistics, anecdote, flattery, call to action" },
    { topic: "Argument, discussion and informative writing", focus: "features and structure of each type" },
    { topic: "Paragraph structure, cohesion and discourse markers", focus: "linking sentences and paragraphs logically" },
    { topic: "Summarising: identifying main points", focus: "short text of 3 to 5 sentences written inside the question" },
    { topic: "Inference and implied meaning", focus: "short extracts written inside the question" },
    { topic: "Sentence transformation", focus: "rewriting a sentence in a new form without changing its meaning" },
  ],
};

const SUBJECT = "english";
const DONE_FILE = "data/english-done.json";
const CACHE_FILE = "data/english-gen-cache.json";
const QUESTIONS_PER_TOPIC = 8;
const GEN_BATCH = 2; // topics per generation call
const VERIFY_BATCH = 3; // topics per checking call
const PAUSE_MS = 4000;

// ---------- args ----------
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const numArg = (flag: string, fallback: number) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const LIMIT = numArg("--limit", 6);
const PASS = numArg("--pass", 1);
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit" && args[i - 1] !== "--pass");
const level = (positional[0] ?? "").toUpperCase() as Level;

if (dry) {
  console.log("English topics per level:");
  for (const lv of ["JSS", "SS"] as Level[]) {
    console.log(`  ${lv}: ${TOPICS[lv].length} topics x ${QUESTIONS_PER_TOPIC} questions = about ${TOPICS[lv].length * QUESTIONS_PER_TOPIC} questions per pass`);
  }
  process.exit(0);
}
if (level !== "JSS" && level !== "SS") {
  console.error("Usage: npx tsx --env-file=.env.local scripts/generate-english.ts <JSS|SS> [--limit N] [--pass N]");
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VERIFIER_MODEL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !GEMINI_MODEL) {
  throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL");
}
const parseModels = (v?: string) => (v ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const GEN_MODELS = parseModels(GEMINI_MODEL);
const VER_MODELS = parseModels(GEMINI_VERIFIER_MODEL).length ? parseModels(GEMINI_VERIFIER_MODEL) : GEN_MODELS;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
      if (res.status === 429 && /perday|per day|daily/i.test(text)) throw new DailyQuotaError(lastMsg);
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
const preferred = new Map<string, string>();
async function callPool(models: string[], prompt: string, temperature: number): Promise<string> {
  const key = models.join(",");
  const first = preferred.get(key);
  const order = first && models.includes(first) ? [first, ...models.filter((m) => m !== first)] : models;
  let lastErr: Error | null = null;
  for (const m of order) {
    if (deadModels.has(m)) continue;
    const othersLeft = order.some((x) => x !== m && !deadModels.has(x));
    try {
      const out = await gemini(m, prompt, temperature, othersLeft ? 3 : 6);
      preferred.set(key, m);
      return out;
    } catch (e) {
      if (e instanceof DailyQuotaError) { deadModels.add(m); console.warn(`  ! ${m}: daily quota used up, trying the next model`); continue; }
      if (e instanceof ModelGoneError) { deadModels.add(m); console.warn(`  ! ${m}: not available, skipping it`); continue; }
      lastErr = e as Error;
    }
  }
  if (lastErr) throw lastErr;
  throw new DailyQuotaError("every model in the list is out of quota or unavailable");
}

// Questions must make sense on their own: no pointing at material the pupil cannot see
const LEAK =
  /\b(transcript|the source|the facts|key (concepts?|points?|learning)|the (diagram|figure|graph|image|picture)|shown (above|below)|these specific|the specified|the above)\b/i;

function isValid(g: any): g is Gen {
  if (!g || typeof g.stem !== "string" || g.stem.trim().length < 10) return false;
  if (LEAK.test(g.stem)) return false;
  if (!Array.isArray(g.options) || g.options.length !== 4) return false;
  const ids = g.options.map((o: any) => o?.id);
  const texts = g.options.map((o: any) => norm(String(o?.text ?? "")));
  if (new Set(ids).size !== 4 || new Set(texts).size !== 4) return false;
  if (texts.some((t: string) => !t)) return false;
  if (!ids.includes(g.correct)) return false;
  const lens: number[] = g.options.map((o: any) => String(o.text).length);
  const ci = ids.indexOf(g.correct);
  const others = lens.filter((_, i) => i !== ci);
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  if (lens[ci] > Math.max(...others) && lens[ci] > 1.3 * mean) return false;
  return true;
}

const STOP = new Set(["the","what","which","following","are","was","were","and","that","this","these","those","for","with","how","why","does","did","from","into","not","can","will","their","its","has","have","best","correct","most","about","when","where","who","whom","describes","statement","sentence","word"]);
const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
function tooSimilar(a: Set<string>, b: Set<string>): boolean {
  const min = Math.min(a.size, b.size);
  if (min < 3) return false;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / min >= 0.8;
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

// ---------- prompts ----------
function generationPrompt(group: Topic[], stemsByTopic: Map<string, string[]>): string {
  const sections = group
    .map((t, i) => {
      const have = (stemsByTopic.get(t.topic) ?? []).slice(0, 20);
      return `TOPIC ${i + 1}: ${t.topic}
Focus: ${t.focus}
${have.length ? `Questions already in the bank for this topic (do NOT repeat or reword these):\n${have.map((s) => `- ${s}`).join("\n")}` : "(no questions yet)"}`;
    })
    .join("\n\n");
  return `You write multiple-choice English language questions for pupils in a British-curriculum school in Nigeria. Use British English spelling and conventions.
Level: ${level === "JSS" ? "junior secondary (ages 11-14)" : "senior secondary (ages 14-17)"}.

${sections}

For EACH topic write ${QUESTIONS_PER_TOPIC} NEW questions with difficulties 1, 1, 2, 2, 2, 2, 3, 3. Rules:
- Difficulty 1 = recognise a term or a rule. Difficulty 2 = apply the rule to a sentence. Difficulty 3 = choose the best correction or judge between close options, needing careful reading.
- Exactly 4 options, one clearly correct under standard British English. Never ask about a point that is a matter of opinion, regional preference or arguable usage.
- Wrong options must be errors a real pupil might make. Wrong options must be definitely wrong, never partly correct, and no two options may mean the same thing.
- Every question must be answerable from its own text. If it needs a sentence or a short extract, write that inside the question. Never refer to a text, picture, table or diagram that is not in the question.
- Write every sentence yourself. Do not quote real texts, songs or people, and do not use brand names. Use varied everyday settings and names, including Nigerian names and settings alongside British ones.
- Test ONE idea per question. Cover different points across the questions in a topic. Do not ask for the same thing in different words.
- All four options must be similar in length. The correct answer must not be the longest or most carefully worded option.
- No "all of the above" / "none of the above". Name what you are asking about; never write "these words" or "the above".
- One-sentence explanation of why the answer is correct.
Return ONLY a JSON array containing the questions from every topic: [{"section":1,"difficulty":1,"stem":"","options":[{"id":"a","text":""},{"id":"b","text":""},{"id":"c","text":""},{"id":"d","text":""}],"correct":"a","explanation":""}]`;
}

function verifyPrompt(items: Gen[], existingStems: string[]): string {
  const body = items
    .map((q, i) => `Q${i}: ${q.stem}\n` + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n"))
    .join("\n\n");
  const existing = existingStems.length
    ? `\nEXISTING QUESTIONS ALREADY IN THE BANK:\n${existingStems.map((e) => `- ${e}`).join("\n")}\n`
    : "";
  return `You are checking draft English language multiple-choice questions for secondary school pupils, using standard British English.
For each draft question decide:
1. "answer": the single best option.
2. "ambiguous": true if more than one option could reasonably be defended as correct, if the point is a matter of opinion or regional usage, or if the wording is unclear or refers to something not shown.
3. "duplicate": true if it tests essentially the same point as an EXISTING QUESTION below, or as an earlier draft in this list (different wording of the same point still counts).
${existing}
DRAFT QUESTIONS:
${body}

Return ONLY a JSON array: [{"i":0,"answer":"a","ambiguous":false,"duplicate":false}, ...] with one entry per draft question.`;
}

// ---------- main ----------
async function main() {
  const done: string[] = existsSync(DONE_FILE) ? JSON.parse(readFileSync(DONE_FILE, "utf8")) : [];
  const doneSet = new Set(done);
  const cache: Record<string, any[]> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
  const keyOf = (idx: number) => `${level}|p${PASS}|${idx}`;

  const todo = TOPICS[level]
    .map((t, idx) => ({ ...t, idx, key: keyOf(idx) }))
    .filter((t) => !doneSet.has(t.key))
    .slice(0, LIMIT);
  console.log(`English ${level}, pass ${PASS}: ${todo.length} topics (limit ${LIMIT})`);
  console.log(`  generate with: ${GEN_MODELS.join(", ")}\n  verify with:   ${VER_MODELS.join(", ")}`);

  const rows = await fetchAll((a, b) =>
    db.from("questions").select("stem, topic").eq("subject", SUBJECT).eq("level", level).range(a, b),
  );
  const existing: { stem: string; tok: Set<string> }[] = rows.map((r) => ({ stem: r.stem as string, tok: tokens(r.stem) }));
  const stemsByTopic = new Map<string, string[]>();
  for (const r of rows) stemsByTopic.set(r.topic, [...(stemsByTopic.get(r.topic) ?? []), r.stem]);
  const totals = { generated: 0, invalid: 0, duplicate: 0, ambiguous: 0, rejected: 0, saved: 0 };

  // Stage 1: generate (2 topics per call), cache the results
  const needGen = todo.filter((t) => !cache[t.key]);
  for (let i = 0; i < needGen.length; i += GEN_BATCH) {
    const group = needGen.slice(i, i + GEN_BATCH);
    try {
      const raw = await callPool(GEN_MODELS, generationPrompt(group, stemsByTopic), 0.8);
      await sleep(PAUSE_MS);
      const parsed = parseJson<any[]>(raw);
      if (!Array.isArray(parsed)) { console.warn("  ! unparseable generation (will retry next run)"); continue; }
      let ok = 0;
      group.forEach((t, idx) => {
        const qs = parsed.filter((g) => Number(g?.section) === idx + 1);
        if (qs.length) { cache[t.key] = qs; ok++; }
      });
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      console.log(`generated ${ok}/${group.length}: ${group.map((t) => t.topic).join("; ")}`);
    } catch (e) {
      if (e instanceof DailyQuotaError) { console.error(`\nGeneration stopped: ${(e as Error).message}`); break; }
      console.error("  ! generation error (will retry next run):", (e as Error).message);
    }
  }

  // Stage 2: check + save (3 topics per call)
  const ready = todo.filter((t) => cache[t.key]?.length);
  for (let i = 0; i < ready.length; i += VERIFY_BATCH) {
    const group = ready.slice(i, i + VERIFY_BATCH);
    try {
      const candidates: { t: (typeof group)[number]; q: Gen; correctId: string; difficulty: number }[] = [];
      const batchTok: Set<string>[] = [];
      for (const t of group) {
        for (const g of cache[t.key]) {
          totals.generated++;
          if (!isValid(g)) { totals.invalid++; continue; }
          const tk = tokens(g.stem);
          if (existing.some((e) => tooSimilar(e.tok, tk)) || batchTok.some((x) => tooSimilar(x, tk))) { totals.duplicate++; continue; }
          batchTok.push(tk);
          const correctText = g.options.find((o: any) => o.id === g.correct)!.text;
          const options = shuffle<string>(g.options.map((o: any) => o.text)).map((text, k) => ({ id: "abcd"[k], text }));
          const correctId = options.find((o) => o.text === correctText)!.id;
          const difficulty = Math.min(3, Math.max(1, Math.round(Number(g.difficulty) || 2)));
          candidates.push({ t, q: { ...g, options, correct: correctId }, correctId, difficulty });
        }
      }

      if (candidates.length) {
        const union = new Set<string>();
        for (const x of batchTok) for (const w of x) union.add(w);
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
          const { t, q, correctId, difficulty } = candidates[k];
          const v = verdictOf.get(k);
          if (!v || v.answer !== correctId) { totals.rejected++; continue; }
          if (v.ambiguous === true) { totals.ambiguous++; continue; }
          if (v.duplicate === true) { totals.duplicate++; continue; }
          const { data: row, error: qErr } = await db
            .from("questions")
            .insert({
              subject: SUBJECT,
              topic: t.topic,
              level,
              curriculum: level === "JSS" ? "uk-ks3" : "uk-ks4",
              difficulty,
              stem: q.stem.trim(),
              options: q.options,
              explanation: q.explanation ?? null,
              source: "llm",
              source_ref: `english:${t.idx}:pass${PASS}`,
              status: "verified",
            })
            .select("id")
            .single();
          if (qErr || !row) { console.warn("  ! insert failed:", qErr?.message); continue; }
          const { error: aErr } = await db.from("question_answers").insert({ question_id: row.id, correct_option: correctId });
          if (aErr) { await db.from("questions").delete().eq("id", row.id); console.warn("  ! answer insert failed:", aErr.message); continue; }
          existing.push({ stem: q.stem.trim(), tok: tokens(q.stem) });
          totals.saved++;
        }
      }
      for (const t of group) { delete cache[t.key]; done.push(t.key); }
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      writeFileSync(DONE_FILE, JSON.stringify(done));
      console.log(`checked ${group.length} topics (saved so far: ${totals.saved})`);
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