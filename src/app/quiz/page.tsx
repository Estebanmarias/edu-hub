import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPULSORY, ELECTIVE_COUNT, lagosDate, subjectLabel } from "@/lib/quiz/config";
import { getQuizSettings } from "@/lib/quiz/settings";
import { currentSession } from "@/lib/quiz/finalize";
import { subjectEmoji } from "@/lib/quiz/subjects";
import StudentShell from "@/components/StudentShell";
import StartForm from "./start-form";

export default async function QuizHome() {
  const profile = await requireProfile();
  if (profile.role !== "student" || !profile.level) redirect("/");

  const admin = createAdminClient();
  const settings = await getQuizSettings();

  if (await currentSession(admin, profile.id)) {
    return (
      <Shell name={profile.display_name}>
        <p className="mb-4">You have a quiz in progress.</p>
        <Link href="/quiz/session" className="inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">
          Continue quiz
        </Link>
      </Shell>
    );
  }

  const { data: today } = await admin
    .from("quiz_sessions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("quiz_date", lagosDate())
    .maybeSingle();
  if (today) {
    return (
      <Shell name={profile.display_name}>
        <p className="mb-4">You&apos;ve done today&apos;s quiz. Come back tomorrow.</p>
        <Link href="/quiz/result" className="inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">
          See my result
        </Link>
      </Shell>
    );
  }

  // Subjects with enough approved questions at this student's level
  const { data: counts } = await admin.from("subject_availability").select("subject, n").eq("level", profile.level);
  const ready = new Set(
    (counts ?? []).filter((c) => c.n >= settings.questionsPerSubject).map((c) => c.subject as string),
  );

  const missing = COMPULSORY.filter((s) => !ready.has(s));
  const electives = [...ready]
    .filter((s) => !(COMPULSORY as readonly string[]).includes(s))
    .sort()
    .map((s) => ({ value: s, label: subjectLabel(s), emoji: subjectEmoji(s) }));

  return (
    <Shell name={profile.display_name}>
      <p className="mb-5 text-ink/70">
        {COMPULSORY.map(subjectLabel).join(" and ")} are compulsory, plus {ELECTIVE_COUNT} subjects you choose.{" "}
        {settings.questionsPerSubject} questions each, {settings.durationMinutes} minutes in total. You can only take
        it once a day.
      </p>
      {missing.length > 0 ? (
        <p className="rounded-xl bg-sun-300/50 p-4 text-sm">
          The quiz opens once {missing.map(subjectLabel).join(" and ")} questions are ready.
        </p>
      ) : electives.length < ELECTIVE_COUNT ? (
        <p className="rounded-xl bg-sun-300/50 p-4 text-sm">Not enough other subjects are ready yet.</p>
      ) : (
        <StartForm electives={electives} count={ELECTIVE_COUNT} />
      )}
    </Shell>
  );
}

function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <StudentShell name={name}>
      <h1 className="mb-4 text-2xl font-extrabold text-brand-800">Daily quiz</h1>
      <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm md:p-6">{children}</div>
    </StudentShell>
  );
}