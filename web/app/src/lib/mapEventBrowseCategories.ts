import { sortEventPostsByUpvotes } from './feedEvents';
import type { FeedPost } from '../types';

/** Catégories affichées dans l'onglet Pays du browse carte. */
export type CountryEventBrowseCategory = 'concert' | 'festivals' | 'artistique';

export const COUNTRY_EVENT_BROWSE_CATEGORIES: CountryEventBrowseCategory[] = [
  'concert',
  'festivals',
  'artistique',
];

export interface FeedPostsByCategoryGroup {
  category: CountryEventBrowseCategory;
  posts: FeedPost[];
}

const FESTIVAL_MARKERS = [
  'festival',
  'francofolies',
  'vieilles charrues',
  'lollapalooza',
  'nuits sonores',
  'jazz a juan',
  'jazz à juan',
  'calvi on the rocks',
  'we love green',
  'deferlantes',
  'déferlantes',
  'rock en seine',
  'hellfest',
  'solidays',
  'eurockeennes',
  'eurockéennes',
  'garorock',
  'solar festival',
  'les trans',
  'transmusicales',
  'dour',
  'printemps de bourges',
  'coachella',
];

function normalizeCategoryText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function eventSearchBlob(post: Pick<FeedPost, 'content' | 'eventLocation'>): string {
  return normalizeCategoryText(`${post.content} ${post.eventLocation ?? ''}`);
}

/** Détecte un festival (prioritaire sur concert / artistique). */
export function isCountryFestivalEvent(post: Pick<FeedPost, 'content' | 'eventLocation'>): boolean {
  const blob = eventSearchBlob(post);
  return FESTIVAL_MARKERS.some((marker) => blob.includes(normalizeCategoryText(marker)));
}

/** Classe un événement pour l'onglet Pays : Concert · Festivals · Artistique. */
export function classifyCountryEventCategory(
  post: Pick<FeedPost, 'content' | 'eventLocation' | 'eventType'>
): CountryEventBrowseCategory {
  if (isCountryFestivalEvent(post)) return 'festivals';
  if (post.eventType === 'chant') return 'concert';
  return 'artistique';
}

export function groupFeedPostsByCountryCategory(posts: FeedPost[]): FeedPostsByCategoryGroup[] {
  const buckets = new Map<CountryEventBrowseCategory, FeedPost[]>();
  for (const category of COUNTRY_EVENT_BROWSE_CATEGORIES) {
    buckets.set(category, []);
  }

  for (const post of posts) {
    const category = classifyCountryEventCategory(post);
    buckets.get(category)!.push(post);
  }

  return COUNTRY_EVENT_BROWSE_CATEGORIES.map((category) => ({
    category,
    posts: sortEventPostsByUpvotes(buckets.get(category) ?? []),
  }));
}

export function countryEventCategoryEmoji(category: CountryEventBrowseCategory): string {
  switch (category) {
    case 'concert':
      return '🎤';
    case 'festivals':
      return '🎪';
    case 'artistique':
      return '🎨';
    default:
      return '📅';
  }
}
