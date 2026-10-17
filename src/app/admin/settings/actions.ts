"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/session";

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await assertAdmin();
  const questions = Number(formData.get("questionsPerSubject"));
  const minutes = Number(formData.get("durationMinutes"));

  if (!Number.isInteger(questions) || questions < 5 || questions > 100)
    return { error: "Questions per subject must be a whole number from 5 to 100." };
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240)
    return { error: "Time must be a whole number of minutes from 5 to 240." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("quiz_settings")
    .upsert({ id: true, questions_per_subject: questions, duration_minutes: minutes });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: "Saved. It applies to quizzes started from now on; quizzes already running keep their own settings." };
}