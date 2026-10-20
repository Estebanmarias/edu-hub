import Link from "next/link";
import { signOut } from "@/app/login/actions";
import Mascot from "@/components/mascot/Mascot";
import NavLinks from "./NavLinks";

/** The frame around every student page: top bar, content, and a bottom tab bar on phones. */
export default function StudentShell({
  name,
  children,
  wide = false,
}: {
  name: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-mist pb-24 text-ink md:pb-0">
      <header className="bg-brand-700 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Mascot size={36} animate={false} />
            <span className="text-lg font-extrabold">Edu Hub</span>
          </Link>
          <nav className="ml-6 hidden gap-1 md:flex" aria-label="Main">
            <NavLinks />
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-brand-100 sm:inline">{name}</span>
            <form action={signOut}>
              <button className="rounded-lg bg-brand-800 px-3 py-1.5 hover:bg-brand-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-white md:hidden" aria-label="Main">
        <NavLinks mobile />
      </nav>
    </div>
  );
}