import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectLabel } from "@/lib/quiz/config";
import { currentSession } from "@/lib/quiz/finalize";
import Runner, { type Item } from "./runner";

export default async function SessionPage() {
  const profile = await requireProfile();
  if (profile.role !== "student") redirect("/");

  const admin = createAdminClient();
  const session = await currentSession(admin, profile.id);
  if (!session) redirect("/quiz");

  const { data: rows } = await admin
    .from("session_questions")
    .select("id, position, subject, question_id, option_order, chosen_option")
    .eq("session_id", session.id)
    .order("position");
  if (!rows?.length) redirect("/quiz");

  const { data: qs } = await admin
    .from("questions")
    .select("id, stem, options")
    .in("id", rows.map((r) => r.question_id));
  const byId = new Map((qs ?? []).map((q) => [q.id as string, q]));

  // numbered within each subject, in the order the subjects were chosen (JAMB style)
  const order = session.subjects?.length ? session.subjects : [...new Set(rows.map((r) => r.subject as string))];
  const counters = new Map<string, number>();
  const items: Item[] = [];
  for (const subject of order) {
    for (const r of rows.filter((x) => x.subject === subject)) {
      const q = byId.get(r.question_id);
      if (!q) continue;
      const texts = new Map((q.options as { id: string; text: string }[]).map((o) => [o.id, o.text]));
      const n = (counters.get(subject) ?? 0) + 1;
      counters.set(subject, n);
      items.push({
        rowId: r.id,
        subject,
        number: n,
        stem: q.stem,
        options: (r.option_order as string[]).map((id) => ({ id, text: texts.get(id) ?? "" })),
        chosen: r.chosen_option ?? null,
      });
    }
  }

  return (
    <Runner
      items={items}
      subjects={order.map((s: string) => ({ key: s, label: subjectLabel(s) }))}
      deadline={session.deadline}
      serverNow={new Date().toISOString()}
      candidate={profile.display_name}
    />
  );
}