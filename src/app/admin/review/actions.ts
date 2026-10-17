"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/session";

const STATUSES = ["verified", "approved", "rejected"] as const;

export async function setStatus(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(STATUSES as readonly string[]).includes(status)) throw new Error("Bad request.");

  const supabase = await createClient();
  const { error } = await supabase.from("questions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}

/** Save edits to the wording, difficulty and answer key. The "approve" button saves and approves in one go. */
export async function saveEdits(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const stem = String(formData.get("stem") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const difficulty = Number(formData.get("difficulty"));
  const correct = String(formData.get("correct") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  if (!id) throw new Error("Bad request.");
  if (stem.length < 10) throw new Error("The question text is too short.");
  if (![1, 2, 3].includes(difficulty)) throw new Error("Difficulty must be 1, 2 or 3.");

  const supabase = await createClient();
  const { data: q, error: readError } = await supabase.from("questions").select("options").eq("id", id).single();
  if (readError || !q) throw new Error("Question not found.");
  const ids = (q.options as { id: string }[]).map((o) => o.id);
  if (!ids.includes(correct)) throw new Error("The answer key must be one of the options.");

  const update: Record<string, unknown> = { stem, explanation: explanation || null, difficulty };
  if (intent === "approve") update.status = "approved";

  const { error: qError } = await supabase.from("questions").update(update).eq("id", id);
  if (qError) throw new Error(qError.message);
  const { error: aError } = await supabase.from("question_answers").update({ correct_option: correct }).eq("question_id", id);
  if (aError) throw new Error(aError.message);

  revalidatePath("/admin/review");
}


/** Approve every waiting question for one subject and level. Use it after reviewing a random sample. */
export async function approveAll(formData: FormData): Promise<void> {
  await assertAdmin();
  const subject = String(formData.get("subject") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!subject || (level !== "JSS" && level !== "SS")) throw new Error("Pick a subject and a level first.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ status: "approved" })
    .eq("status", "verified")
    .eq("subject", subject)
    .eq("level", level);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}