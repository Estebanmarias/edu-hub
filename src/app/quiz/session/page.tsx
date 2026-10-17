import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { currentSession, finalizeSession } from "@/lib/quiz/finalize";
import Runner from "./runner";

export default async function SessionPage() {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/");

  const admin = createAdminClient();
  const session = await currentSession(admin, profile.id);
  if (!session) redirect("/quiz");

  const { count: total } = await admin
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);

  const { data: rows } = await admin
    .from("session_questions")
    .select("id, position, subject, question_id, option_order, served_at")
    .eq("session_id", session.id)
    .is("answered_at", null)
    .order("position")
    .limit(1);
  const row = rows?.[0];
  if (!row) {
    // every question answered
    await finalizeSession(admin, session.id, session.deadline);
    redirect("/quiz/result");
  }

  // The clock for this question starts the first time it is shown, and a refresh does not restart it
  let servedAt = row.served_at as string | null;
  if (!servedAt) {
    servedAt = new Date().toISOString();
    await admin.from("session_questions").update({ served_at: servedAt }).eq("id", row.id).is("served_at", null);
  }

  const { data: q } = await admin.from("questions").select("stem, options").eq("id", row.question_id).single();
  if (!q) redirect("/quiz");
  const byId = new Map((q.options as { id: string; text: string }[]).map((o) => [o.id, o.text]));
  const options = (row.option_order as string[]).map((id) => ({ id, text: byId.get(id) ?? "" }));

  return (
    <Runner
      key={row.id}
      rowId={row.id}
      position={row.position}
      total={total ?? 0}
      subject={subjectLabel(row.subject)}
      stem={q.stem}
      options={options}
      deadline={session.deadline}
      serverNow={new Date().toISOString()}
      servedAt={servedAt}
    />
  );
}