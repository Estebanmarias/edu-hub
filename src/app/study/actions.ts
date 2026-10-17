"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/session";
import { currentSession } from "@/lib/quiz/finalize";
import { shuffle } from "@/lib/quiz/pick";
import { weightFor, weightedSample, type Hist } from "@/lib/study";

type Option = { id: string; text: string };
export type StudyQuestion = { id: string; stem: string; topic: string; difficulty: number; options: Option[] };
export type StartResult = { questions: StudyQuestion[] } | { error: string };
export type AnswerResult = { correct: boolean; correctOption: string; explanation: string | null } | { error: string };

const QUIZ_RUNNING = "Finish your daily quiz first, then come back to practise.";

/** Pick a practice set. Questions you keep getting right show up less; ones you got wrong come back sooner. */
export async function startPractice(subject: string, topic: string, count: number): Promise<StartResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "student" || !profile.level) return { error: "Only students can practise." };
  const n = [10, 20, 30].includes(count) ? count : 10;

  const admin = createAdminClient();
  if (await currentSession(admin, profile.id)) return { error: QUIZ_RUNNING };

  let query = admin
    .from("questions")
    .select("id, topic, difficulty, stem, options")
    .eq("status", "approved")
    .eq("level", profile.level)
    .eq("subject", subject)
    .limit(5000);
  if (topic) query = query.eq("topic", topic);
  const { data: pool } = await query;
  if (!pool?.length) return { error: "There are no questions here yet." };

  // what this student already knows, from practice and from daily quizzes
  const { data: rows } = await admin
    .from("user_question_history")
    .select("question_id, is_correct, at")
    .eq("user_id", profile.id)
    .order("at", { ascending: false })
    .limit(5000);
  const history = new Map<string, Hist[]>();
  for (const r of rows ?? []) {
    const list = history.get(r.question_id) ?? [];
    list.push({ is_correct: r.is_correct, at: r.at });
    history.set(r.question_id, list);
  }

  const picked = weightedSample(pool, (q) => weightFor(history.get(q.id) ?? []), n);
  return {
    questions: picked.map((q) => ({
      id: q.id as string,
      stem: q.stem as string,
      topic: q.topic as string,
      difficulty: q.difficulty as number,
      options: shuffle(q.options as Option[]),
    })),
  };
}

/** Grade one answer on the server, remember it, and reveal the key and the explanation. */
export async function submitAnswer(questionId: string, option: string): Promise<AnswerResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "student" || !profile.level) return { error: "Only students can practise." };

  const admin = createAdminClient();
  // while a daily quiz is running, practice mode must not reveal answers
  if (await currentSession(admin, profile.id)) return { error: QUIZ_RUNNING };

  const { data: q } = await admin
    .from("questions")
    .select("level, status, explanation, options")
    .eq("id", questionId)
    .maybeSingle();
  if (!q || q.status !== "approved" || q.level !== profile.level) return { error: "Question not found." };
  if (!(q.options as Option[]).some((o) => o.id === option)) return { error: "Pick one of the options." };

  const { data: key } = await admin.from("question_answers").select("correct_option").eq("question_id", questionId).maybeSingle();
  if (!key) return { error: "Question not found." };

  const correct = key.correct_option === option;
  await admin.from("study_attempts").insert({
    user_id: profile.id,
    question_id: questionId,
    chosen_option: option,
    is_correct: correct,
  });
  return { correct, correctOption: key.correct_option, explanation: q.explanation ?? null };
}