import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";

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
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-1 text-2xl font-bold">Study</h1>
      <p className="mb-6 text-gray-600">Practise with no timer. You see the answer and the reason after every question.</p>

      {subjects.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No subjects are ready yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => (
            <Link
              key={s.subject}
              href={`/study/${s.subject}`}
              className="rounded-xl border border-gray-200 px-4 py-4 hover:border-blue-600"
            >
              <div className="font-semibold">{subjectLabel(s.subject)}</div>
              <div className="text-sm text-gray-500">{s.n} questions</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/" className="text-blue-700 underline">
          Back home
        </Link>
      </div>
    </main>
  );
}