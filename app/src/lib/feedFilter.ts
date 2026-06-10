import type { FeedPost, ProfileType } from '../types';
import {
  hasMusicalAffinity,
  type ProfileTastes,
  viewerHasTasteProfile,
} from './musicAffinities';
import type { FeedUserPrefs } from './feedUserPrefs';

/** Tri fil d'actualité par date de publication (createdAt), plus récent en premier. */
export function compareFeedPostsByCreatedAt(a: FeedPost, b: FeedPost): number {
  return b.createdAt - a.createdAt;
}

export function sortFeedPostsByPublicationDate(posts: FeedPost[]): FeedPost[] {
  return [...posts].sort(compareFeedPostsByCreatedAt);
}

/** Favoris en tête, chaque groupe trié par createdAt décroissant. */
export function sortFeedPostsByPublicationDateWithFavoritesFirst(
  posts: FeedPost[],
  favoriteIds: Set<string> | undefined
): FeedPost[] {
  if (!favoriteIds?.size) return sortFeedPostsByPublicationDate(posts);
  const favorites = sortFeedPostsByPublicationDate(
    posts.filter((p) => favoriteIds.has(p.author.id))
  );
  const rest = sortFeedPostsByPublicationDate(
    posts.filter((p) => !favoriteIds.has(p.author.id))
  );
  return [...favorites, ...rest];
}

export interface FeedFilterContext {
  viewerId: string;
  favoriteIds?: Set<string>;
  viewerTastes?: ProfileTastes;
}

function authorMatchesProfileTypes(post: FeedPost, types: ProfileType[]): boolean {
  if (types.length === 0) return true;
  const profileType = post.author.profileType;
  if (!profileType) return false;
  return types.includes(profileType);
}

function passesAffinityFilter(
  post: FeedPost,
  prefs: FeedUserPrefs,
  viewerTastes: ProfileTastes | undefined
): boolean {
  if (!prefs.musicalAffinitiesOnly) return true;
  if (!viewerTastes || !viewerHasTasteProfile(viewerTastes)) return false;
  return hasMusicalAffinity(viewerTastes, {
    interests: post.author.interests,
    favoriteGenres: post.author.favoriteGenres,
    favoriteArtists: post.author.favoriteArtists,
  });
}

/** Applique les préférences du fil d'actualité (le filtre ne masque jamais vos propres publications). */
export function applyFeedPreferences(
  posts: FeedPost[],
  prefs: FeedUserPrefs,
  ctx: FeedFilterContext
): FeedPost[] {
  const { viewerId, favoriteIds, viewerTastes } = ctx;

  let filtered = posts.filter((post) => {
    if (post.author.id === viewerId) return true;

    if (prefs.audienceScope === 'favorites_only') {
      if (!favoriteIds?.size || !favoriteIds.has(post.author.id)) return false;
    }

    if (!authorMatchesProfileTypes(post, prefs.profileTypes)) return false;

    if (!passesAffinityFilter(post, prefs, viewerTastes)) return false;

    return true;
  });

  if (prefs.audienceScope === 'all' && prefs.favoritesFirst) {
    return sortFeedPostsByPublicationDateWithFavoritesFirst(filtered, favoriteIds);
  }

  return sortFeedPostsByPublicationDate(filtered);
}
