import type { FeedPost } from '../types';

/** Aligné sur commun/backend/src/lib/feedPosts.ts (filtre eventCountry). */
export const EVENT_COUNTRY_NAMES: Record<string, string> = {
  FR: 'france',
  BE: 'belgique',
  CH: 'suisse',
  CA: 'canada',
  LU: 'luxembourg',
  DE: 'allemagne',
  IT: 'italie',
  ES: 'espagne',
  GB: 'royaume-uni',
  US: 'états-unis',
  MA: 'maroc',
  SN: 'sénégal',
  CI: "côte d'ivoire",
};

/** Événement fil dont le lieu correspond au code pays ISO (ex. FR → « france » dans eventLocation). */
export function feedPostMatchesEventCountry(
  post: Pick<FeedPost, 'eventLocation'>,
  countryCode: string
): boolean {
  const code = countryCode.trim().toUpperCase();
  if (!code) return true;
  const needle = EVENT_COUNTRY_NAMES[code] ?? code.toLowerCase();
  const location = post.eventLocation?.toLowerCase() ?? '';
  return location.includes(needle);
}

export function filterFeedPostsByEventCountry<T extends Pick<FeedPost, 'eventLocation'>>(
  posts: T[],
  countryCode: string
): T[] {
  return posts.filter((post) => feedPostMatchesEventCountry(post, countryCode));
}
