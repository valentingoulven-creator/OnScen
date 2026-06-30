import { normalizeTag } from './musicAffinities';

export interface SalonGenreSource {
  genres?: string[];
  listenersCount?: number;
}

/** Genres les plus présents dans les salons actifs, pondérés par auditeurs. */
export function rankTrendingSalonGenres(
  salons: SalonGenreSource[],
  limit = 12
): string[] {
  const scores = new Map<string, { label: string; score: number }>();

  for (const salon of salons) {
    const genres = salon.genres ?? [];
    if (genres.length === 0) continue;
    const weight = Math.max(1, salon.listenersCount ?? 0);
    for (const raw of genres) {
      const label = raw.trim();
      if (!label) continue;
      const key = normalizeTag(label);
      const prev = scores.get(key);
      if (prev) {
        prev.score += weight;
      } else {
        scores.set(key, { label, score: weight });
      }
    }
  }

  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fr'))
    .slice(0, limit)
    .map((e) => e.label);
}

export function sortGenresByTrendingPriority(genres: string[], trending: string[]): string[] {
  if (trending.length === 0) return genres;
  const rank = new Map(trending.map((g, i) => [normalizeTag(g), i]));
  return [...genres].sort((a, b) => {
    const ra = rank.get(normalizeTag(a));
    const rb = rank.get(normalizeTag(b));
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b, 'fr');
  });
}
