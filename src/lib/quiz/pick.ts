export type Candidate = { id: string; difficulty: number };

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Choose `total` question ids from a subject's pool.
 * 1) honour the difficulty mix using questions the student hasn't seen recently,
 * 2) fill any gap with other unseen questions,
 * 3) only then reuse recently-seen ones.
 */
export function pickQuestions(
  pool: Candidate[],
  seen: Set<string>,
  mix: Record<number, number>,
  total: number,
): string[] {
  const chosen: string[] = [];
  const used = new Set<string>();
  const take = (items: Candidate[], n: number) => {
    for (const c of shuffle(items)) {
      if (n <= 0 || chosen.length >= total) break;
      if (used.has(c.id)) continue;
      used.add(c.id);
      chosen.push(c.id);
      n--;
    }
  };

  const fresh = pool.filter((c) => !seen.has(c.id));
  for (const d of [1, 2, 3]) take(fresh.filter((c) => c.difficulty === d), mix[d] ?? 0);
  take(fresh, total - chosen.length);
  take(pool.filter((c) => seen.has(c.id)), total - chosen.length);
  return shuffle(chosen);
}