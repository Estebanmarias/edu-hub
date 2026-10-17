import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";

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

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2";
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{subjectLabel(subject)}</h1>

      <form action={`/study/${subject}/practice`} method="get" className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Topic</label>
          <select name="topic" defaultValue="" className={input}>
            <option value="">All topics ({data.length} questions)</option>
            {topics.map(([t, n]) => (
              <option key={t} value={t}>
                {t} ({n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">How many questions</label>
          <select name="n" defaultValue="10" className={input}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
          </select>
        </div>
        <button className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white">Start practising</button>
      </form>

      <div className="mt-8 text-sm">
        <Link href="/study" className="text-blue-700 underline">
          All subjects
        </Link>
      </div>
    </main>
  );
}