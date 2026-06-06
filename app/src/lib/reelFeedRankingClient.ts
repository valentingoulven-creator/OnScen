import { MUSIC_REELS, type MusicReel } from '../content/reels';
import {
  BUILTIN_ALGORITHM_WEIGHTS,
  normalizeFeedWeights,
  type ReelFeedAlgorithmPreferences,
  type ReelFeedAlgorithmWeights,
} from './reelFeedAlgorithm';

const LAST_REELS_TAB_START_KEY = 'melosong_reels_last_tab_start_id';
const REELS_SESSION_SEED_KEY = 'melosong_reels_shuffle_seed';

function fisherYatesShuffle<T>(items: T[], random: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sessionShuffleSeed(): number {
  try {
    const stored = sessionStorage.getItem(REELS_SESSION_SEED_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return Date.now() ^ (Math.random() * 1e9 | 0);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function refreshReelsShuffleSeed(): void {
  try {
    sessionStorage.setItem(REELS_SESSION_SEED_KEY, String(Date.now() ^ (Math.random() * 1e9 | 0)));
  } catch {
    /* ignore */
  }
}

/** Algorithme Soundly par défaut ou msdev → ordre aléatoire (Fisher-Yates, graine session). */
export function shouldShuffleReelsFeed(
  prefs: ReelFeedAlgorithmPreferences,
  msdev: boolean
): boolean {
  return msdev || prefs.useBuiltInAlgorithm;
}

export function shuffleReelsFeedIfNeeded(
  reels: MusicReel[],
  prefs: ReelFeedAlgorithmPreferences,
  msdev: boolean,
  options?: { refreshSeed?: boolean }
): MusicReel[] {
  if (reels.length <= 1 || !shouldShuffleReelsFeed(prefs, msdev)) return reels.slice();
  if (options?.refreshSeed) refreshReelsShuffleSeed();
  else {
    try {
      if (!sessionStorage.getItem(REELS_SESSION_SEED_KEY)) refreshReelsShuffleSeed();
    } catch {
      /* ignore */
    }
  }
  return fisherYatesShuffle(reels, seededRandom(sessionShuffleSeed()));
}

export function readLastTabStartReelId(): string | null {
  try {
    return sessionStorage.getItem(LAST_REELS_TAB_START_KEY);
  } catch {
    return null;
  }
}

export function rememberTabStartReelId(reelId: string): void {
  try {
    sessionStorage.setItem(LAST_REELS_TAB_START_KEY, reelId);
  } catch {
    /* ignore */
  }
}

export function clearLastTabStartReelId(): void {
  try {
    sessionStorage.removeItem(LAST_REELS_TAB_START_KEY);
  } catch {
    /* ignore */
  }
}

/** Prochain reel dans l’ordre du flux déjà trié par l’algorithme. */
export function pickNextStartIndex(feed: MusicReel[], lastStartId: string | null): number {
  if (feed.length === 0) return 0;
  if (!lastStartId) return 0;
  const i = feed.findIndex((r) => r.id === lastStartId);
  return i < 0 ? 0 : (i + 1) % feed.length;
}

function getReelCreatedAt(reelId: string): number {
  const demoIndex = MUSIC_REELS.findIndex((r) => r.id === reelId);
  if (demoIndex >= 0) return Date.now() - (demoIndex + 1) * 24 * 60 * 60 * 1000;
  return 0;
}

interface ReelEngagementMetrics {
  reelId: string;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  createdAt: number;
}

function zeroMetrics(reelId: string): ReelEngagementMetrics {
  return { reelId, likes: 0, comments: 0, views: 0, shares: 0, createdAt: getReelCreatedAt(reelId) };
}

function logNorm(value: number, max: number): number {
  if (max <= 0) return value > 0 ? 1 : 0;
  return Math.log1p(value) / Math.log1p(max);
}

function recencyScore(createdAt: number, now: number): number {
  if (createdAt <= 0) return 0;
  const ageHours = (now - createdAt) / (60 * 60 * 1000);
  return 1 / (1 + ageHours / 36);
}

function weightsSum(w: ReelFeedAlgorithmWeights): number {
  return w.likes + w.comments + w.views + w.shares + w.recency;
}

function scoreFromMetrics(
  m: ReelEngagementMetrics,
  norms: { likes: number; comments: number; views: number; shares: number; recency: number },
  weights: ReelFeedAlgorithmWeights
): number {
  const total = weightsSum(weights);
  if (total <= 0) return m.createdAt;
  return (
    (norms.likes * weights.likes +
      norms.comments * weights.comments +
      norms.views * weights.views +
      norms.shares * weights.shares +
      norms.recency * weights.recency) /
    total
  );
}

function rankReelsWithWeights<T extends { id: string }>(reels: T[], weights: ReelFeedAlgorithmWeights): T[] {
  if (reels.length <= 1) return reels.slice();
  const w = normalizeFeedWeights(weights);
  if (weightsSum(w) <= 0) {
    return reels.slice().sort((a, b) => getReelCreatedAt(b.id) - getReelCreatedAt(a.id));
  }

  const now = Date.now();
  const metrics = reels.map((r) => zeroMetrics(r.id));
  const maxLikes = Math.max(1, ...metrics.map((m) => m.likes));
  const maxComments = Math.max(1, ...metrics.map((m) => m.comments));
  const maxViews = Math.max(1, ...metrics.map((m) => m.views));
  const maxShares = Math.max(1, ...metrics.map((m) => m.shares));

  const scored = reels.map((reel, i) => {
    const m = metrics[i];
    const norms = {
      likes: logNorm(m.likes, maxLikes),
      comments: logNorm(m.comments, maxComments),
      views: logNorm(m.views, maxViews),
      shares: logNorm(m.shares, maxShares),
      recency: recencyScore(m.createdAt, now),
    };
    return { reel, score: scoreFromMetrics(m, norms, w) };
  });

  scored.sort((a, b) => b.score - a.score || getReelCreatedAt(b.reel.id) - getReelCreatedAt(a.reel.id));
  return scored.map((s) => s.reel);
}

/** Classement local (repli hors API) — même logique que le backend. */
export function applyClientFeedRanking(
  reels: MusicReel[],
  prefs: ReelFeedAlgorithmPreferences
): MusicReel[] {
  if (reels.length <= 1) return reels.slice();
  if (prefs.useBuiltInAlgorithm) {
    return rankReelsWithWeights(reels, BUILTIN_ALGORITHM_WEIGHTS);
  }
  return rankReelsWithWeights(reels, prefs.weights);
}
