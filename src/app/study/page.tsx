import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { subjectEmoji } from "@/lib/quiz/subjects";
import StudentShell from "@/components/StudentShell";

const MIN_QUESTIONS = 5;

export default async function StudyHome() {
  const profile = await requireProfile();
  if (profile.role !== "student" || !profile.level) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin.from("subject_availability").select("subject, n").eq("level", profile.level);
  const subjects = (data ?? [])
    .filter((s) => s.n >= MIN_QUESTIONS)
    .sort((a, b) => String(a.subject).localeCompare(String(b.subject)));

  return (
    <StudentShell name={profile.display_name}>
      <h1 className="text-2xl font-extrabold text-brand-800">Study</h1>
      <p className="mb-5 text-ink/70">Practise with no timer. You see the answer and the reason after every question.</p>

      {subjects.length === 0 ? (
        <p className="rounded-xl bg-sun-300/50 p-4 text-sm">No subjects are ready yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {subjects.map((s) => (
            <Link
              key={s.subject}
              href={`/study/${s.subject}`}
              className="flex flex-col items-center rounded-2xl border border-brand-200 bg-white px-3 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
            >
              <span className="text-4xl">{subjectEmoji(s.subject as string)}</span>
              <span className="mt-2 font-bold">{subjectLabel(s.subject as string)}</span>
              <span className="text-xs text-ink/55">{s.n} questions</span>
            </Link>
          ))}
        </div>
      )}
    </StudentShell>
  );
}