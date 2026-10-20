import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Grade a session, then close it. Unanswered questions count as wrong. Safe to call twice. */
export async function finalizeSession(admin: SupabaseClient, sessionId: string, deadlineISO: string) {
  const { data: rows } = await admin
    .from("session_questions")
    .select("id, question_id, chosen_option")
    .eq("session_id", sessionId);
  const list = rows ?? [];

  const { data: keys } = list.length
    ? await admin.from("question_answers").select("question_id, correct_option").in("question_id", list.map((r) => r.question_id))
    : { data: [] as { question_id: string; correct_option: string }[] };
  const keyOf = new Map((keys ?? []).map((k) => [k.question_id, k.correct_option]));

  const right: string[] = [];
  const wrong: string[] = [];
  for (const r of list) {
    (r.chosen_option && keyOf.get(r.question_id) === r.chosen_option ? right : wrong).push(r.id);
  }
  if (right.length) await admin.from("session_questions").update({ is_correct: true }).in("id", right);
  if (wrong.length) await admin.from("session_questions").update({ is_correct: false }).in("id", wrong);

  const finishedAt = new Date(Math.min(Date.now(), Date.parse(deadlineISO))).toISOString();
  await admin
    .from("quiz_sessions")
    .update({ status: "submitted", score: right.length, finished_at: finishedAt })
    .eq("id", sessionId)
    .eq("status", "in_progress");
}

/**
 * The student's running quiz, if any. If its time has run out it is closed here and null is returned,
 * so an abandoned quiz is scored the next time the student (or the leaderboard) looks.
 */
export async function currentSession(admin: SupabaseClient, userId: string) {
  const { data: s } = await admin
    .from("quiz_sessions")
    .select("id, deadline, started_at, subjects")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!s) return null;
  if (Date.now() >= Date.parse(s.deadline)) {
    await finalizeSession(admin, s.id, s.deadline);
    return null;
  }
  return s as { id: string; deadline: string; started_at: string; subjects: string[] };
}

/** Score every quiz whose time has run out, even if the student never came back to it. */
export async function finalizeOverdue(admin: SupabaseClient) {
  const { data } = await admin
    .from("quiz_sessions")
    .select("id, deadline")
    .eq("status", "in_progress")
    .lt("deadline", new Date().toISOString());
  for (const s of data ?? []) await finalizeSession(admin, s.id, s.deadline);
}