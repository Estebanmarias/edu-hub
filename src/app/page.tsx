import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lagosDate } from "@/lib/quiz/config";
import { currentSession } from "@/lib/quiz/finalize";
import { currentStreak } from "@/lib/streak";
import Mascot from "@/components/mascot/Mascot";
import StudentShell from "@/components/StudentShell";

export default async function Home() {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin/students");

  const admin = createAdminClient();
  const running = await currentSession(admin, profile.id);
  const { data: sessions } = await admin
    .from("quiz_sessions")
    .select("quiz_date, score, total_questions")
    .eq("user_id", profile.id)
    .eq("status", "submitted")
    .order("quiz_date", { ascending: false })
    .limit(60);

  const today = lagosDate();
  const list = sessions ?? [];
  const doneToday = list.find((s) => s.quiz_date === today);
  const streak = currentStreak(list.map((s) => s.quiz_date as string), today);
  const last = list[0];
  const lastPct = last?.total_questions ? Math.round(((last.score ?? 0) / last.total_questions) * 100) : null;

  const mood = running ? "thinking" : doneToday ? "celebrate" : "happy";
  const headline = running
    ? "Your quiz is waiting for you!"
    : doneToday
      ? "Today's quiz is done. Great work!"
      : "Ready for today's quiz?";
  const cta = running
    ? { href: "/quiz/session", label: "Continue quiz" }
    : doneToday
      ? { href: "/quiz/result", label: "See my result" }
      : { href: "/quiz", label: "Start today's quiz" };

  return (
    <StudentShell name={profile.display_name}>
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white shadow-lg md:p-8">
        <div className="relative z-10 max-w-[65%]">
          <p className="text-brand-100">Hi, {profile.display_name}!</p>
          <h1 className="mb-4 mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{headline}</h1>
          <Link
            href={cta.href}
            className="inline-block rounded-xl bg-sun-400 px-5 py-3 font-bold text-ink shadow hover:bg-sun-300"
          >
            {cta.label}
          </Link>
        </div>
        <div className="absolute bottom-2 right-2 md:right-8">
          <Mascot mood={mood} size={140} />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="text-3xl">🔥</div>
          <div className="mt-1 text-2xl font-extrabold">{streak}</div>
          <div className="text-sm text-ink/60">day{streak === 1 ? "" : "s"} in a row</div>
        </div>
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="text-3xl">🎯</div>
          <div className="mt-1 text-2xl font-extrabold">{lastPct === null ? "-" : `${lastPct}%`}</div>
          <div className="text-sm text-ink/60">last quiz score</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/study" className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-400">
          <div className="text-3xl">📚</div>
          <div className="mt-2 text-lg font-bold">Study</div>
          <div className="text-sm text-ink/60">Practise with no timer. See the answer and the reason.</div>
        </Link>
        <Link href="/leaderboard" className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-400">
          <div className="text-3xl">🏆</div>
          <div className="mt-2 text-lg font-bold">Leaderboard</div>
          <div className="text-sm text-ink/60">See how you compare with everyone else.</div>
        </Link>
      </div>
    </StudentShell>
  );
}