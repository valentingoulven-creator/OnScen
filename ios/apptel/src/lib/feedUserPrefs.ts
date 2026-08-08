import { PROFILE_TYPE_OPTIONS } from './profileTypes';
import type { ProfileType } from '../types';

const STORAGE_KEY = 'onscen_feed_prefs';
const VALID_PROFILE_TYPES = new Set<string>(PROFILE_TYPE_OPTIONS.map((o) => o.value));

export const FEED_PREFS_CHANGED_EVENT = 'onscen-feed-prefs-changed';

export type FeedAudienceScope = 'all' | 'favorites_only';

export interface FeedUserPrefs {
  /** Tout le monde ou publications des favoris uniquement. */
  audienceScope: FeedAudienceScope;
  /** Types de profil affichés (bar, DJ, etc.) ; vide = tous. */
  profileTypes: ProfileType[];
  /** Uniquement les auteurs avec affinité musicale avec mon profil. */
  musicalAffinitiesOnly: boolean;
  /** Mettre les favoris en tête (si audienceScope = all). */
  favoritesFirst: boolean;
}

export const DEFAULT_FEED_USER_PREFS: FeedUserPrefs = {
  audienceScope: 'all',
  profileTypes: [],
  musicalAffinitiesOnly: false,
  favoritesFirst: false,
};

const VALID_SCOPES: FeedAudienceScope[] = ['all', 'favorites_only'];

export function readFeedUserPrefs(): FeedUserPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FEED_USER_PREFS };
    const p = JSON.parse(raw) as Partial<FeedUserPrefs>;
    const profileTypes = Array.isArray(p.profileTypes)
      ? p.profileTypes.filter(
          (t): t is ProfileType => typeof t === 'string' && VALID_PROFILE_TYPES.has(t)
        )
      : [];
    const audienceScope = VALID_SCOPES.includes(p.audienceScope as FeedAudienceScope)
      ? (p.audienceScope as FeedAudienceScope)
      : 'all';
    return {
      audienceScope,
      profileTypes,
      musicalAffinitiesOnly: !!p.musicalAffinitiesOnly,
      favoritesFirst: !!p.favoritesFirst,
    };
  } catch {
    return { ...DEFAULT_FEED_USER_PREFS };
  }
}

export function writeFeedUserPrefs(prefs: FeedUserPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(FEED_PREFS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function feedPrefsFiltersActive(prefs: FeedUserPrefs): boolean {
  return (
    prefs.audienceScope !== 'all' ||
    prefs.profileTypes.length > 0 ||
    prefs.musicalAffinitiesOnly ||
    prefs.favoritesFirst
  );
}
