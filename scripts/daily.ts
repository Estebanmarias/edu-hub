/**
 * Daily top-up: keeps the question bank growing without you babysitting it.
 *
 * It looks at how many questions each subject/level pile has, runs the right generator for the
 * emptiest pile, then the next emptiest, and so on, until the Gemini daily quota runs out
 * (or every pile has reached the target, or the run limit is hit).
 *
 * Usage (run from the project root):
 *   npx tsx --env-file=.env.local scripts/daily.ts --dry               # just show the piles
 *   npx tsx --env-file=.env.local scripts/daily.ts                     # generate, leave new questions for review
 *   npx tsx --env-file=.env.local scripts/daily.ts --auto-approve      # also approve new questions in piles you already reviewed
 *
 * Flags: --target 350   questions wanted per pile (default 350)
 *        --max-runs 8   generator runs per day (default 8)
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Pile = { subject: string; level: "JSS" | "SS"; kind: "oak" | "english" };

const PLAN: Pile[] = [
  { subject: "math", level: "JSS", kind: "oak" },
  { subject: "english", level: "JSS", kind: "english" },
  { subject: "biology", level: "JSS", kind: "oak" },
  { subject: "chemistry", level: "JSS", kind: "oak" },
  { subject: "physics", level: "JSS", kind: "oak" },
  { subject: "math", level: "SS", kind: "oak" },
  { subject: "english", level: "SS", kind: "english" },
  { subject: "biology", level: "SS", kind: "oak" },
  { subject: "chemistry", level: "SS", kind: "oak" },
  { subject: "physics", level: "SS", kind: "oak" },
];

const OAK_LESSONS_PER_RUN = 20;
const ENGLISH_TOPICS_PER_RUN = 12;
const ENGLISH_TOPICS_PER_LEVEL = 36; // must match the topic lists in generate-english.ts
const REVIEWED_MINIMUM = 25; // auto-approve only piles where you already approved at least this many by hand

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const numFlag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const TARGET = numFlag("--target", 350);
const MAX_RUNS = numFlag("--max-runs", 8);
const AUTO_APPROVE = flag("--auto-approve");
const DRY = flag("--dry");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const label = (p: Pile) => `${p.level} ${p.subject}`;

async function count(p: Pile, status?: string): Promise<number> {
  let q = db.from("questions").select("id", { count: "exact", head: true }).eq("subject", p.subject).eq("level", p.level);
  q = status ? q.eq("status", status) : q.neq("status", "rejected");
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

function englishPass(level: string): number {
  const done: string[] = existsSync("data/english-done.json") ? JSON.parse(readFileSync("data/english-done.json", "utf8")) : [];
  for (let pass = 1; pass <= 10; pass++) {
    const n = done.filter((k) => k.startsWith(`${level}|p${pass}|`)).length;
    if (n < ENGLISH_TOPICS_PER_LEVEL) return pass;
  }
  return 10;
}

function run(cmdArgs: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn("npx", cmdArgs, { shell: true });
    let out = "";
    child.stdout.on("data", (d) => { process.stdout.write(d); out += d.toString(); });
    child.stderr.on("data", (d) => { process.stderr.write(d); out += d.toString(); });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

async function main() {
  console.log(`Daily top-up ${new Date().toISOString()} | target ${TARGET} per pile | auto-approve: ${AUTO_APPROVE ? "on" : "off"}`);

  const exhausted = new Set<string>(); // piles that produced nothing this run (no lessons left, or nothing new)
  let errors = 0;

  for (let runNo = 1; runNo <= MAX_RUNS; runNo++) {
    const rows = [];
    for (const p of PLAN) rows.push({ p, total: await count(p) });
    if (runNo === 1) {
      console.log("\nPiles (questions not rejected):");
      for (const r of rows) console.log(`  ${label(r.p).padEnd(14)} ${String(r.total).padStart(4)} / ${TARGET}`);
    }
    if (DRY) return;

    const next = rows
      .filter((r) => r.total < TARGET && !exhausted.has(label(r.p)))
      .sort((a, b) => a.total - b.total)[0];
    if (!next) { console.log("\nNothing left to do: every pile is at target or has nothing more to give today."); break; }

    const { p } = next;
    const approvedBefore = await count(p, "approved");
    console.log(`\n=== Run ${runNo}/${MAX_RUNS}: ${label(p)} (${next.total} so far) ===`);

    const cmd =
      p.kind === "english"
        ? ["tsx", "--env-file=.env.local", "scripts/generate-english.ts", p.level, "--limit", String(ENGLISH_TOPICS_PER_RUN), "--pass", String(englishPass(p.level))]
        : ["tsx", "--env-file=.env.local", "scripts/generate-from-oak.ts", p.level, p.subject, "--limit", String(OAK_LESSONS_PER_RUN)];
    const { code, out } = await run(cmd);

    const saves = [...out.matchAll(/saved:\s*(\d+)/g)];
    const saved = saves.length ? Number(saves[saves.length - 1][1]) : 0;
    const quotaGone = /every model in the list is out of quota or unavailable/.test(out);

    if (code !== 0) {
      console.error(`  ! ${label(p)} exited with an error (code ${code})`);
      exhausted.add(label(p));
      if (++errors >= 2) { console.error("Two errors in a row, stopping."); break; }
      continue;
    }
    errors = 0;
    if (saved === 0) exhausted.add(label(p));

    if (AUTO_APPROVE && saved > 0) {
      if (approvedBefore >= REVIEWED_MINIMUM) {
        const { error } = await db
          .from("questions")
          .update({ status: "approved" })
          .eq("status", "verified")
          .eq("subject", p.subject)
          .eq("level", p.level);
        console.log(error ? `  ! auto-approve failed: ${error.message}` : `  auto-approved the new ${label(p)} questions`);
      } else {
        console.log(`  ${label(p)} has only ${approvedBefore} approved so far, so the new questions wait for your review`);
      }
    }

    if (quotaGone) { console.log("\nGemini quota is used up for today. Stopping."); break; }
  }

  console.log("\nPiles now:");
  for (const p of PLAN) {
    console.log(`  ${label(p).padEnd(14)} total ${String(await count(p)).padStart(4)} | approved ${String(await count(p, "approved")).padStart(4)} | waiting review ${String(await count(p, "verified")).padStart(4)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});