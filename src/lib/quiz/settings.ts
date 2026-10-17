import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuizSettings = { questionsPerSubject: number; durationMinutes: number };
export const DEFAULT_SETTINGS: QuizSettings = { questionsPerSubject: 25, durationMinutes: 40 };

export async function getQuizSettings(): Promise<QuizSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("quiz_settings")
    .select("questions_per_subject, duration_minutes")
    .eq("id", true)
    .maybeSingle();
  return data
    ? { questionsPerSubject: data.questions_per_subject, durationMinutes: data.duration_minutes }
    : DEFAULT_SETTINGS;
}