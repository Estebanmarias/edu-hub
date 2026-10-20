import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { lagosDate, subjectLabel } from "@/lib/quiz/config";
import { subjectEmoji } from "@/lib/quiz/subjects";
import { currentStreak } from "@/lib/streak";
import { classifyQuestion, subjectAccuracy, weakAndStrong, type TopicRow } from "@/lib/analytics";
import ConfirmButton from "@/components/ConfirmButton";
import Mascot from "@/components/mascot/Mascot";
import { setKey, setQuestionStatus } from "./actions";

type Search = { tab?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { tab } = await searchParams;
  const active = tab === "questions" ? "questions" : "students";

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-800">Analytics</h1>
      <p className="mb-4 text-ink/60">How your cousins are doing, and which questions may need fixing.</p>

      <div className="mb-6 flex gap-2">
        {[
          { key: "students", label: "Students" },
          { key: "questions", label: "Questions to check" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/analytics?tab=${t.key}`}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${
              active === t.key ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 bg-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active === "students" ? <StudentsTab /> : <QuestionsTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ students */

async function StudentsTab() {
  const admin = createAdminClient();
  const { data: students } = await admin
    .from("profiles")
    .select("id, display_name, level")
    .eq("role", "student")
    .order("display_name");
  const list = students ?? [];
  if (list.length === 0) return <Empty text="No students yet. Create accounts in the Students page." />;

  const ids = list.map((s) => s.id as string);
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: sessions }, { data: topics }, { data: leaves }] = await Promise.all([
    admin.from("quiz_sessions").select("user_id, quiz_date, score, total_questions").eq("status", "submitted").in("user_id", ids),
    admin.from("student_topic_accuracy").select("user_id, subject, topic, answered, correct").in("user_id", ids),
    admin.from("events").select("user_id").eq("kind", "tab_hidden").gte("created_at", since).in("user_id", ids),
  ]);

  const today = lagosDate();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((s) => {
        const mine = (sessions ?? []).filter((x) => x.user_id === s.id && x.total_questions);
        const pcts = mine.map((x) => ((x.score ?? 0) / (x.total_questions as number)) * 100);
        const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
        const lastDate = mine.map((x) => x.quiz_date as string).sort().pop();
        const streak = currentStreak(mine.map((x) => x.quiz_date as string), today);
        const rows = (topics ?? []).filter((t) => t.user_id === s.id) as unknown as (TopicRow & { user_id: string })[];
        const { weak, strong } = weakAndStrong(rows);
        const subjects = subjectAccuracy(rows);
        const tabLeaves = (leaves ?? []).filter((l) => l.user_id === s.id).length;

        return (
          <article key={s.id} className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{s.display_name}</h2>
              <span className="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-bold text-brand-800">{s.level}</span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={mine.length} label="quizzes" />
              <Stat value={avg === null ? "-" : `${avg}%`} label="average" />
              <Stat value={`🔥 ${streak}`} label="day streak" />
            </div>
            <p className="mb-3 text-xs text-ink/50">Last quiz: {lastDate ?? "never"}</p>

            {subjects.length > 0 && (
              <div className="mb-4 space-y-2">
                {subjects.map((x) => (
                  <div key={x.subject}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="font-semibold">
                        {subjectEmoji(x.subject)} {subjectLabel(x.subject)}
                      </span>
                      <span className="text-ink/60">
                        {x.pct}% of {x.answered}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-100">
                      <div className={`h-full rounded-full ${x.pct >= 70 ? "bg-green-500" : x.pct >= 50 ? "bg-brand-500" : "bg-berry-500"}`} style={{ width: `${x.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {weak.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-berry-600">Needs work</div>
                <div className="flex flex-wrap gap-1.5">
                  {weak.map((w) => (
                    <span key={w.subject + w.topic} className="rounded-full bg-berry-500/10 px-2.5 py-1 text-xs">
                      {w.topic} <b>{w.pct}%</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {strong.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">Strong</div>
                <div className="flex flex-wrap gap-1.5">
                  {strong.map((w) => (
                    <span key={w.subject + w.topic} className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs">
                      {w.topic} <b>{w.pct}%</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {rows.length === 0 && <p className="text-sm text-ink/50">No answers yet.</p>}

            {tabLeaves >= 5 && (
              <p className="mt-3 rounded-lg bg-sun-300/50 p-2 text-xs">
                ⚠️ Left the quiz tab {tabLeaves} times in the last 14 days.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-brand-50 py-2">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-xs text-ink/55">{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- questions */

type Option = { id: string; text: string };

async function QuestionsTab() {
  const admin = createAdminClient();
  const { data: health } = await admin
    .from("question_health")
    .select("question_id, answers, correct, pct_correct")
    .gte("answers", 5)
    .order("pct_correct", { ascending: true })
    .limit(60);
  const rows = health ?? [];
  const ids = rows.map((r) => r.question_id as string);

  if (ids.length === 0) {
    return <Empty text="Not enough answers yet. Once your cousins have answered each question a few times, questions that look wrong will show up here." />;
  }

  const [{ data: questions }, { data: keys }, { data: optionCounts }] = await Promise.all([
    admin.from("questions").select("id, stem, options, subject, level, topic, status").in("id", ids),
    admin.from("question_answers").select("question_id, correct_option").in("question_id", ids),
    admin.from("option_counts").select("question_id, chosen_option, n").in("question_id", ids),
  ]);
  const qOf = new Map((questions ?? []).map((q) => [q.id as string, q]));
  const keyOf = new Map((keys ?? []).map((k) => [k.question_id as string, k.correct_option as string]));

  const suspects = rows
    .map((r) => {
      const key = keyOf.get(r.question_id as string) ?? "";
      const counts: Record<string, number> = {};
      for (const c of optionCounts ?? []) if (c.question_id === r.question_id) counts[c.chosen_option as string] = c.n as number;
      const verdict = classifyQuestion({ answers: r.answers as number, correct: r.correct as number, counts, key });
      return { r, q: qOf.get(r.question_id as string), key, counts, verdict };
    })
    .filter((x) => x.q && x.verdict.kind && x.q.status === "approved")
    .sort((a, b) => (a.verdict.kind === "key" ? 0 : 1) - (b.verdict.kind === "key" ? 0 : 1) || a.verdict.pct - b.verdict.pct)
    .slice(0, 30);

  if (suspects.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm">
        <Mascot mood="happy" size={110} />
        <p className="mt-3 font-semibold">No suspicious questions right now.</p>
        <p className="text-sm text-ink/60">Questions with 5 or more answers all look healthy.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-ink/70">
        These questions were answered at least 5 times. <b>Possible wrong key</b> means most students who got it wrong picked the same wrong
        option, so that option may actually be the right one. <b>Very hard or unclear</b> means nearly everyone missed it with no pattern.
      </p>
      <div className="space-y-4">
        {suspects.map(({ r, q, key, counts, verdict }) => {
          const options = q!.options as Option[];
          const max = Math.max(1, ...Object.values(counts));
          return (
            <article key={r.question_id as string} className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-bold ${verdict.kind === "key" ? "bg-berry-500/15 text-berry-600" : "bg-sun-300/60"}`}>
                  {verdict.kind === "key" ? "Possible wrong key" : "Very hard or unclear"}
                </span>
                <span className="rounded-full bg-brand-100 px-2.5 py-1">
                  {subjectEmoji(q!.subject as string)} {subjectLabel(q!.subject as string)} · {q!.level}
                </span>
                <span className="text-ink/55">
                  {verdict.pct}% correct from {r.answers as number} answers
                </span>
              </div>
              <p className="mb-3 font-semibold">{q!.stem as string}</p>
              <ul className="mb-4 space-y-1.5 text-sm">
                {options.map((o) => {
                  const n = counts[o.id] ?? 0;
                  const isKey = o.id === key;
                  const isTop = o.id === verdict.topWrong && verdict.kind === "key";
                  return (
                    <li key={o.id} className={`relative overflow-hidden rounded-lg border px-3 py-2 ${isKey ? "border-green-400" : isTop ? "border-berry-500" : "border-brand-100"}`}>
                      <div
                        className={`absolute inset-y-0 left-0 ${isKey ? "bg-green-500/15" : isTop ? "bg-berry-500/15" : "bg-brand-100/60"}`}
                        style={{ width: `${(n / max) * 100}%` }}
                      />
                      <div className="relative flex items-start justify-between gap-3">
                        <span>
                          <span className="mr-2 font-mono text-ink/50">{o.id})</span>
                          {o.text}
                          {isKey && <span className="ml-2 text-xs font-bold text-green-700">key</span>}
                          {isTop && <span className="ml-2 text-xs font-bold text-berry-600">most picked wrong answer</span>}
                        </span>
                        <span className="shrink-0 font-semibold">{n}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                {verdict.kind === "key" && verdict.topWrong && (
                  <form action={setKey}>
                    <input type="hidden" name="id" value={r.question_id as string} />
                    <input type="hidden" name="option" value={verdict.topWrong} />
                    <ConfirmButton
                      message={`Make option ${verdict.topWrong} the correct answer? Past quiz scores stay as they were.`}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white"
                    >
                      Make &ldquo;{verdict.topWrong}&rdquo; the key
                    </ConfirmButton>
                  </form>
                )}
                <form action={setQuestionStatus}>
                  <input type="hidden" name="id" value={r.question_id as string} />
                  <input type="hidden" name="status" value="verified" />
                  <button className="rounded-lg border-2 border-brand-200 px-3 py-2 text-sm font-semibold">Back to review</button>
                </form>
                <form action={setQuestionStatus}>
                  <input type="hidden" name="id" value={r.question_id as string} />
                  <input type="hidden" name="status" value="rejected" />
                  <ConfirmButton message="Reject this question? Students will no longer see it." className="rounded-lg bg-berry-500 px-3 py-2 text-sm font-bold text-white">
                    Reject
                  </ConfirmButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-sm">
      <Mascot mood="sleepy" size={110} />
      <p className="mt-3 max-w-md text-ink/70">{text}</p>
    </div>
  );
}