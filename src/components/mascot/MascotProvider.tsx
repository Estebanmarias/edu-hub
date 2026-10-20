"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Mascot, { type Mood } from "./Mascot";

export const MASCOT_NAME = "Buddy"; // change this to your cousin's name for the toy

type Say = (message: string, mood?: Mood, ms?: number) => void;
const Ctx = createContext<{ say: Say }>({ say: () => {} });

/** Any page can make the bird talk: const { say } = useMascot(); say("Great job!", "celebrate") */
export const useMascot = () => useContext(Ctx);

const CHATTER = [
  "Hi! Ready to learn something new?",
  "You've got this!",
  "Tip: read every option before you choose.",
  "Small steps every day add up!",
  "Mistakes are how brains grow.",
  "Quick stretch? Then back to it!",
];

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mood, setMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [wiggle, setWiggle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback<Say>((message, m = "happy", ms = 4500) => {
    setBubble(message);
    setMood(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setBubble(null);
      setMood("idle");
    }, ms);
  }, []);

  // the bird goes back to idle when you move to another page
  useEffect(() => {
    setBubble(null);
    setMood("idle");
  }, [pathname]);

  const poke = () => {
    setWiggle(true);
    setTimeout(() => setWiggle(false), 600);
    say(CHATTER[Math.floor(Math.random() * CHATTER.length)], "happy");
  };

  const value = useMemo(() => ({ say }), [say]);
  const hidden = pathname === "/" || pathname.startsWith("/login") || pathname === "/quiz/result"; // these pages have their own big bird
  const compact = pathname.startsWith("/quiz/session"); // keep out of the way during the exam

  return (
    <Ctx.Provider value={value}>
      {children}
      {!hidden && (
        <div
          className={`pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-2 ${
            compact ? "bottom-3" : "bottom-20 md:bottom-3"
          }`}
        >
          {bubble && (
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-auto max-w-[15rem] rounded-2xl rounded-br-sm border border-brand-200 bg-white px-4 py-2 text-sm text-ink shadow-lg ${
                compact
                  ? "max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:top-28 max-sm:max-w-none"
                  : "max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:top-20 max-sm:max-w-none"
              }`}
              style={{ animation: "bubble-in .25s ease-out" }}
            >
              {bubble}
            </div>
          )}
          <button
            type="button"
            onClick={poke}
            aria-label={`Say hi to ${MASCOT_NAME}`}
            className={`pointer-events-auto rounded-full transition-transform active:scale-95 ${compact ? "max-sm:hidden" : ""}`}
          >
            <Mascot mood={mood} size={compact ? 56 : 76} wiggle={wiggle} />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}