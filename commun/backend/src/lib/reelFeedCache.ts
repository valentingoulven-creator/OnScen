/**
 * Cache court-terme du classement du flux Reels.
 *
 * `buildReelsFeed` recalcule le score de chaque reel (likes/comments/views/shares
 * normalisés + recency) à chaque appel — coût négligeable au volume actuel mais
 * répété inutilement à chaque retour sur l'onglet / scroll (le client rappelle
 * l'API en silencieux via `refreshFeedWithStart({ silent: true })`). Ce cache
 * mémorise le classement calculé par clé (viewer + préférences d'algo) pendant
 * un court TTL — les compteurs (likes/comments/...) affichés dans l'app ne
 * viennent pas de cette liste mais de `GET /:reelId/stats` (rafraîchi à part),
 * donc la fraîcheur du classement lui-même n'a pas besoin d'être immédiate.
 */

export const REELS_FEED_CACHE_TTL_MS = 8_000;

interface CacheEntry<T> {
  builtAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCachedReelsFeed<T>(
  key: string,
  ttlMs: number = REELS_FEED_CACHE_TTL_MS
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.builtAt >= ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCachedReelsFeed<T>(key: string, value: T): void {
  cache.set(key, { builtAt: Date.now(), value });
}

/** À appeler après toute mutation qui change la composition du flux (création,
 *  publication, suppression) — pas après un like/comment/share/view, dont le
 *  léger décalage de classement pendant le TTL est un compromis acceptable. */
export function invalidateReelsFeedCache(): void {
  cache.clear();
}
