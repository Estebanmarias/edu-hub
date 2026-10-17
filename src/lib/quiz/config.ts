// Fixed quiz rules. The quiz size and time limit are set by the admin (see lib/quiz/settings.ts).
export const COMPULSORY = ["math", "english"] as const;
export const ELECTIVE_COUNT = 2; // subjects the student chooses each day
export const MIN_ANSWER_MS = 3000; // answers faster than this are refused (anti random-tapping)
export const RECENT_DAYS = 14; // avoid questions the student saw in the last N days

/** Per-subject difficulty split: 40% easy, 40% medium, the rest hard. For 25 questions that is 10/10/5. */
export function difficultyMix(total: number): Record<number, number> {
  const easy = Math.round(total * 0.4);
  const medium = Math.round(total * 0.4);
  return { 1: easy, 2: medium, 3: total - easy - medium };
}

export const SUBJECT_LABELS: Record<string, string> = {
  math: "Mathematics",
  english: "English",
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  livestock: "Livestock",
  coding: "Coding & Robotics",
  "3d": "3D",
  geography: "Geography",
  civic: "Civic Education",
  "further-maths": "Further Maths",
};
export const subjectLabel = (s: string) => SUBJECT_LABELS[s] ?? s;

/** A calendar date (YYYY-MM-DD) in Nigeria's time zone. One quiz per student per Lagos day. */
export function lagosDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export const lagosDaysAgo = (n: number) => lagosDate(new Date(Date.now() - n * 86_400_000));