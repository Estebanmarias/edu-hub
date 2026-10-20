import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getProfile()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-brand-100 to-mist px-6 py-10">
      <LoginForm notice={error === "noprofile" ? "Your account isn't set up yet. Ask the admin to finish it." : undefined} />
    </main>
  );
}