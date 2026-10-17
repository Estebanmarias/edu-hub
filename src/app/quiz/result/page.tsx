import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { currentSession } from "@/lib/quiz/finalize";

export default async function ResultPage() {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/");

  const admin = createAdminClient();
  if (await currentSession(admin, profile.id)) redirect("/quiz/session"); // still running

  const { data: session } = await admin
    .from("quiz_sessions")
    .select("id, score, started_at, finished_at, quiz_date")
    .eq("user_id", profile.id)
    .eq("status", "submitted")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) redirect("/quiz");

  const { data: rows } = await admin
    .from("session_questions")
    .select("subject, is_correct")
    .eq("session_id", session.id);

  const bySubject = new Map<string, { correct: number; total: number }>();
  for (const r of rows ?? []) {
    const s = bySubject.get(r.subject) ?? { correct: 0, total: 0 };
    s.total++;
    if (r.is_correct) s.correct++;
    bySubject.set(r.subject, s);
  }
  const total = rows?.length ?? 0;
  const score = session.score ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const minutes = session.finished_at
    ? Math.max(1, Math.round((Date.parse(session.finished_at) - Date.parse(session.started_at)) / 60000))
    : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-bold">Your result</h1>
      <p className="mb-6 text-sm text-gray-600">{session.quiz_date}</p>

      <div className="mb-8 rounded-2xl border border-gray-200 p-6 text-center">
        <div className="text-5xl font-bold">
          {score}
          <span className="text-2xl text-gray-500"> / {total}</span>
        </div>
        <div className="mt-1 text-lg text-gray-600">{pct}%</div>
        {minutes !== null && <div className="mt-2 text-sm text-gray-500">Finished in {minutes} min</div>}
      </div>

      <ul className="mb-8 space-y-2">
        {[...bySubject.entries()].map(([subject, s]) => (
          <li key={subject} className="flex justify-between rounded-lg border border-gray-200 px-4 py-2">
            <span>{subjectLabel(subject)}</span>
            <span className="font-medium">
              {s.correct} / {s.total}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-6">
        <Link href="/leaderboard" className="font-medium text-blue-700 underline">
          See the leaderboard
        </Link>
        <Link href="/" className="text-blue-700 underline">
          Back home
        </Link>
      </div>
    </main>
  );
}