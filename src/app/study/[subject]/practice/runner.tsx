"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { startPractice, submitAnswer, type StudyQuestion } from "../../actions";

type Feedback = { correct: boolean; correctOption: string; explanation: string | null };
type Answered = { q: StudyQuestion; chosen: string; fb: Feedback };

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function StudyRunner({
  subject,
  subjectName,
  topic,
  count,
}: {
  subject: string;
  subjectName: string;
  topic: string;
  count: number;
}) {
  const [questions, setQuestions] = useState<StudyQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState("");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function load() {
    setQuestions(null);
    setError("");
    setI(0);
    setSelected("");
    setFb(null);
    setAnswered([]);
    startTransition(async () => {
      const r = await startPractice(subject, topic, count);
      if ("error" in r) setError(r.error);
      else setQuestions(r.questions);
    });
  }

  useEffect(() => {
    if (started.current) return; // React runs effects twice in development
    started.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Shell title={subjectName}>
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>
        <Link href="/study" className="text-blue-700 underline">
          Back to study
        </Link>
      </Shell>
    );
  }
  if (!questions) {
    return (
      <Shell title={subjectName}>
        <p className="text-gray-600">Getting your questions ready...</p>
      </Shell>
    );
  }

  // ---- finished ----
  if (i >= questions.length) {
    const right = answered.filter((a) => a.fb.correct).length;
    const missed = answered.filter((a) => !a.fb.correct);
    const textOf = (q: StudyQuestion, id: string) => q.options.find((o) => o.id === id)?.text ?? "";
    return (
      <Shell title="Practice complete">
        <div className="mb-6 rounded-2xl border border-gray-200 p-6 text-center">
          <div className="text-5xl font-bold">
            {right}
            <span className="text-2xl text-gray-500"> / {questions.length}</span>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-semibold">Questions to look at again</h2>
            <ul className="space-y-3">
              {missed.map((m) => (
                <li key={m.q.id} className="rounded-xl border border-gray-200 p-4 text-sm">
                  <p className="mb-2 font-medium">{m.q.stem}</p>
                  <p className="text-red-700">Your answer: {textOf(m.q, m.chosen)}</p>
                  <p className="text-green-700">Correct answer: {textOf(m.q, m.fb.correctOption)}</p>
                  {m.fb.explanation && <p className="mt-1 text-gray-600">{m.fb.explanation}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={load} className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white">
            Practise again
          </button>
          <Link href="/study" className="rounded-lg border border-gray-300 px-5 py-2.5">
            Other subjects
          </Link>
        </div>
      </Shell>
    );
  }

  // ---- one question ----
  const q = questions[i];
  function check() {
    if (!selected || fb) return;
    startTransition(async () => {
      const r = await submitAnswer(q.id, selected);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setFb(r);
      setAnswered((a) => [...a, { q, chosen: selected, fb: r }]);
    });
  }
  function next() {
    setI((n) => n + 1);
    setSelected("");
    setFb(null);
  }

  return (
    <Shell title={subjectName}>
      <div className="mb-5 flex justify-between text-sm text-gray-600">
        <span>{topic || "All topics"}</span>
        <span>
          Question {i + 1} of {questions.length}
        </span>
      </div>

      <p className="mb-5 text-lg font-medium">{q.stem}</p>

      <div className="mb-5 space-y-2">
        {q.options.map((o, idx) => {
          let tone = selected === o.id ? "border-blue-600 bg-blue-50" : "border-gray-300";
          if (fb) {
            if (o.id === fb.correctOption) tone = "border-green-600 bg-green-50";
            else if (o.id === selected) tone = "border-red-500 bg-red-50";
            else tone = "border-gray-200 text-gray-500";
          }
          return (
            <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${tone}`}>
              <input
                type="radio"
                name="option"
                value={o.id}
                checked={selected === o.id}
                disabled={!!fb}
                onChange={() => setSelected(o.id)}
                className="mt-1"
              />
              <span>
                <span className="mr-2 font-mono text-gray-500">{LETTERS[idx]}</span>
                {o.text}
              </span>
            </label>
          );
        })}
      </div>

      {fb && (
        <div className={`mb-5 rounded-xl p-4 text-sm ${fb.correct ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
          <p className="font-semibold">{fb.correct ? "Correct!" : "Not quite."}</p>
          {fb.explanation && <p className="mt-1">{fb.explanation}</p>}
        </div>
      )}

      {!fb ? (
        <button
          onClick={check}
          disabled={!selected || pending}
          className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Checking..." : "Check answer"}
        </button>
      ) : (
        <button onClick={next} className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white">
          {i + 1 === questions.length ? "See results" : "Next question"}
        </button>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      {children}
    </main>
  );
}