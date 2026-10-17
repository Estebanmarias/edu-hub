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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Edu Hub</h1>
      <p className="mb-6 text-sm text-gray-600">Sign in to study and take your quiz.</p>
      {error === "noprofile" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Your account isn&apos;t set up yet. Ask the admin to finish it.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
