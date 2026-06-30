import type { FeedPost, ProfileType } from '../types';
import {
  hasMusicalAffinity,
  normalizeTags,
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

/**
 * Booste les publications dont l'auteur partage au moins un genre avec le viewer,
 * sans en masquer aucune. Les posts avec affinité sont mis en tête (triés par date),
 * suivis des autres (triés par date).
 */
export function boostPostsByGenreAffinity(
  posts: FeedPost[],
  viewerGenres: string[] | undefined
): FeedPost[] {
  if (!viewerGenres || viewerGenres.length === 0) return sortFeedPostsByPublicationDate(posts);
  const viewerSet = normalizeTags(viewerGenres);
  const boosted: FeedPost[] = [];
  const rest: FeedPost[] = [];
  for (const post of posts) {
    const authorSet = normalizeTags(post.author.favoriteGenres);
    let match = false;
    for (const g of viewerSet) {
      if (authorSet.has(g)) { match = true; break; }
    }
    if (match) boosted.push(post);
    else rest.push(post);
  }
  return [
    ...sortFeedPostsByPublicationDate(boosted),
    ...sortFeedPostsByPublicationDate(rest),
  ];
}

/** Applique les préférences du fil d'actualité (le filtre ne masque jamais vos propres publications). */
export function applyFeedPreferences(
  posts: FeedPost[],
  prefs: FeedUserPrefs,
  ctx: FeedFilterContext
): FeedPost[] {
  const { viewerId, favoriteIds, viewerTastes } = ctx;

  const filtered = posts.filter((post) => {
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
