import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveEdits, setStatus } from "./actions";
import ApproveAllButton from "./approve-all-button";

const PAGE_SIZE = 20;
const STATUS_LABELS: Record<string, string> = {
  verified: "To review",
  approved: "Approved",
  rejected: "Rejected",
};
const SUBJECTS = ["math", "english", "biology", "chemistry", "physics"];
const SAMPLE_SIZE = 20;

type Search = { status?: string; subject?: string; level?: string; page?: string; sample?: string };
type Option = { id: string; text: string };

/** Stable "random" order: the same seed always ranks the questions the same way, so a sample doesn't reshuffle after each click. */
function rank(seed: string, id: string) {
  let h = 2166136261;
  for (const ch of seed + id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function href(patch: Search) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(patch)) if (v) qs.set(k, v);
  return `/admin/review?${qs.toString()}`;
}

function StatusButton({ id, status, label, tone }: { id: string; status: string; label: string; tone: string }) {
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${tone}`}>{label}</button>
    </form>
  );
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in STATUS_LABELS ? sp.status : "verified";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient(); // row-level security: only admins can read these tables

  const select =
    "id, subject, topic, level, difficulty, stem, options, explanation, source_ref, status, question_answers(correct_option)";
  const seed = sp.sample ?? "";

  let questions: any[] | null = null;
  let count: number | null = null;
  if (seed) {
    // random sample: rank every matching question by a seeded hash and show the first few
    let idQuery = supabase.from("questions").select("id", { count: "exact" }).eq("status", status);
    if (sp.subject) idQuery = idQuery.eq("subject", sp.subject);
    if (sp.level) idQuery = idQuery.eq("level", sp.level);
    const { data: idRows, count: c } = await idQuery.limit(5000);
    count = c;
    const picked = (idRows ?? [])
      .map((r) => r.id as string)
      .sort((a, b) => rank(seed, a) - rank(seed, b))
      .slice(0, SAMPLE_SIZE);
    if (picked.length) {
      const { data } = await supabase.from("questions").select(select).in("id", picked);
      questions = (data ?? []).sort((a, b) => rank(seed, a.id) - rank(seed, b.id));
    } else {
      questions = [];
    }
  } else {
    let query = supabase
      .from("questions")
      .select(select, { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (sp.subject) query = query.eq("subject", sp.subject);
    if (sp.level) query = query.eq("level", sp.level);
    const { data, count: c } = await query;
    questions = data;
    count = c;
  }

  const counts: Record<string, number> = {};
  for (const s of Object.keys(STATUS_LABELS)) {
    const { count: c } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", s);
    counts[s] = c ?? 0;
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = { status: sp.status, subject: sp.subject, level: sp.level, sample: sp.sample };
  const newSample = String(Math.floor(Math.random() * 1_000_000) + 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Object.entries(STATUS_LABELS).map(([s, label]) => (
          <Link
            key={s}
            href={href({ ...filters, status: s === "verified" ? undefined : s })}
            className={`rounded-full border px-4 py-1.5 text-sm ${s === status ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}
          >
            {label} ({counts[s]})
          </Link>
        ))}
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm">
        {status !== "verified" && <input type="hidden" name="status" value={status} />}
        <div>
          <label className="mb-1 block text-gray-600">Subject</label>
          <select name="subject" defaultValue={sp.subject ?? ""} className="rounded border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-gray-600">Level</label>
          <select name="level" defaultValue={sp.level ?? ""} className="rounded border border-gray-300 px-2 py-1.5">
            <option value="">All</option>
            <option value="JSS">JSS</option>
            <option value="SS">SS</option>
          </select>
        </div>
        <button className="rounded border border-gray-300 px-3 py-1.5">Filter</button>
        <span className="text-gray-600">{total} question{total === 1 ? "" : "s"}</span>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={href({ status: sp.status, subject: sp.subject, level: sp.level, sample: newSample })}
          className="rounded-lg border border-blue-600 px-3 py-1.5 text-blue-700"
        >
          {seed ? "New random sample" : `Random sample of ${SAMPLE_SIZE}`}
        </Link>
        {seed && (
          <Link href={href({ status: sp.status, subject: sp.subject, level: sp.level })} className="text-gray-600 underline">
            Back to the full list
          </Link>
        )}
        {status === "verified" && sp.subject && (sp.level === "JSS" || sp.level === "SS") && total > 0 && (
          <ApproveAllButton subject={sp.subject} level={sp.level} total={total} />
        )}
      </div>

      {questions?.length === 0 && <p className="text-gray-600">Nothing here.</p>}

      <div className="space-y-5">
        {questions?.map((q) => {
          const answer = Array.isArray(q.question_answers) ? q.question_answers[0] : q.question_answers;
          const correct = (answer as { correct_option?: string } | null)?.correct_option;
          const options = q.options as Option[];
          return (
            <article key={q.id} className="rounded-xl border border-gray-200 p-5">
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="rounded bg-gray-100 px-2 py-0.5">{q.subject}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5">{q.level}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5">difficulty {q.difficulty}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5">{q.topic}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">{q.source_ref}</span>
              </div>
              <p className="mb-3 font-medium">{q.stem}</p>
              <ul className="mb-3 space-y-1.5 text-sm">
                {options.map((o) => (
                  <li
                    key={o.id}
                    className={`rounded-lg border px-3 py-2 ${o.id === correct ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                  >
                    <span className="mr-2 font-mono text-gray-500">{o.id})</span>
                    {o.text}
                    {o.id === correct && <span className="ml-2 text-xs font-medium text-green-700">key</span>}
                  </li>
                ))}
              </ul>
              {q.explanation && <p className="mb-4 text-sm text-gray-600">Why: {q.explanation}</p>}

              <div className="flex flex-wrap items-start gap-3">
                {status !== "approved" && <StatusButton id={q.id} status="approved" label="Approve" tone="bg-green-600" />}
                {status !== "rejected" && <StatusButton id={q.id} status="rejected" label="Reject" tone="bg-red-600" />}
                {status !== "verified" && <StatusButton id={q.id} status="verified" label="Back to review" tone="bg-gray-600" />}

                <details className="min-w-[16rem] flex-1">
                  <summary className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm">Edit</summary>
                  <form action={saveEdits} className="mt-3 space-y-3 text-sm">
                    <input type="hidden" name="id" value={q.id} />
                    <div>
                      <label className="mb-1 block text-gray-600">Question</label>
                      <textarea name="stem" defaultValue={q.stem} rows={3} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                    </div>
                    <div>
                      <label className="mb-1 block text-gray-600">Explanation</label>
                      <textarea name="explanation" defaultValue={q.explanation ?? ""} rows={2} className="w-full rounded border border-gray-300 px-2 py-1.5" />
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <label className="mb-1 block text-gray-600">Difficulty</label>
                        <select name="difficulty" defaultValue={String(q.difficulty)} className="rounded border border-gray-300 px-2 py-1.5">
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-gray-600">Correct option</label>
                        <select name="correct" defaultValue={correct} className="rounded border border-gray-300 px-2 py-1.5">
                          {options.map((o) => (
                            <option key={o.id} value={o.id}>{o.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button name="intent" value="save" className="rounded border border-gray-300 px-3 py-1.5">Save</button>
                      <button name="intent" value="approve" className="rounded bg-green-600 px-3 py-1.5 text-white">Save and approve</button>
                    </div>
                  </form>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      {!seed && lastPage > 1 && (
        <div className="mt-6 flex items-center gap-4 text-sm">
          {page > 1 && <Link href={href({ ...filters, page: String(page - 1) })}>&larr; Previous</Link>}
          <span className="text-gray-600">Page {page} of {lastPage}</span>
          {page < lastPage && <Link href={href({ ...filters, page: String(page + 1) })}>Next &rarr;</Link>}
        </div>
      )}
    </div>
  );
}