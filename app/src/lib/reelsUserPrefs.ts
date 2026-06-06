const REELS_PREFS_KEY = 'melosong_reels_prefs';

export const REEL_GENRES_LIST = [
  'Pop', 'Rap', 'Électro', 'Jazz', 'Rock', 'R&B',
  'Classique', 'Lo-fi', 'Soul', 'Hip-Hop', 'Indie', 'Metal',
] as const;

export interface ReelsUserPrefs {
  /** When false, feed ignores genre/lang/nearby prefs (values kept for re-enable). */
  algoEnabled: boolean;
  genres: string[];
  language: 'fr' | 'en' | 'all';
  nearbyOnly: boolean;
}

export const DEFAULT_REELS_USER_PREFS: ReelsUserPrefs = {
  algoEnabled: true,
  genres: [],
  language: 'all',
  nearbyOnly: false,
};

export function readReelsUserPrefs(): ReelsUserPrefs {
  try {
    const raw = localStorage.getItem(REELS_PREFS_KEY);
    if (!raw) return { ...DEFAULT_REELS_USER_PREFS };
    const p = JSON.parse(raw) as Partial<ReelsUserPrefs>;
    const validLangs: Array<ReelsUserPrefs['language']> = ['fr', 'en', 'all'];
    return {
      algoEnabled: p.algoEnabled !== false,
      genres: Array.isArray(p.genres) ? p.genres.filter((g) => typeof g === 'string') : [],
      language: validLangs.includes(p.language as ReelsUserPrefs['language'])
        ? (p.language as ReelsUserPrefs['language'])
        : 'all',
      nearbyOnly: !!p.nearbyOnly,
    };
  } catch {
    return { ...DEFAULT_REELS_USER_PREFS };
  }
}

export function writeReelsUserPrefs(prefs: ReelsUserPrefs): void {
  try {
    localStorage.setItem(REELS_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function applyReelsUserPrefsFilter<T extends { genre?: string }>(
  feed: T[],
  prefs: ReelsUserPrefs
): T[] {
  if (!prefs.algoEnabled) return feed;
  if (prefs.genres.length === 0) return feed;
  const filtered = feed.filter((reel) => {
    const reelGenre = (reel.genre ?? '').toLowerCase().trim();
    return prefs.genres.some(
      (g) =>
        reelGenre === g.toLowerCase() ||
        reelGenre.includes(g.toLowerCase()) ||
        g.toLowerCase().includes(reelGenre)
    );
  });
  return filtered.length > 0 ? filtered : feed;
}
