import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { subjectEmoji } from "@/lib/quiz/subjects";
import StudentShell from "@/components/StudentShell";

export default async function StudySubject({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const profile = await requireProfile();
  if (profile.role !== "student" || !profile.level) redirect("/");

  const admin = createAdminClient();
  const { data } = await admin
    .from("questions")
    .select("topic")
    .eq("status", "approved")
    .eq("level", profile.level)
    .eq("subject", subject)
    .limit(5000);
  if (!data?.length) notFound();

  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
  const topics = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <StudentShell name={profile.display_name}>
      <Link href="/study" className="text-sm font-semibold text-brand-700">
        &larr; All subjects
      </Link>
      <h1 className="mb-5 mt-2 flex items-center gap-3 text-2xl font-extrabold text-brand-800">
        <span className="text-4xl">{subjectEmoji(subject)}</span>
        {subjectLabel(subject)}
      </h1>

      <form action={`/study/${subject}/practice`} method="get" className="space-y-5 rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-semibold">Topic</label>
          <select name="topic" defaultValue="" className="w-full rounded-xl border-2 border-brand-100 bg-white px-4 py-2.5 outline-none focus:border-brand-400">
            <option value="">All topics ({data.length} questions)</option>
            {topics.map(([t, n]) => (
              <option key={t} value={t}>
                {t} ({n})
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">How many questions?</legend>
          <div className="flex gap-3">
            {["10", "20", "30"].map((n) => (
              <label key={n} className="flex-1">
                <input type="radio" name="n" value={n} defaultChecked={n === "10"} className="peer sr-only" />
                <span className="block cursor-pointer rounded-xl border-2 border-brand-100 py-2.5 text-center font-bold peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="w-full rounded-xl bg-brand-600 px-5 py-3 text-lg font-bold text-white hover:bg-brand-700">Start practising</button>
      </form>
    </StudentShell>
  );
}