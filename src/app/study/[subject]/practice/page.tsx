import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { subjectLabel } from "@/lib/quiz/config";
import StudentShell from "@/components/StudentShell";
import StudyRunner from "./runner";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ topic?: string; n?: string }>;
}) {
  const { subject } = await params;
  const { topic = "", n } = await searchParams;
  const profile = await requireProfile();
  if (profile.role !== "student" || !profile.level) redirect("/");

  return (
    <StudentShell name={profile.display_name}>
      <StudyRunner subject={subject} subjectName={subjectLabel(subject)} topic={topic} count={Number(n) || 10} />
    </StudentShell>
  );
}