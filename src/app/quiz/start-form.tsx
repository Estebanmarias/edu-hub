"use client";

import { useActionState, useState } from "react";
import { startQuiz, type StartState } from "./actions";

export default function StartForm({
  electives,
  count,
}: {
  electives: { value: string; label: string; emoji: string }[];
  count: number;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startQuiz, undefined);
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(value: string) {
    setPicked((p) => (p.includes(value) ? p.filter((x) => x !== value) : p.length >= count ? p : [...p, value]));
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <p className="mb-2 font-semibold">
          Choose {count} more subjects <span className="text-ink/50">({picked.length}/{count})</span>
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {electives.map((s) => {
            const on = picked.includes(s.value);
            return (
              <label
                key={s.value}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 text-center transition ${
                  on ? "border-brand-500 bg-brand-50 shadow-sm" : "border-brand-100 bg-white hover:border-brand-300"
                }`}
              >
                <input
                  type="checkbox"
                  name="electives"
                  value={s.value}
                  checked={on}
                  onChange={() => toggle(s.value)}
                  className="sr-only"
                />
                <span className="text-3xl">{s.emoji}</span>
                <span className="text-sm font-semibold">{s.label}</span>
                {on && <span className="text-xs font-bold text-brand-600">Chosen ✓</span>}
              </label>
            );
          })}
        </div>
      </div>
      {state?.error && <p className="rounded-lg bg-berry-500/10 p-3 text-sm font-medium text-berry-600">{state.error}</p>}
      <button
        disabled={pending || picked.length !== count}
        className="w-full rounded-xl bg-brand-600 px-5 py-3 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Preparing your quiz..." : "Start quiz"}
      </button>
    </form>
  );
}