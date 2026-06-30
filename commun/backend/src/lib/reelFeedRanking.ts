import {
  getReelComments,
  getReelLikes,
  getReelShares,
  getReelViews,
  getUserReel,
  DEMO_REELS,
} from './reels';

export interface ReelFeedAlgorithmWeights {
  likes: number;
  comments: number;
  views: number;
  shares: number;
  /** Poids de la date de mise en ligne (plus récent = score plus élevé) */
  recency: number;
}

export interface ReelFeedAlgorithmPreferences {
  /** true = algorithme MeloSong intégré ; false = pondération personnalisée */
  useBuiltInAlgorithm: boolean;
  weights: ReelFeedAlgorithmWeights;
}

export const BUILTIN_ALGORITHM_WEIGHTS: ReelFeedAlgorithmWeights = {
  likes: 28,
  comments: 22,
  views: 18,
  shares: 17,
  recency: 15,
};

export const DEFAULT_CUSTOM_WEIGHTS: ReelFeedAlgorithmWeights = {
  likes: 20,
  comments: 20,
  views: 20,
  shares: 20,
  recency: 20,
};

const MAX_WEIGHT = 100;

function clampWeight(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.min(MAX_WEIGHT, Math.max(0, Math.round(v)));
}

export function normalizeWeights(w: ReelFeedAlgorithmWeights): ReelFeedAlgorithmWeights {
  return {
    likes: clampWeight(w.likes),
    comments: clampWeight(w.comments),
    views: clampWeight(w.views),
    shares: clampWeight(w.shares),
    recency: clampWeight(w.recency),
  };
}

export function parseFeedAlgorithmPreferences(raw: unknown): ReelFeedAlgorithmPreferences | null {
  if (raw == null) return null;
  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const weightsRaw = (obj.weights ?? {}) as Record<string, unknown>;
  const weights = normalizeWeights({
    likes: weightsRaw.likes as number,
    comments: weightsRaw.comments as number,
    views: weightsRaw.views as number,
    shares: weightsRaw.shares as number,
    recency: weightsRaw.recency as number,
  });
  const rawBuiltin = obj.useBuiltInAlgorithm ?? obj.useDefaultAlgo;
  const useBuiltInAlgorithm =
    rawBuiltin === false || rawBuiltin === 'false' || rawBuiltin === 0 ? false : true;
  return { useBuiltInAlgorithm, weights };
}

/** Parse query ?feedAlgo=... (JSON URL-encoded) */
export function parseFeedAlgoQuery(query: Record<string, unknown>): ReelFeedAlgorithmPreferences | null {
  const encoded = query.feedAlgo ?? query.feed_algo;
  if (encoded == null) return null;
  return parseFeedAlgorithmPreferences(
    typeof encoded === 'string' ? decodeURIComponent(encoded) : encoded
  );
}

export function getReelCreatedAt(reelId: string): number {
  const owned = getUserReel(reelId);
  if (owned) return owned.createdAt;
  const demoIndex = DEMO_REELS.findIndex((d) => d.id === reelId);
  if (demoIndex >= 0) {
    return Date.now() - (demoIndex + 1) * 24 * 60 * 60 * 1000;
  }
  return 0;
}

export interface ReelEngagementMetrics {
  reelId: string;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  createdAt: number;
}

export function getReelEngagementMetrics(reelId: string): ReelEngagementMetrics {
  return {
    reelId,
    likes: getReelLikes(reelId).size,
    comments: getReelComments(reelId).length,
    views: getReelViews(reelId).size,
    shares: getReelShares(reelId).size,
    createdAt: getReelCreatedAt(reelId),
  };
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
  norms: {
    likes: number;
    comments: number;
    views: number;
    shares: number;
    recency: number;
  },
  weights: ReelFeedAlgorithmWeights
): number {
  const total = weightsSum(weights);
  if (total <= 0) return m.createdAt;
  const w = weights;
  return (
    (norms.likes * w.likes +
      norms.comments * w.comments +
      norms.views * w.views +
      norms.shares * w.shares +
      norms.recency * w.recency) /
    total
  );
}

/** Classement style fil d’actualité : engagement normalisé + fraîcheur. */
export function rankReelsByBuiltIn<T extends { id: string }>(reels: T[]): T[] {
  return rankReelsWithWeights(reels, BUILTIN_ALGORITHM_WEIGHTS);
}

/** Classement selon les pondérations utilisateur (0–100 par critère). */
export function rankReelsWithWeights<T extends { id: string }>(reels: T[], weights: ReelFeedAlgorithmWeights): T[] {
  if (reels.length <= 1) return reels.slice();
  const w = normalizeWeights(weights);
  if (weightsSum(w) <= 0) {
    return reels.slice().sort((a, b) => getReelCreatedAt(b.id) - getReelCreatedAt(a.id));
  }

  const now = Date.now();
  const metrics = reels.map((r) => getReelEngagementMetrics(r.id));
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

export function applyFeedRanking<T extends { id: string }>(
  reels: T[],
  prefs: ReelFeedAlgorithmPreferences | null | undefined
): T[] {
  if (!prefs) return reels;
  if (prefs.useBuiltInAlgorithm) {
    return rankReelsByBuiltIn(reels);
  }
  return rankReelsWithWeights(reels, prefs.weights);
}
