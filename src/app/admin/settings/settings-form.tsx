"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";

export default function SettingsForm({
  questionsPerSubject,
  durationMinutes,
  subjectsPerQuiz,
}: {
  questionsPerSubject: number;
  durationMinutes: number;
  subjectsPerQuiz: number;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, undefined);
  const [q, setQ] = useState(String(questionsPerSubject));
  const [m, setM] = useState(String(durationMinutes));

  const totalQuestions = Number(q) * subjectsPerQuiz;
  const secondsEach = totalQuestions > 0 ? Math.round((Number(m) * 60) / totalQuestions) : 0;

  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Questions per subject</label>
        <input
          name="questionsPerSubject"
          type="number"
          min={5}
          max={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Time for the whole quiz (minutes)</label>
        <input
          name="durationMinutes"
          type="number"
          min={5}
          max={240}
          value={m}
          onChange={(e) => setM(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <p className="text-sm text-gray-600">
        {subjectsPerQuiz} subjects x {q || 0} questions = {totalQuestions || 0} questions, about {secondsEach} seconds
        per question.
        {secondsEach > 0 && secondsEach < 15 && <span className="text-amber-700"> That is very tight.</span>}
      </p>
      <button disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60">
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}