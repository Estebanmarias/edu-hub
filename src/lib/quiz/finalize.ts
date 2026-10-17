import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Close a session: score = number of correct answers. Unanswered questions count as wrong. */
export async function finalizeSession(admin: SupabaseClient, sessionId: string, deadlineISO: string) {
  const { count } = await admin
    .from("session_questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("is_correct", true);
  const finishedAt = new Date(Math.min(Date.now(), Date.parse(deadlineISO))).toISOString();
  await admin
    .from("quiz_sessions")
    .update({ status: "submitted", score: count ?? 0, finished_at: finishedAt })
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
    .select("id, deadline, started_at")
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
  return s as { id: string; deadline: string; started_at: string };
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