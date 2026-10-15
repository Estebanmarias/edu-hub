/**
 * Generate + blind-verify MCQs and load them into Supabase.
 *
 * Usage:
 *   npx tsx scripts/generate-questions.ts JSS            # all JSS biology topics
 *   npx tsx scripts/generate-questions.ts SS "enzymes"   # one SS topic (substring match)
 *
 * Env (.env.local or .env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 * GEMINI_MODEL, optional GEMINI_VERIFIER_MODEL (use a different model if you can), CURRICULUM.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_VERIFIER_MODEL,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !GEMINI_MODEL) {
  throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GEMINI_MODEL");
}
const GENERATOR = GEMINI_MODEL;
const VERIFIER = GEMINI_VERIFIER_MODEL ?? GEMINI_MODEL;
const CURRICULUM = process.env.CURRICULUM ?? "cambridge";
const SUBJECT = "biology";
const PER_CALL = 8;
const PAUSE_MS = 4000; // stay under free-tier per-minute limits

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Level = "JSS" | "SS";
type Gen = {
  stem: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation?: string;
};

// Starter topic lists. Edit these to match what the school actually teaches.
const TOPICS: Record<Level, string[]> = {
  JSS: [
    "Cells and organisation",
    "Nutrition and digestion",
    "Respiration",
    "Photosynthesis and plants",
    "Reproduction and growth",
    "Ecosystems and food webs",
    "Inheritance and variation",
    "Health and disease",
  ],
  SS: [
    "Characteristics and classification of living things",
    "Cell structure and transport",
    "Enzymes",
    "Plant nutrition and transport",
    "Human nutrition",
    "Gas exchange and respiration",
    "Circulation",
    "Excretion and homeostasis",
    "Coordination and response",
    "Reproduction",
    "Inheritance",
    "Ecology",
    "Human influences on the environment",
    "Biotechnology",
  ],
};

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
    const data: any = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error("Gemini: retries exhausted");
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
  } catch {
    return null;
  }
}

function isValid(g: any): g is Gen {
  if (!g || typeof g.stem !== "string" || g.stem.trim().length < 10) return false;
  if (!Array.isArray(g.options) || g.options.length !== 4) return false;
  const ids = g.options.map((o: any) => o?.id);
  const texts = g.options.map((o: any) => norm(String(o?.text ?? "")));
  if (new Set(ids).size !== 4 || new Set(texts).size !== 4) return false;
  if (texts.some((t: string) => !t)) return false;
  return ids.includes(g.correct);
}

function generationPrompt(level: Level, topic: string, difficulty: number): string {
  const diff = ["", "easy (recall)", "medium (understanding)", "hard (application / multi-step reasoning)"][difficulty];
  return `You are writing multiple-choice questions for a British-curriculum secondary school in Nigeria.
Subject: Biology. Level: ${level === "JSS" ? "junior secondary (ages 11-14)" : "senior secondary (ages 14-17)"}. Topic: ${topic}. Difficulty: ${diff}.
Write ${PER_CALL} questions. Each needs a clear stem, exactly 4 options with one unambiguously correct answer, plausible distractors based on common misconceptions, and a one-sentence explanation. No "all of the above" or "none of the above". Do not repeat the same fact across questions.
Return ONLY a JSON array: [{"stem":"","options":[{"id":"a","text":""},{"id":"b","text":""},{"id":"c","text":""},{"id":"d","text":""}],"correct":"a","explanation":""}]`;
}

function verifyPrompt(items: Gen[]): string {
  const body = items
    .map(
      (q, i) =>
        `Q${i}: ${q.stem}\n` + q.options.map((o) => `  ${o.id}) ${o.text}`).join("\n"),
    )
    .join("\n\n");
  return `Answer each biology multiple-choice question below with the single best option.
${body}

Return ONLY a JSON array: [{"i":0,"answer":"a"}, ...] with one entry per question.`;
}

async function run(level: Level, onlyTopic?: string) {
  const topics = TOPICS[level].filter(
    (t) => !onlyTopic || t.toLowerCase().includes(onlyTopic.toLowerCase()),
  );
  const totals = { generated: 0, invalid: 0, duplicate: 0, rejected: 0, saved: 0 };

  for (const topic of topics) {
    const { data: existing, error } = await db
      .from("questions")
      .select("stem")
      .eq("subject", SUBJECT)
      .eq("level", level)
      .eq("topic", topic);
    if (error) throw error;
    const seen = new Set((existing ?? []).map((r) => norm(r.stem)));

    for (const difficulty of [1, 2, 3]) {
      // 1) generate
      const raw = await gemini(GENERATOR, generationPrompt(level, topic, difficulty), 0.8);
      await sleep(PAUSE_MS);
      const parsed = parseJson<unknown[]>(raw);
      if (!Array.isArray(parsed)) {
        console.warn(`  ! unparseable generation: ${topic} d${difficulty}`);
        continue;
      }
      totals.generated += parsed.length;

      // 2) structural check, dedupe, shuffle options (so the key isn't biased to "a")
      const candidates: { q: Gen; correctId: string }[] = [];
      for (const g of parsed) {
        if (!isValid(g)) { totals.invalid++; continue; }
        if (seen.has(norm(g.stem))) { totals.duplicate++; continue; }
        const correctText = g.options.find((o) => o.id === g.correct)!.text;
        const shuffled = shuffle(g.options.map((o) => o.text));
        const options = shuffled.map((text, i) => ({ id: "abcd"[i], text }));
        const correctId = options.find((o) => o.text === correctText)!.id;
        candidates.push({ q: { ...g, options, correct: correctId }, correctId });
      }
      if (!candidates.length) continue;

      // 3) blind verification: a separate call sees only the stem + options
      const vraw = await gemini(VERIFIER, verifyPrompt(candidates.map((c) => c.q)), 0);
      await sleep(PAUSE_MS);
      const answers = parseJson<{ i: number; answer: string }[]>(vraw) ?? [];
      const answerOf = new Map(answers.map((a) => [a.i, a.answer]));

      // 4) save only the questions where the blind solver agrees with the key
      for (let i = 0; i < candidates.length; i++) {
        const { q, correctId } = candidates[i];
        if (answerOf.get(i) !== correctId) { totals.rejected++; continue; }

        const { data: row, error: qErr } = await db
          .from("questions")
          .insert({
            subject: SUBJECT,
            topic,
            level,
            curriculum: CURRICULUM,
            difficulty,
            stem: q.stem.trim(),
            options: q.options,
            explanation: q.explanation ?? null,
            source: "llm",
            source_ref: `${GENERATOR}${VERIFIER !== GENERATOR ? `+verify:${VERIFIER}` : ""}`,
            status: "verified", // becomes 'approved' only after you spot-check
          })
          .select("id")
          .single();
        if (qErr || !row) { console.warn("  ! insert failed:", qErr?.message); continue; }

        const { error: aErr } = await db
          .from("question_answers")
          .insert({ question_id: row.id, correct_option: correctId });
        if (aErr) {
          await db.from("questions").delete().eq("id", row.id);
          console.warn("  ! answer insert failed:", aErr.message);
          continue;
        }
        seen.add(norm(q.stem));
        totals.saved++;
      }
      console.log(`${level} | ${topic} | d${difficulty} done (saved so far: ${totals.saved})`);
    }
  }

  const rejRate = totals.generated ? ((totals.rejected / totals.generated) * 100).toFixed(1) : "0";
  console.log("\nSummary", totals, `| verifier rejection rate: ${rejRate}%`);
}

const level = (process.argv[2] ?? "").toUpperCase() as Level;
if (level !== "JSS" && level !== "SS") {
  console.error('Usage: npx tsx scripts/generate-questions.ts <JSS|SS> ["topic substring"]');
  process.exit(1);
}
run(level, process.argv[3]).catch((e) => {
  console.error(e);
  process.exit(1);
});