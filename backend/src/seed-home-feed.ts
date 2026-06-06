import { getFavoriteHostIds } from './lib/favorites';
import { db } from './models/schema';
import {
  countFavoriteFeedPosts,
  FAVORITE_POST_TARGET,
  MSDEV_LISTENER_ID,
  needsFavoriteFeedRepair,
  seedFavoriteFeed,
} from './seed-favorite-feed';
import {
  COMMUNITY_POST_TARGET,
  countNonFavoriteCommunityPosts,
  needsCommunityFeedRepair,
  seedCommunityPosts,
} from './seed-community-posts';

export interface SeedHomeFeedResult {
  favoritesAdded: number;
  favoritePostsCreated: number;
  favoritePostsTotal: number;
  communityPostsCreated: number;
  communityPostsTotal: number;
  listenerFavoriteCount: number;
}

/** Vérifie si le store persisté est incomplet pour l'onglet Accueil. */
export function needsHomeFeedRepair(): boolean {
  return needsFavoriteFeedRepair() || needsCommunityFeedRepair();
}

/**
 * Regénère favoris + publications mixtes pour l'onglet Accueil (msdev, idempotent).
 * `forceRepair` / `MSDEV_FORCE_SEED=1` recrée les posts seed manquants ou obsolètes.
 */
export function seedHomeFeed(options?: {
  forceCommunity?: boolean;
  forceRepair?: boolean;
}): SeedHomeFeedResult {
  const force =
    options?.forceCommunity === true ||
    options?.forceRepair === true ||
    process.env.MSDEV_FORCE_SEED === '1';
  const repair = force || needsHomeFeedRepair();

  const { favoritesAdded, postsCreated, postsTotal } = seedFavoriteFeed({
    force: force || needsFavoriteFeedRepair(),
  });
  const community = seedCommunityPosts({
    force: force || (repair && needsCommunityFeedRepair()),
  });

  if (repair) {
    const stats = getHomeFeedSeedStats();
    console.log(
      `[msdev] Accueil réparé : ${stats.listenerFavoriteCount} favoris, ${stats.favoritePostsTotal}/${FAVORITE_POST_TARGET} posts favoris, ${stats.nonFavoritePostsTotal}/${COMMUNITY_POST_TARGET} posts hors favoris`
    );
  }

  return {
    favoritesAdded,
    favoritePostsCreated: postsCreated,
    favoritePostsTotal: postsTotal,
    communityPostsCreated: community.created,
    communityPostsTotal: community.total,
    listenerFavoriteCount: getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id))
      .length,
  };
}

export function getHomeFeedSeedStats(): {
  listenerFavoriteCount: number;
  favoritePostsTotal: number;
  nonFavoritePostsTotal: number;
  favoritePostTarget: number;
  communityPostTarget: number;
} {
  return {
    listenerFavoriteCount: getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id))
      .length,
    favoritePostsTotal: countFavoriteFeedPosts(),
    nonFavoritePostsTotal: countNonFavoriteCommunityPosts(),
    favoritePostTarget: FAVORITE_POST_TARGET,
    communityPostTarget: COMMUNITY_POST_TARGET,
  };
}
