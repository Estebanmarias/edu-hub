"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MIN_ANSWER_MS } from "@/lib/quiz/config";
import { answerQuestion, finishQuiz, logEvent, type AnswerState } from "./actions";

type Props = {
  rowId: string;
  position: number;
  total: number;
  subject: string;
  stem: string;
  options: { id: string; text: string }[];
  deadline: string;
  serverNow: string;
  servedAt: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Runner(p: Props) {
  const [state, action, pending] = useActionState<AnswerState, FormData>(answerQuestion, undefined);
  const [selected, setSelected] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const offset = useRef(Date.parse(p.serverNow) - Date.now()); // the server's clock is the one that counts
  const finishing = useRef(false);

  // clock, adjusted to the server's time
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset.current);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const remainingMs = now === null ? null : Math.max(0, Date.parse(p.deadline) - now);
  const ready = now !== null && now >= Date.parse(p.servedAt) + MIN_ANSWER_MS;

  // time's up: close the quiz
  useEffect(() => {
    if (remainingMs === 0 && !finishing.current) {
      finishing.current = true;
      void finishQuiz();
    }
  }, [remainingMs]);

  // log when the student leaves or returns to this tab
  useEffect(() => {
    const onChange = () => void logEvent(document.hidden ? "tab_hidden" : "tab_visible", p.rowId);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [p.rowId]);

  const mins = remainingMs === null ? "--" : String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const secs = remainingMs === null ? "--" : String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");
  const low = remainingMs !== null && remainingMs < 5 * 60000;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between text-sm">
        <div>
          <span className="font-medium">{p.subject}</span>
          <span className="ml-3 text-gray-600">
            Question {p.position} of {p.total}
          </span>
        </div>
        <div className={`font-mono text-lg font-semibold ${low ? "text-red-600" : ""}`}>
          {mins}:{secs}
        </div>
      </div>

      <form action={action}>
        <input type="hidden" name="rowId" value={p.rowId} />
        <p className="mb-5 text-lg font-medium">{p.stem}</p>

        <div className="mb-5 space-y-2">
          {p.options.map((o, i) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
                selected === o.id ? "border-blue-600 bg-blue-50" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="option"
                value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
                className="mt-1"
              />
              <span>
                <span className="mr-2 font-mono text-gray-500">{LETTERS[i]}</span>
                {o.text}
              </span>
            </label>
          ))}
        </div>

        {state?.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}
        {!ready && <p className="mb-3 text-sm text-gray-500">Read the question carefully...</p>}

        <div className="flex gap-3">
          <button
            name="intent"
            value="answer"
            disabled={!ready || !selected || pending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {p.position === p.total ? "Finish" : "Next"}
          </button>
          <button
            name="intent"
            value="skip"
            disabled={!ready || pending}
            className="rounded-lg border border-gray-300 px-6 py-2.5 disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </form>

      <form action={finishQuiz} className="mt-10 border-t border-gray-200 pt-4">
        <button
          className="text-sm text-gray-500 underline"
          onClick={(e) => {
            if (!confirm("Submit your quiz now? Questions you haven't answered will count as wrong.")) e.preventDefault();
          }}
        >
          Submit quiz now
        </button>
      </form>
    </main>
  );
}