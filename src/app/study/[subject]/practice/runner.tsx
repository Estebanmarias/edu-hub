"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import Mascot from "@/components/mascot/Mascot";
import { useMascot } from "@/components/mascot/MascotProvider";
import { startPractice, submitAnswer, type StudyQuestion } from "../../actions";

type Feedback = { correct: boolean; correctOption: string; explanation: string | null };
type Answered = { q: StudyQuestion; chosen: string; fb: Feedback };

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const PRAISE = ["Correct!", "Nice one!", "You got it!", "Brilliant!", "Yes!"];
const ENCOURAGE = ["Not quite. Read the reason below.", "Close! Check the explanation.", "That's how we learn. See why."];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

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
  const { say } = useMascot();
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
      <div>
        <p className="mb-4 rounded-xl bg-sun-300/50 p-4 text-sm">{error}</p>
        <Link href="/study" className="font-semibold text-brand-700 underline">
          Back to study
        </Link>
      </div>
    );
  }
  if (!questions) {
    return (
      <div className="flex flex-col items-center py-16 text-ink/70">
        <Mascot mood="thinking" size={110} />
        <p className="mt-3">Getting your questions ready...</p>
      </div>
    );
  }

  // ---- finished ----
  if (i >= questions.length) {
    const right = answered.filter((a) => a.fb.correct).length;
    const missed = answered.filter((a) => !a.fb.correct);
    const pct = Math.round((right / questions.length) * 100);
    const textOf = (q: StudyQuestion, id: string) => q.options.find((o) => o.id === id)?.text ?? "";
    return (
      <div>
        <section className="rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-6 text-center text-white shadow-lg">
          <div className="flex justify-center">
            <Mascot mood={pct >= 70 ? "celebrate" : pct >= 50 ? "happy" : "thinking"} size={120} />
          </div>
          <div className="mt-2 text-5xl font-extrabold">
            {right}
            <span className="text-2xl font-bold text-brand-100"> / {questions.length}</span>
          </div>
          <p className="mt-2 text-brand-50">
            {pct >= 70 ? "Great practice!" : pct >= 50 ? "Good effort. Keep going!" : "Look at the ones below, then try again."}
          </p>
        </section>

        {missed.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 font-bold">Questions to look at again</h2>
            <ul className="space-y-3">
              {missed.map((m) => (
                <li key={m.q.id} className="rounded-2xl border border-brand-200 bg-white p-4 text-sm shadow-sm">
                  <p className="mb-2 font-semibold">{m.q.stem}</p>
                  <p className="text-berry-600">Your answer: {textOf(m.q, m.chosen)}</p>
                  <p className="font-medium text-green-700">Correct answer: {textOf(m.q, m.fb.correctOption)}</p>
                  {m.fb.explanation && <p className="mt-1 text-ink/70">{m.fb.explanation}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={load} className="rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">
            Practise again
          </button>
          <Link href="/study" className="rounded-xl border-2 border-brand-200 bg-white px-5 py-3 font-bold">
            Other subjects
          </Link>
        </div>
      </div>
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
      if (r.correct) say(pick(PRAISE), "happy", 2200);
      else say(pick(ENCOURAGE), "sad", 3500);
    });
  }
  function next() {
    setI((n) => n + 1);
    setSelected("");
    setFb(null);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-700">
          {subjectName}
          <span className="font-normal text-ink/55"> · {topic || "All topics"}</span>
        </span>
        <span className="text-ink/60">
          {i + 1} / {questions.length}
        </span>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm md:p-6">
        <p className="mb-5 whitespace-pre-line text-lg font-semibold leading-relaxed">{q.stem}</p>

        <div className="space-y-3">
          {q.options.map((o, idx) => {
            let tone = selected === o.id ? "border-brand-500 bg-brand-50" : "border-brand-100 bg-white hover:border-brand-300";
            let badge = selected === o.id ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-800";
            if (fb) {
              if (o.id === fb.correctOption) {
                tone = "border-green-500 bg-green-50";
                badge = "bg-green-500 text-white";
              } else if (o.id === selected) {
                tone = "border-berry-500 bg-berry-500/10";
                badge = "bg-berry-500 text-white";
              } else {
                tone = "border-brand-100 bg-white text-ink/45";
                badge = "bg-brand-100 text-ink/45";
              }
            }
            return (
              <button
                key={o.id}
                onClick={() => !fb && setSelected(o.id)}
                disabled={!!fb}
                aria-pressed={selected === o.id}
                className={`flex w-full items-start gap-4 rounded-xl border-2 px-4 py-3 text-left transition ${tone}`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${badge}`}>
                  {LETTERS[idx]}
                </span>
                <span className="pt-1">{o.text}</span>
              </button>
            );
          })}
        </div>

        {fb && (
          <div className={`mt-5 rounded-xl p-4 text-sm ${fb.correct ? "bg-green-50 text-green-900" : "bg-berry-500/10 text-ink"}`}>
            <p className="font-bold">{fb.correct ? "Correct!" : "Not quite."}</p>
            {fb.explanation && <p className="mt-1">{fb.explanation}</p>}
          </div>
        )}

        <div className="mt-5">
          {!fb ? (
            <button
              onClick={check}
              disabled={!selected || pending}
              className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Checking..." : "Check answer"}
            </button>
          ) : (
            <button onClick={next} className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700">
              {i + 1 === questions.length ? "See results" : "Next question"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}