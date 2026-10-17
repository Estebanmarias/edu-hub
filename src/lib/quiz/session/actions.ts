"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/session";
import { MIN_ANSWER_MS } from "@/lib/quiz/config";
import { currentSession, finalizeSession } from "@/lib/quiz/finalize";

export type AnswerState = { error?: string } | undefined;

async function context() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const admin = createAdminClient();
  const session = await currentSession(admin, profile.id);
  return { profile, admin, session };
}

/** Record an answer (or a skip). All checks happen here on the server: the browser is not trusted. */
export async function answerQuestion(_prev: AnswerState, formData: FormData): Promise<AnswerState> {
  const rowId = String(formData.get("rowId") ?? "");
  const option = String(formData.get("option") ?? "");
  const skip = String(formData.get("intent") ?? "") === "skip";

  const { profile, admin, session } = await context();
  if (!session) redirect("/quiz/result"); // time ran out

  const { data: row } = await admin
    .from("session_questions")
    .select("id, session_id, question_id, option_order, served_at, answered_at")
    .eq("id", rowId)
    .maybeSingle();
  if (!row || row.session_id !== session.id) return { error: "Question not found." };
  if (row.answered_at) redirect("/quiz/session");

  // Only the current question can be answered: the lowest-numbered unanswered one
  const { data: first } = await admin
    .from("session_questions")
    .select("id")
    .eq("session_id", session.id)
    .is("answered_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (first?.id !== row.id) redirect("/quiz/session");

  const elapsed = row.served_at ? Date.now() - Date.parse(row.served_at) : 0;
  if (elapsed < MIN_ANSWER_MS) {
    await admin.from("events").insert({
      session_id: session.id,
      user_id: profile.id,
      kind: "too_fast",
      question_id: row.question_id,
      meta: { elapsed_ms: elapsed },
    });
    return { error: "Take a moment to read the question." };
  }

  let chosen: string | null = null;
  let correct = false;
  if (!skip) {
    if (!(row.option_order as string[]).includes(option)) return { error: "Pick one of the options." };
    chosen = option;
    const { data: key } = await admin
      .from("question_answers")
      .select("correct_option")
      .eq("question_id", row.question_id)
      .single();
    correct = key?.correct_option === option;
  }

  // `is answered_at null` makes a double click or a second tab harmless: only one write can win
  await admin
    .from("session_questions")
    .update({ answered_at: new Date().toISOString(), chosen_option: chosen, is_correct: correct, time_ms: elapsed })
    .eq("id", row.id)
    .is("answered_at", null);

  redirect("/quiz/session");
}

export async function finishQuiz(): Promise<void> {
  const { admin, session } = await context();
  if (session) await finalizeSession(admin, session.id, session.deadline);
  redirect("/quiz/result");
}

/** Anti-cheat log: when the student leaves or returns to the quiz tab. Flagged for you, never an automatic penalty. */
export async function logEvent(kind: string, rowId?: string): Promise<void> {
  if (kind !== "tab_hidden" && kind !== "tab_visible") return;
  const { profile, admin, session } = await context();
  if (!session) return;
  await admin.from("events").insert({
    session_id: session.id,
    user_id: profile.id,
    kind,
    meta: rowId ? { row: rowId } : null,
  });
}