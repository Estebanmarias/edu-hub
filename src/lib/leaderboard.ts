import { lagosDate } from "@/lib/quiz/config";

export type Session = {
  userId: string;
  quizDate: string; // YYYY-MM-DD (Lagos)
  score: number;
  total: number;
  seconds: number | null; // time taken
};
export type BoardRow = {
  userId: string;
  name: string;
  quizzes: number;
  points: number; // sum of scores
  avgPct: number; // average percentage across quizzes
  bestPct: number;
  seconds: number | null; // time taken (today's board)
};

const pctOf = (s: Session) => (s.total > 0 ? (s.score / s.total) * 100 : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The Monday (Lagos) of the current week, as YYYY-MM-DD. */
export function lagosWeekStart(now: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "short" }).format(now);
  const offset = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return lagosDate(new Date(now.getTime() - offset * 86_400_000));
}

function aggregate(sessions: Session[], names: Map<string, string>): BoardRow[] {
  const byUser = new Map<string, Session[]>();
  for (const s of sessions) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  return [...byUser.entries()].map(([userId, list]) => {
    const pcts = list.map(pctOf);
    return {
      userId,
      name: names.get(userId) ?? "Student",
      quizzes: list.length,
      points: list.reduce((a, s) => a + s.score, 0),
      avgPct: round1(pcts.reduce((a, b) => a + b, 0) / list.length),
      bestPct: round1(Math.max(...pcts)),
      seconds: list.length === 1 ? list[0].seconds : null,
    };
  });
}

/** Today: highest percentage wins, faster finish breaks a tie. */
export function todayBoard(sessions: Session[], names: Map<string, string>, today: string): BoardRow[] {
  return aggregate(sessions.filter((s) => s.quizDate === today), names).sort(
    (a, b) => b.avgPct - a.avgPct || (a.seconds ?? Infinity) - (b.seconds ?? Infinity),
  );
}

/** This week: most points wins. Taking the quiz every day pays off. */
export function weekBoard(sessions: Session[], names: Map<string, string>, weekStart: string): BoardRow[] {
  return aggregate(sessions.filter((s) => s.quizDate >= weekStart), names).sort(
    (a, b) => b.points - a.points || b.avgPct - a.avgPct,
  );
}

/** All time: best average percentage wins, but only after a few quizzes so one lucky day doesn't top the table. */
export function allTimeBoard(sessions: Session[], names: Map<string, string>, minQuizzes = 3): BoardRow[] {
  return aggregate(sessions, names)
    .filter((r) => r.quizzes >= minQuizzes)
    .sort((a, b) => b.avgPct - a.avgPct || b.quizzes - a.quizzes);
}