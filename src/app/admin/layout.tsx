import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { signOut } from "../login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
        <nav className="flex items-center gap-5 text-sm font-medium">
          <span className="text-lg font-bold">Edu Hub admin</span>
          <Link href="/admin/review" className="text-blue-700">
            Review
          </Link>
          <Link href="/admin/students" className="text-blue-700">
            Students
          </Link>
          <Link href="/leaderboard" className="text-blue-700">
            Leaderboard
          </Link>
        </nav>
        <form action={signOut} className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{admin.display_name}</span>
          <button className="rounded-lg border border-gray-300 px-3 py-1.5">Sign out</button>
        </form>
      </header>
      {children}
    </div>
  );
}