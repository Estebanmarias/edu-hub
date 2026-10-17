"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/session";
import { USERNAME_RE, usernameToEmail } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

const MIN_PASSWORD = 6; // Supabase's default minimum

/** Every action re-checks that the caller is an admin: the UI hiding a form is not security. */
async function callerIsAdmin() {
  const me = await getProfile();
  return me?.role === "admin";
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await callerIsAdmin())) return { error: "Admins only." };

  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "student");
  const level = String(formData.get("level") ?? "");

  if (!displayName) return { error: "Enter a name." };
  if (!USERNAME_RE.test(username))
    return { error: "Username must be 3-20 characters: letters, numbers, dot, dash or underscore." };
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (role !== "student" && role !== "admin") return { error: "Pick a role." };
  if (role === "student" && level !== "JSS" && level !== "SS") return { error: "Pick JSS or SS for a student." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true, // no email is ever sent
  });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { error: taken ? "That username is taken." : (error?.message ?? "Could not create the account.") };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    username,
    display_name: displayName,
    role,
    level: role === "student" ? level : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id); // don't leave a login without a profile
    return { error: `Could not save the profile: ${profileError.message}` };
  }

  revalidatePath("/admin/students");
  return { ok: `Created ${username}. Give them this username and the password you set.` };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await callerIsAdmin())) return { error: "Admins only." };

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId) return { error: "Missing account." };
  if (password.length < MIN_PASSWORD) return { error: `At least ${MIN_PASSWORD} characters.` };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { ok: "Password changed." };
}
