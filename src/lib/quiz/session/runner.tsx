"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Mascot from "@/components/mascot/Mascot";
import { useMascot } from "@/components/mascot/MascotProvider";
import { finishQuiz, logEvent, saveAnswer } from "./actions";

export type Item = {
  rowId: string;
  subject: string;
  number: number; // numbered within its subject
  stem: string;
  options: { id: string; text: string }[];
  chosen: string | null;
};

type Props = {
  items: Item[];
  subjects: { key: string; label: string }[];
  deadline: string;
  serverNow: string;
  candidate: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function Runner({ items, subjects, deadline, serverNow, candidate }: Props) {
  const { say } = useMascot();
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((i) => [i.rowId, i.chosen])),
  );
  const [now, setNow] = useState<number | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveProblem, setSaveProblem] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const offset = useRef(Date.parse(serverNow) - Date.now()); // the server's clock is the one that counts
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const finishing = useRef(false);
  const lastInSubject = useRef<Record<string, number>>({});
  const warned = useRef({ five: false, one: false });
  const milestones = useRef<Set<number> | null>(null);

  const item = items[active];
  const subjectItems = useMemo(() => items.filter((i) => i.subject === item.subject), [items, item.subject]);
  const answeredCount = items.filter((i) => answers[i.rowId]).length;
  const isLast = active === items.length - 1;

  // ---- clock ----
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset.current);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);
  const remaining = now === null ? null : Math.max(0, Date.parse(deadline) - now);
  const low = remaining !== null && remaining < 5 * 60_000;

  async function submit() {
    if (finishing.current) return;
    finishing.current = true;
    setSubmitting(true);
    // let any answer that is still being saved finish first (but never wait more than 4 seconds)
    await Promise.race([pending.current, new Promise((r) => setTimeout(r, 4000))]);
    await finishQuiz();
  }

  useEffect(() => {
    if (remaining === 0) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // ---- bird reactions ----
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 5 * 60_000 && remaining > 60_000 && !warned.current.five) {
      warned.current.five = true;
      say("5 minutes left! Check the questions you haven't answered.", "worried", 8000);
    }
    if (remaining <= 60_000 && remaining > 0 && !warned.current.one) {
      warned.current.one = true;
      say("Last minute! Submit when you're ready.", "worried", 8000);
    }
  }, [remaining, say]);

  useEffect(() => {
    const pct = (answeredCount / items.length) * 100;
    if (milestones.current === null) {
      // do not cheer for progress that was already there when the page loaded
      milestones.current = new Set([25, 50, 75, 100].filter((m) => pct >= m));
      return;
    }
    const hit = [25, 50, 75, 100].find((m) => pct >= m && !milestones.current!.has(m));
    if (!hit) return;
    milestones.current.add(hit);
    if (hit === 100) say("All answered! Check your answers, then submit.", "celebrate", 7000);
    else say(hit === 25 ? "Nice start!" : hit === 50 ? "Halfway there!" : "Almost done!", "happy", 3500);
  }, [answeredCount, items.length, say]);

  // ---- anti-cheat log: leaving the tab ----
  useEffect(() => {
    const onChange = () => void logEvent(document.hidden ? "tab_hidden" : "tab_visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // ---- navigation ----
  function go(index: number) {
    const i = Math.max(0, Math.min(items.length - 1, index));
    lastInSubject.current[items[i].subject] = i;
    setActive(i);
    setPaletteOpen(false);
  }
  function openSubject(key: string) {
    const remembered = lastInSubject.current[key];
    go(remembered ?? items.findIndex((i) => i.subject === key));
  }

  function choose(optionId: string) {
    setAnswers((a) => ({ ...a, [item.rowId]: optionId }));
    save(item.rowId, optionId);
  }
  function clear() {
    setAnswers((a) => ({ ...a, [item.rowId]: null }));
    save(item.rowId, null);
  }
  function save(rowId: string, option: string | null) {
    // saves run one after another so the last click always wins
    pending.current = pending.current
      .then(() => saveAnswer(rowId, option))
      .then((r) => setSaveProblem(!!r && "error" in r))
      .catch(() => setSaveProblem(true));
  }

  // keyboard: A-D choose, N / right arrow next, P / left arrow previous
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSubmit || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = ["a", "b", "c", "d", "e", "f"].indexOf(k);
      if (idx >= 0 && idx < item.options.length) choose(item.options[idx].id);
      else if (k === "n" || k === "arrowright") go(active + 1);
      else if (k === "p" || k === "arrowleft") go(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, showSubmit, item]);

  const answeredIn = (key: string) => items.filter((i) => i.subject === key && answers[i.rowId]).length;
  const totalIn = (key: string) => items.filter((i) => i.subject === key).length;
  const chosen = answers[item.rowId];

  return (
    <div className="flex min-h-screen flex-col bg-mist text-ink">
      {/* ---- top bar ---- */}
      <header className="bg-brand-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Mascot size={38} animate={false} />
          <div className="leading-tight">
            <div className="font-bold">Edu Hub CBT</div>
            <div className="text-xs text-brand-100">{candidate}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div
              className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold ${low ? "bg-berry-500" : "bg-brand-800"}`}
              aria-label="Time left"
            >
              {remaining === null ? "--:--" : clock(remaining)}
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              className="rounded-lg bg-sun-400 px-4 py-2 font-semibold text-ink hover:bg-sun-300"
            >
              Submit
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3" aria-label="Subjects">
          {subjects.map((s) => (
            <button
              key={s.key}
              onClick={() => openSubject(s.key)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${
                s.key === item.subject ? "bg-white text-brand-800" : "bg-brand-600 text-white hover:bg-brand-500"
              }`}
            >
              {s.label}
              <span className="ml-2 text-xs opacity-80">
                {answeredIn(s.key)}/{totalIn(s.key)}
              </span>
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:flex-row md:items-start">
        {/* ---- left: question numbers ---- */}
        <aside className="md:w-72 md:shrink-0">
          <button
            onClick={() => setPaletteOpen((o) => !o)}
            className="mb-2 flex w-full items-center justify-between rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold md:hidden"
          >
            <span>
              Questions: {answeredCount}/{items.length} answered
            </span>
            <span>{paletteOpen ? "Hide" : "Show"}</span>
          </button>
          <div className={`${paletteOpen ? "block" : "hidden"} rounded-2xl border border-brand-200 bg-white p-4 shadow-sm md:block`}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-bold">{subjects.find((s) => s.key === item.subject)?.label}</h2>
              <span className="text-xs text-ink/60">
                {answeredIn(item.subject)}/{totalIn(item.subject)} answered
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {subjectItems.map((q) => {
                const idx = items.indexOf(q);
                const isCurrent = idx === active;
                const isAnswered = !!answers[q.rowId];
                return (
                  <button
                    key={q.rowId}
                    onClick={() => go(idx)}
                    aria-label={`Question ${q.number}${isAnswered ? ", answered" : ", not answered"}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`h-10 rounded-lg border text-sm font-semibold transition ${
                      isAnswered ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-ink hover:bg-brand-50"
                    } ${isCurrent ? "ring-2 ring-sun-500 ring-offset-1" : ""}`}
                  >
                    {q.number}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-3 w-3 rounded bg-brand-500" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-3 w-3 rounded border border-brand-200 bg-white" /> Not answered
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-3 w-3 rounded ring-2 ring-sun-500" /> Current
              </span>
            </div>
          </div>
        </aside>

        {/* ---- right: the question ---- */}
        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-4 flex items-center justify-between text-sm text-ink/60">
              <span className="font-semibold text-brand-700">
                Question {item.number} of {subjectItems.length}
              </span>
              <span>Press A, B, C or D to answer</span>
            </div>
            <p className="mb-6 whitespace-pre-line text-lg font-medium leading-relaxed md:text-xl">{item.stem}</p>

            <div className="space-y-3" role="group" aria-label="Answer options">
              {item.options.map((o, idx) => {
                const on = chosen === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => choose(o.id)}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-4 rounded-xl border-2 px-4 py-3 text-left transition ${
                      on ? "border-brand-500 bg-brand-50" : "border-brand-100 bg-white hover:border-brand-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        on ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-800"
                      }`}
                    >
                      {LETTERS[idx]}
                    </span>
                    <span className="pt-1">{o.text}</span>
                  </button>
                );
              })}
            </div>

            {saveProblem && (
              <p className="mt-4 rounded-lg bg-sun-300/50 p-3 text-sm">
                We couldn&apos;t save your last answer. Check your connection. We&apos;ll try again when you choose another answer.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => go(active - 1)}
                disabled={active === 0}
                className="rounded-xl border-2 border-brand-200 px-5 py-2.5 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              {isLast ? (
                <button onClick={() => setShowSubmit(true)} className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">
                  Review and submit
                </button>
              ) : (
                <button onClick={() => go(active + 1)} className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">
                  Next
                </button>
              )}
              {chosen && (
                <button onClick={clear} className="ml-auto text-sm text-ink/60 underline">
                  Clear my answer
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ---- submit confirmation ---- */}
      {showSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Submit quiz">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-3">
              <Mascot size={52} mood={answeredCount === items.length ? "happy" : "thinking"} />
              <h2 className="text-xl font-bold">Submit your quiz?</h2>
            </div>
            <ul className="mb-4 space-y-1 text-sm">
              {subjects.map((s) => (
                <li key={s.key} className="flex justify-between">
                  <span>{s.label}</span>
                  <span className={answeredIn(s.key) < totalIn(s.key) ? "font-semibold text-berry-600" : "text-ink/70"}>
                    {answeredIn(s.key)} / {totalIn(s.key)} answered
                  </span>
                </li>
              ))}
            </ul>
            {answeredCount < items.length && (
              <p className="mb-4 rounded-lg bg-sun-300/50 p-3 text-sm">
                {items.length - answeredCount} question{items.length - answeredCount === 1 ? "" : "s"} not answered yet. They will count as wrong.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowSubmit(false)} disabled={submitting} className="flex-1 rounded-xl border-2 border-brand-200 px-4 py-2.5 font-semibold">
                Keep going
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}