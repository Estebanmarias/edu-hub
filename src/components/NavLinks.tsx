"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/quiz", label: "Quiz", icon: "📝" },
  { href: "/study", label: "Study", icon: "📚" },
  { href: "/leaderboard", label: "Board", icon: "🏆" },
];

export default function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  if (mobile) {
    return (
      <ul className="flex">
        {ITEMS.map((i) => (
          <li key={i.href} className="flex-1">
            <Link
              href={i.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active(i.href) ? "text-brand-700" : "text-ink/55"}`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full text-lg ${active(i.href) ? "bg-brand-100" : ""}`}>
                {i.icon}
              </span>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${active(i.href) ? "bg-white text-brand-800" : "text-white hover:bg-brand-600"}`}
        >
          {i.label}
        </Link>
      ))}
    </>
  );
}