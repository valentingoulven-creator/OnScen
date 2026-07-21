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
import {
  countFeedEventPosts,
  EVENT_SEED_TARGET,
  needsFeedEventsRepair,
  seedFeedEvents,
} from './seed-feed-events';
import {
  countUserEventPosts,
  needsUserEventsRepair,
  seedUserEvents,
  USER_EVENT_SEED_TARGET,
} from './seed-user-events';

export interface SeedHomeFeedResult {
  favoritesAdded: number;
  favoritePostsCreated: number;
  favoritePostsTotal: number;
  communityPostsCreated: number;
  communityPostsTotal: number;
  feedEventsCreated: number;
  feedEventsTotal: number;
  userEventsCreated: number;
  userEventsTotal: number;
  listenerFavoriteCount: number;
}

/** Vérifie si le store persisté est incomplet pour l'onglet Accueil. */
export function needsHomeFeedRepair(): boolean {
  return (
    needsFavoriteFeedRepair() ||
    needsCommunityFeedRepair() ||
    needsFeedEventsRepair() ||
    needsUserEventsRepair()
  );
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
  const events = seedFeedEvents({
    force: force || (repair && needsFeedEventsRepair()),
  });
  const userEvents = seedUserEvents({
    force: force || (repair && needsUserEventsRepair()),
  });

  if (repair) {
    const stats = getHomeFeedSeedStats();
    console.log(
      `[msdev] Accueil réparé : ${stats.listenerFavoriteCount} favoris, ${stats.favoritePostsTotal}/${FAVORITE_POST_TARGET} posts favoris, ${stats.nonFavoritePostsTotal}/${COMMUNITY_POST_TARGET} posts hors favoris, ${stats.feedEventsTotal}/${EVENT_SEED_TARGET} événements pays, ${stats.userEventsTotal}/${USER_EVENT_SEED_TARGET} événements utilisateurs`
    );
  }

  return {
    favoritesAdded,
    favoritePostsCreated: postsCreated,
    favoritePostsTotal: postsTotal,
    communityPostsCreated: community.created,
    communityPostsTotal: community.total,
    feedEventsCreated: events.created,
    feedEventsTotal: events.total,
    userEventsCreated: userEvents.created,
    userEventsTotal: userEvents.total,
    listenerFavoriteCount: getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id))
      .length,
  };
}

export function getHomeFeedSeedStats(): {
  listenerFavoriteCount: number;
  favoritePostsTotal: number;
  nonFavoritePostsTotal: number;
  feedEventsTotal: number;
  userEventsTotal: number;
  favoritePostTarget: number;
  communityPostTarget: number;
  feedEventTarget: number;
  userEventTarget: number;
} {
  return {
    listenerFavoriteCount: getFavoriteHostIds(MSDEV_LISTENER_ID).filter((id) => db.users.has(id))
      .length,
    favoritePostsTotal: countFavoriteFeedPosts(),
    nonFavoritePostsTotal: countNonFavoriteCommunityPosts(),
    feedEventsTotal: countFeedEventPosts(),
    userEventsTotal: countUserEventPosts(),
    favoritePostTarget: FAVORITE_POST_TARGET,
    communityPostTarget: COMMUNITY_POST_TARGET,
    feedEventTarget: EVENT_SEED_TARGET,
    userEventTarget: USER_EVENT_SEED_TARGET,
  };
}
