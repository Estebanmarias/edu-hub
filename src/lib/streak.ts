/** Add (or subtract) days from a YYYY-MM-DD date. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Days in a row with a finished quiz, counting back from today.
 * If today's quiz isn't done yet the streak is still alive, counted from yesterday.
 */
export function currentStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let day = set.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = shiftDate(day, -1);
  }
  return n;
}