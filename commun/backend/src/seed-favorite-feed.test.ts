import { describe, expect, it, beforeEach } from 'vitest';
import { db } from './models/schema';
import {
  FAVORITE_FEED_SHOWCASE,
  FAVORITE_POST_TARGET,
  MSDEV_LISTENER_ID,
  getFavoriteShowcaseFollowAuthorIds,
  seedFavoriteFeedPosts,
} from './seed-favorite-feed';
import { addFavorite } from './lib/favorites';
import { followUser } from './lib/follows';
import { listFeedPosts, resolveFeedPostImageUrls } from './lib/feedPosts';

describe('seedFavoriteFeedPosts showcase', () => {
  beforeEach(() => {
    process.env.APP_ENV = 'msdev';
    db.feedPosts.length = 0;
    db.users.clear();
    db.userFavorites.clear();

    db.users.set(MSDEV_LISTENER_ID, {
      id: MSDEV_LISTENER_ID,
      username: 'listener',
      email: 'listener@msdev.local',
      passwordHash: 'x',
      lastSeenAt: Date.now(),
    } as (typeof db.users extends Map<string, infer U> ? U : never));

    for (const seed of FAVORITE_FEED_SHOWCASE) {
      db.users.set(seed.authorId, {
        id: seed.authorId,
        username: seed.authorId,
        email: `${seed.authorId}@test.local`,
        passwordHash: 'x',
        lastSeenAt: Date.now(),
      } as (typeof db.users extends Map<string, infer U> ? U : never));
      addFavorite(MSDEV_LISTENER_ID, seed.authorId);
    }
  });

  it('crée 10 publications avec mix texte / 1 image / multi-images', () => {
    const { created, total } = seedFavoriteFeedPosts({ force: true });
    expect(created).toBe(FAVORITE_POST_TARGET);
    expect(total).toBe(FAVORITE_POST_TARGET);

    const showcasePosts = db.feedPosts.filter((p) => p.id.includes('showcase-'));
    expect(showcasePosts).toHaveLength(FAVORITE_POST_TARGET);

    const textOnly = showcasePosts.filter((p) => !p.imageUrl && !p.imageUrls?.length);
    const singleImage = showcasePosts.filter(
      (p) => p.imageUrl && (!p.imageUrls || p.imageUrls.length <= 1)
    );
    const multiImage = showcasePosts.filter((p) => (p.imageUrls?.length ?? 0) > 1);

    expect(textOnly.length).toBeGreaterThanOrEqual(3);
    expect(singleImage.length).toBeGreaterThanOrEqual(2);
    expect(multiImage.length).toBeGreaterThanOrEqual(3);

    const multi = showcasePosts.find((p) => p.id.endsWith('showcase-03'));
    expect(multi).toBeDefined();
    expect(resolveFeedPostImageUrls(multi!).length).toBe(3);

    const beatcastel = showcasePosts.find((p) => p.id.endsWith('showcase-09'));
    expect(beatcastel?.userId).toBe('prod-seed-bot-beat-castel');
    expect(resolveFeedPostImageUrls(beatcastel!).length).toBe(4);
  });

  it('followingOnly inclut les 10 publications showcase si le listener suit leurs auteurs', () => {
    seedFavoriteFeedPosts({ force: true });
    for (const authorId of getFavoriteShowcaseFollowAuthorIds()) {
      followUser(MSDEV_LISTENER_ID, authorId);
    }
    const posts = listFeedPosts(MSDEV_LISTENER_ID, { followingOnly: true, limit: 50 });
    const showcase = posts.filter((p) => p.id.includes('showcase-'));
    expect(showcase).toHaveLength(FAVORITE_POST_TARGET);
  });
});
