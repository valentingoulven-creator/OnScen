export interface ReelFeedAlgorithmWeights {
  likes: number;
  comments: number;
  views: number;
  shares: number;
  recency: number;
}

export interface ReelFeedAlgorithmPreferences {
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

const STORAGE_KEY = 'melosong_reels_feed_algo';

function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeFeedWeights(w: ReelFeedAlgorithmWeights): ReelFeedAlgorithmWeights {
  return {
    likes: clampWeight(w.likes),
    comments: clampWeight(w.comments),
    views: clampWeight(w.views),
    shares: clampWeight(w.shares),
    recency: clampWeight(w.recency),
  };
}

const DEFAULT_PREFS: ReelFeedAlgorithmPreferences = {
  useBuiltInAlgorithm: true,
  weights: { ...DEFAULT_CUSTOM_WEIGHTS },
};

export function getFeedAlgorithmPreferences(): ReelFeedAlgorithmPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, weights: { ...DEFAULT_CUSTOM_WEIGHTS } };
    const parsed = JSON.parse(raw) as Partial<ReelFeedAlgorithmPreferences>;
    return {
      useBuiltInAlgorithm: parsed.useBuiltInAlgorithm !== false,
      weights: normalizeFeedWeights({
        ...DEFAULT_CUSTOM_WEIGHTS,
        ...parsed.weights,
      }),
    };
  } catch {
    return { ...DEFAULT_PREFS, weights: { ...DEFAULT_CUSTOM_WEIGHTS } };
  }
}

export function setFeedAlgorithmPreferences(prefs: ReelFeedAlgorithmPreferences): void {
  const next: ReelFeedAlgorithmPreferences = {
    useBuiltInAlgorithm: prefs.useBuiltInAlgorithm,
    weights: normalizeFeedWeights(prefs.weights),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Déclenche un rafraîchissement du flux Reels (voir ReelsTabPage). */
export function notifyFeedAlgorithmChanged(): void {
  window.dispatchEvent(new Event('melosong-settings-changed'));
}

export function serializeFeedAlgoForApi(prefs: ReelFeedAlgorithmPreferences): string {
  return encodeURIComponent(JSON.stringify(prefs));
}
