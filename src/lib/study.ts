export type Hist = { is_correct: boolean; at: string };

/**
 * How likely a question is to come up again for this student. `hist` is their past answers to it, newest first.
 *   never seen            -> 1.0
 *   wrong last time       -> 2.5   (bring it back)
 *   right every time (2+) -> 0.1   (they know it; it still appears now and then)
 *   otherwise             -> 0.5
 */
export function weightFor(hist: Hist[]): number {
  if (!hist.length) return 1;
  if (!hist[0].is_correct) return 2.5;
  const recent = hist.slice(0, 3);
  if (recent.length >= 2 && recent.every((h) => h.is_correct)) return 0.1;
  return 0.5;
}

/** Pick n distinct items at random, where heavier items are more likely to be picked. */
export function weightedSample<T>(items: T[], weight: (item: T) => number, n: number, rng: () => number = Math.random): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0.0001, weight(item)) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let r = rng() * total;
    let idx = pool.findIndex((p) => (r -= p.w) < 0);
    if (idx < 0) idx = pool.length - 1;
    out.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return out;
}