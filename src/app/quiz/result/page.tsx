import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { subjectEmoji } from "@/lib/quiz/subjects";
import { currentSession } from "@/lib/quiz/finalize";
import Mascot from "@/components/mascot/Mascot";
import StudentShell from "@/components/StudentShell";

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

  const mood = pct >= 70 ? "celebrate" : pct >= 50 ? "happy" : "thinking";
  const message =
    pct >= 85 ? "Outstanding! You really know your stuff." : pct >= 70 ? "Great job! Keep it up." : pct >= 50 ? "Good effort. Practise a little more and you'll climb." : "Every quiz makes you stronger. Try Study mode and come back tomorrow!";

  return (
    <StudentShell name={profile.display_name}>
      <section className="rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-6 text-center text-white shadow-lg">
        <div className="flex justify-center">
          <Mascot mood={mood} size={130} />
        </div>
        <div className="mt-2 text-6xl font-extrabold">
          {score}
          <span className="text-2xl font-bold text-brand-100"> / {total}</span>
        </div>
        <div className="mt-1 text-xl font-bold text-sun-300">{pct}%</div>
        <p className="mx-auto mt-3 max-w-sm text-brand-50">{message}</p>
        {minutes !== null && <p className="mt-2 text-sm text-brand-100">Finished in {minutes} min</p>}
      </section>

      <h2 className="mb-3 mt-6 font-bold">By subject</h2>
      <ul className="space-y-3">
        {[...bySubject.entries()].map(([subject, s]) => {
          const p = s.total ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <li key={subject} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">
                  <span className="mr-2">{subjectEmoji(subject)}</span>
                  {subjectLabel(subject)}
                </span>
                <span className="font-bold">
                  {s.correct} / {s.total}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-brand-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/leaderboard" className="rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">
          See the leaderboard
        </Link>
        <Link href="/study" className="rounded-xl border-2 border-brand-200 bg-white px-5 py-3 font-bold">
          Practise in Study mode
        </Link>
      </div>
    </StudentShell>
  );
}