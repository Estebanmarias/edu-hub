import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { signOut } from "./login/actions";

export default async function Home() {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin/students");

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Hi, {profile.display_name}</h1>
      <Link href="/quiz" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white">
        Daily quiz
      </Link>
      <Link href="/study" className="ml-3 mt-6 inline-block rounded-lg border border-gray-300 px-5 py-2.5 font-medium">
        Study
      </Link>
      <Link href="/leaderboard" className="ml-3 mt-6 inline-block rounded-lg border border-gray-300 px-5 py-2.5 font-medium">
        Leaderboard
      </Link>
      <form action={signOut} className="mt-8">
        <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Sign out</button>
      </form>
    </main>
  );
}