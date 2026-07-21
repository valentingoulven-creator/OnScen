import { beforeEach, describe, expect, it } from 'vitest';
import { buildReelsFeed } from './reels';
import { invalidateReelsFeedCache } from './reelFeedCache';
import { db } from '../models/schema';

describe('buildReelsFeed — pagination additive', () => {
  beforeEach(() => {
    // Repli sur DEMO_REELS (>60 entrées éligibles) quand aucun reel utilisateur.
    db.userReels.length = 0;
    invalidateReelsFeedCache();
  });

  it('sans pagination renvoie le flux complet (comportement historique inchangé)', () => {
    const full = buildReelsFeed(undefined, undefined);
    const unpaginated = buildReelsFeed(undefined, undefined, undefined);
    expect(unpaginated).toHaveLength(full.length);
    expect(full.length).toBeGreaterThan(10);
  });

  it('limit/offset découpe le même classement sans le recalculer différemment', () => {
    const full = buildReelsFeed(undefined, undefined);
    const page1 = buildReelsFeed(undefined, undefined, { limit: 5, offset: 0 });
    const page2 = buildReelsFeed(undefined, undefined, { limit: 5, offset: 5 });

    expect(page1).toEqual(full.slice(0, 5));
    expect(page2).toEqual(full.slice(5, 10));
  });

  it('réutilise le classement en cache pour deux appels rapprochés (même viewer)', () => {
    const first = buildReelsFeed('viewer-cache-test', undefined);
    const second = buildReelsFeed('viewer-cache-test', undefined);
    // Même référence de tableau : preuve que le second appel a servi le cache
    // plutôt que de recalculer computeReelsFeed.
    expect(second).toBe(first);
  });

  it('invalidateReelsFeedCache() force un recalcul au prochain appel (appelée par create/publish/delete/block)', () => {
    const before = buildReelsFeed('viewer-cache-invalidate', undefined);
    invalidateReelsFeedCache();
    const after = buildReelsFeed('viewer-cache-invalidate', undefined);
    // Contenu identique (rien n'a changé dans db.userReels) mais nouvelle
    // référence de tableau : preuve que le cache a bien été vidé et recalculé.
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
  });
});
