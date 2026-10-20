"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/session";
import { currentSession, finalizeSession } from "@/lib/quiz/finalize";

export type SaveResult = { ok: true } | { error: string };

async function context() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const admin = createAdminClient();
  const session = await currentSession(admin, profile.id);
  return { profile, admin, session };
}

/**
 * Remember the student's choice for one question (or clear it with null).
 * Nothing is graded here: grading happens when the quiz is submitted, so students can change their minds.
 */
export async function saveAnswer(rowId: string, option: string | null): Promise<SaveResult> {
  const { admin, session } = await context();
  if (!session) return { error: "Time is up." };

  const { data: row } = await admin
    .from("session_questions")
    .select("id, option_order")
    .eq("id", rowId)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!row) return { error: "Question not found." };
  if (option !== null && !(row.option_order as string[]).includes(option)) return { error: "Pick one of the options." };

  const { error } = await admin
    .from("session_questions")
    .update({ chosen_option: option, answered_at: option ? new Date().toISOString() : null })
    .eq("id", rowId)
    .eq("session_id", session.id);
  return error ? { error: "Could not save." } : { ok: true };
}

export async function finishQuiz(): Promise<void> {
  const { admin, session } = await context();
  if (session) await finalizeSession(admin, session.id, session.deadline);
  redirect("/quiz/result");
}

/** Anti-cheat log: when the student leaves or returns to the quiz tab. Flagged for you, never an automatic penalty. */
export async function logEvent(kind: string): Promise<void> {
  if (kind !== "tab_hidden" && kind !== "tab_visible") return;
  const { profile, admin, session } = await context();
  if (!session) return;
  await admin.from("events").insert({ session_id: session.id, user_id: profile.id, kind });
}