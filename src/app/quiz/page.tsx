import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPULSORY, ELECTIVE_COUNT, lagosDate, subjectLabel } from "@/lib/quiz/config";
import { getQuizSettings } from "@/lib/quiz/settings";
import { currentSession } from "@/lib/quiz/finalize";
import StartForm from "./start-form";

export default async function QuizHome() {
  const profile = await requireProfile();
  if (profile.role !== "student" || !profile.level) redirect("/");

  const admin = createAdminClient();
  const settings = await getQuizSettings();

  if (await currentSession(admin, profile.id)) {
    return (
      <Shell>
        <p className="mb-4">You have a quiz in progress.</p>
        <Link href="/quiz/session" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white">
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
      <Shell>
        <p className="mb-4">You&apos;ve done today&apos;s quiz. Come back tomorrow.</p>
        <Link href="/quiz/result" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white">
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
    .map((s) => ({ value: s, label: subjectLabel(s) }));

  return (
    <Shell>
      <p className="mb-6 text-gray-600">
        {COMPULSORY.map(subjectLabel).join(" and ")} are compulsory, plus {ELECTIVE_COUNT} subjects you choose.{" "}
        {settings.questionsPerSubject} questions each, {settings.durationMinutes} minutes in total. You can only take
        it once a day.
      </p>
      {missing.length > 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The quiz opens once {missing.map(subjectLabel).join(" and ")} questions are ready.
        </p>
      ) : electives.length < ELECTIVE_COUNT ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Not enough other subjects are ready yet.</p>
      ) : (
        <StartForm electives={electives} count={ELECTIVE_COUNT} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-4 text-2xl font-bold">Daily quiz</h1>
      {children}
    </main>
  );
}