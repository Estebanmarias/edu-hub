"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/session";

/** Change question status (approve, reject, verified). */
export async function setStatus(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) throw new Error("Bad request.");

  const admin = createAdminClient();
  const { error } = await admin.from("questions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}

/** Save edits to a question (stem, explanation, difficulty, correct option). */
export async function saveEdits(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const stem = String(formData.get("stem") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const difficulty = Number(formData.get("difficulty") ?? 2);
  const correct = String(formData.get("correct") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  if (!id || !stem || !correct) throw new Error("Bad request.");

  const admin = createAdminClient();
  
  const updateData: Record<string, any> = { stem, explanation, difficulty };
  if (intent === "approve") {
    updateData.status = "approved";
  }

  const { error: qErr } = await admin.from("questions").update(updateData).eq("id", id);
  if (qErr) throw new Error(qErr.message);

  const { error: aErr } = await admin
    .from("question_answers")
    .update({ correct_option: correct })
    .eq("question_id", id);
  if (aErr) throw new Error(aErr.message);

  revalidatePath("/admin/review");
}

/** Approve every waiting question for one subject and level. Use it after reviewing a random sample. */
export async function approveAll(formData: FormData): Promise<void> {
  await assertAdmin();
  const subject = String(formData.get("subject") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!subject || (level !== "JSS" && level !== "SS")) throw new Error("Pick a subject and a level first.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("questions")
    .update({ status: "approved" })
    .eq("status", "verified")
    .eq("subject", subject)
    .eq("level", level);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}
