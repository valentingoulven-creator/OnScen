const REELS_PREFS_KEY = 'onscen_reels_prefs';

export const REEL_GENRES_LIST = [
  // Visible by default (12) — ordered by global streaming popularity 2024-2025
  'Pop', 'Hip-Hop', 'Rap', 'R&B', 'Électro', 'Rock', 'Indie', 'Soul', 'Jazz', 'Lo-fi', 'Classique', 'Metal',
  // Extended list — shown when "···" is expanded
  'House', 'Techno', 'Afrobeats', 'Reggaeton', 'Latino', 'Funk', 'Gospel', 'Blues', 'Folk', 'Country',
  'Punk', 'Emo', 'Grunge', 'Alternative', 'Dance', 'Drum & Bass', 'Ambiante', 'K-Pop', 'J-Pop',
  'Trap', 'Drill', 'Grime', 'World Music', 'Salsa', 'Bossa Nova', 'Reggae', 'Ska',
] as const;

export interface ReelsUserPrefs {
  /** When false, feed ignores genre/lang/nearby prefs (values kept for re-enable). */
  algoEnabled: boolean;
  genres: string[];
  language: 'fr' | 'en' | 'all';
  nearbyOnly: boolean;
  /** Maximum distance in km for the nearby-creators filter. Default 30. */
  nearbyDistance: number;
}

export const DEFAULT_REELS_USER_PREFS: ReelsUserPrefs = {
  algoEnabled: true,
  genres: [],
  language: 'all',
  nearbyOnly: false,
  nearbyDistance: 30,
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
      nearbyDistance: typeof p.nearbyDistance === 'number' && p.nearbyDistance > 0 ? p.nearbyDistance : 30,
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
