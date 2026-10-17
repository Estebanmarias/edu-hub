"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/session";
import {
  COMPULSORY,
  ELECTIVE_COUNT,
  RECENT_DAYS,
  difficultyMix,
  lagosDate,
  lagosDaysAgo,
  subjectLabel,
} from "@/lib/quiz/config";
import { getQuizSettings } from "@/lib/quiz/settings";
import { currentSession } from "@/lib/quiz/finalize";
import { pickQuestions, shuffle, type Candidate } from "@/lib/quiz/pick";

export type StartState = { error?: string } | undefined;

export async function startQuiz(_prev: StartState, formData: FormData): Promise<StartState> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "student" || !profile.level) return { error: "Only students can take the quiz." };

  const electives = [...new Set(formData.getAll("electives").map(String))];
  if (electives.length !== ELECTIVE_COUNT) return { error: `Pick exactly ${ELECTIVE_COUNT} subjects.` };
  if (electives.some((s) => (COMPULSORY as readonly string[]).includes(s)))
    return { error: "Maths and English are already included." };
  const subjects = [...COMPULSORY, ...electives];

  const admin = createAdminClient(); // students can't read questions; the server picks them
  const today = lagosDate();
  const settings = await getQuizSettings();
  const perSubject = settings.questionsPerSubject;

  // A quiz already running (even one started before midnight)?
  if (await currentSession(admin, profile.id)) redirect("/quiz/session");

  // One quiz per Lagos day. The database also enforces this with a unique constraint.
  const { data: existing } = await admin
    .from("quiz_sessions")
    .select("id, status")
    .eq("user_id", profile.id)
    .eq("quiz_date", today)
    .maybeSingle();
  if (existing) redirect("/quiz/result");

  // Questions the student saw recently
  const { data: recentSessions } = await admin
    .from("quiz_sessions")
    .select("id")
    .eq("user_id", profile.id)
    .gte("quiz_date", lagosDaysAgo(RECENT_DAYS));
  const sessionIds = (recentSessions ?? []).map((s) => s.id);
  const seen = new Set<string>();
  if (sessionIds.length) {
    const { data: seenRows } = await admin.from("session_questions").select("question_id").in("session_id", sessionIds);
    for (const r of seenRows ?? []) seen.add(r.question_id);
  }

  // Pick questions per subject
  const rows: {
    question_id: string;
    subject: string;
    position: number;
    option_order: string[];
  }[] = [];
  let position = 1;
  for (const subject of subjects) {
    const { data: pool } = await admin
      .from("questions")
      .select("id, difficulty, options")
      .eq("status", "approved")
      .eq("level", profile.level)
      .eq("subject", subject)
      .limit(5000);
    if (!pool || pool.length < perSubject) {
      return { error: `Not enough ${subjectLabel(subject)} questions yet for your level.` };
    }
    const optionIds = new Map(pool.map((q) => [q.id as string, (q.options as { id: string }[]).map((o) => o.id)]));
    const ids = pickQuestions(pool as Candidate[], seen, difficultyMix(perSubject), perSubject);
    for (const id of ids) {
      rows.push({ question_id: id, subject, position: position++, option_order: shuffle(optionIds.get(id)!) });
    }
  }

  const startedAt = new Date();
  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .insert({
      user_id: profile.id,
      quiz_date: today,
      subjects,
      started_at: startedAt.toISOString(),
      deadline: new Date(startedAt.getTime() + settings.durationMinutes * 60_000).toISOString(),
      status: "in_progress",
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    // Unique violation = a double click or a second tab already started today's quiz
    if (sessionError?.code === "23505") redirect("/quiz/session");
    return { error: "Could not start the quiz. Try again." };
  }

  const { error: rowsError } = await admin
    .from("session_questions")
    .insert(rows.map((r) => ({ ...r, session_id: session.id })));
  if (rowsError) {
    await admin.from("quiz_sessions").delete().eq("id", session.id); // let the student retry
    return { error: "Could not prepare your questions. Try again." };
  }

  redirect("/quiz/session");
}