import { describe, expect, it, beforeEach } from 'vitest';
import { db } from './models/schema';
import { SALON_LIVE_BOT_SEEDS, seedProductionSalonsLives } from './seed-salons-lives';
import {
  BEATCASTEL_USER_ID,
  ensureBeatCastelShowcaseProfile,
} from './seed-beatcastel-profile';
import { getFavoriteCount, getFollowingCount } from './lib/favorites';

describe('ensureBeatCastelShowcaseProfile', () => {
  beforeEach(() => {
    db.users.clear();
    db.salons.clear();
    db.lives.clear();
    db.feedPosts.length = 0;
    db.userReels.length = 0;
    db.albums.length = 0;
    db.compositions.length = 0;
    db.userFavorites.clear();
    for (const seed of SALON_LIVE_BOT_SEEDS) {
      db.users.set(seed.userId, {
        id: seed.userId,
        email: `${seed.username}@seed.test`,
        username: seed.username,
        passwordHash: 'test',
        lastSeenAt: Date.now(),
      } as (typeof db.users extends Map<string, infer U> ? U : never));
    }
  });

  it('crée contenu profil et compteurs 36 / 57', () => {
    seedProductionSalonsLives();
    ensureBeatCastelShowcaseProfile();

    const user = db.users.get(BEATCASTEL_USER_ID);
    expect(user?.favoritesCountOverride).toBe(36);
    expect(getFavoriteCount(BEATCASTEL_USER_ID)).toBe(36);
    expect(getFollowingCount(BEATCASTEL_USER_ID)).toBe(57);

    expect(db.feedPosts.filter((p) => p.userId === BEATCASTEL_USER_ID).length).toBeGreaterThanOrEqual(7);
    expect(db.userReels.filter((r) => r.authorId === BEATCASTEL_USER_ID).length).toBeGreaterThanOrEqual(5);
    expect(db.albums.filter((a) => a.userId === BEATCASTEL_USER_ID).length).toBe(2);
    expect(user?.bio?.includes('Castelnau')).toBe(true);
  });
});
