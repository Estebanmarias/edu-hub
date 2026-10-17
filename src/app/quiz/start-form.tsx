"use client";

import { useActionState } from "react";
import { startQuiz, type StartState } from "./actions";

export default function StartForm({
  electives,
  count,
}: {
  electives: { value: string; label: string }[];
  count: number;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startQuiz, undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm font-medium">Choose {count} subjects for today:</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {electives.map((s) => (
          <label key={s.value} className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2">
            <input type="checkbox" name="electives" value={s.value} className="h-4 w-4" />
            {s.label}
          </label>
        ))}
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Preparing your quiz..." : "Start quiz"}
      </button>
    </form>
  );
}