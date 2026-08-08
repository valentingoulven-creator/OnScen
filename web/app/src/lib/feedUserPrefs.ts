import { PROFILE_TYPE_OPTIONS } from './profileTypes';
import type { ProfileType } from '../types';

/** Préférences fil d'Accueil (publications) — filtres utilisateur désactivés, ordre chronologique. */
const STORAGE_KEY = 'onscen_feed_prefs';
/** Préférences panneau Actualités (catégories news + affinités). */
const NEWS_STORAGE_KEY = 'onscen_news_prefs';
const VALID_PROFILE_TYPES = new Set<string>(PROFILE_TYPE_OPTIONS.map((o) => o.value));

export const FEED_PREFS_CHANGED_EVENT = 'onscen-feed-prefs-changed';
export const NEWS_PREFS_CHANGED_EVENT = 'onscen-news-prefs-changed';

export type FeedAudienceScope = 'all' | 'favorites_only';
export type NewsCategory = 'une' | 'musique' | 'promo' | 'tendance';

export interface FeedUserPrefs {
  /** Tout le monde ou publications des favoris uniquement. */
  audienceScope: FeedAudienceScope;
  /** Types de profil affichés (bar, DJ, etc.) ; vide = tous. */
  profileTypes: ProfileType[];
  /** Précision libre saisie par l'utilisateur quand "Autre" est sélectionné. */
  customProfileType?: string;
  /** Uniquement les auteurs avec affinité musicale avec mon profil. */
  musicalAffinitiesOnly: boolean;
  /** Mettre les favoris en tête (si audienceScope = all). */
  favoritesFirst: boolean;
}

/** Filtres du panneau Actualités (news musicales). */
export interface NewsUserPrefs {
  /** Catégories affichées ; vide = toutes. */
  categories: NewsCategory[];
  /** Uniquement les actualités dont les genres correspondent à mon profil. */
  musicalAffinitiesOnly: boolean;
}

export const DEFAULT_FEED_USER_PREFS: FeedUserPrefs = {
  audienceScope: 'all',
  profileTypes: [],
  musicalAffinitiesOnly: false,
  favoritesFirst: true,
};

/** Prefs minimales pour l'affichage du fil Accueil (pas de filtres utilisateur). */
export const HOME_FEED_DISPLAY_PREFS: FeedUserPrefs = {
  audienceScope: 'all',
  profileTypes: [],
  musicalAffinitiesOnly: false,
  favoritesFirst: false,
};

export const DEFAULT_NEWS_USER_PREFS: NewsUserPrefs = {
  categories: [],
  musicalAffinitiesOnly: false,
};

const VALID_SCOPES: FeedAudienceScope[] = ['all', 'favorites_only'];
const VALID_NEWS_CATEGORIES = new Set<NewsCategory>(['une', 'musique', 'promo', 'tendance']);

export const NEWS_CATEGORY_OPTIONS: { value: NewsCategory; label: string; emoji: string }[] = [
  { value: 'une', label: 'À la une', emoji: '🌟' },
  { value: 'musique', label: 'Musique', emoji: '🎵' },
  { value: 'promo', label: 'Promos & Annonces', emoji: '🎪' },
  { value: 'tendance', label: 'Tendances', emoji: '🔥' },
];

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
      customProfileType: typeof p.customProfileType === 'string' ? p.customProfileType : undefined,
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
  return prefs.profileTypes.length > 0 || prefs.musicalAffinitiesOnly;
}

function migrateNewsPrefsFromLegacyFeed(): NewsUserPrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<FeedUserPrefs>;
    if (!p.musicalAffinitiesOnly && (!Array.isArray(p.profileTypes) || p.profileTypes.length === 0)) {
      return null;
    }
    return {
      categories: [],
      musicalAffinitiesOnly: !!p.musicalAffinitiesOnly,
    };
  } catch {
    return null;
  }
}

export function readNewsUserPrefs(): NewsUserPrefs {
  try {
    const raw = localStorage.getItem(NEWS_STORAGE_KEY);
    if (!raw) {
      const migrated = migrateNewsPrefsFromLegacyFeed();
      if (migrated) return migrated;
      return { ...DEFAULT_NEWS_USER_PREFS };
    }
    const p = JSON.parse(raw) as Partial<NewsUserPrefs>;
    const categories = Array.isArray(p.categories)
      ? p.categories.filter(
          (c): c is NewsCategory => typeof c === 'string' && VALID_NEWS_CATEGORIES.has(c as NewsCategory)
        )
      : [];
    return {
      categories,
      musicalAffinitiesOnly: !!p.musicalAffinitiesOnly,
    };
  } catch {
    return { ...DEFAULT_NEWS_USER_PREFS };
  }
}

export function writeNewsUserPrefs(prefs: NewsUserPrefs): void {
  try {
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(NEWS_PREFS_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function newsPrefsFiltersActive(prefs: NewsUserPrefs): boolean {
  return prefs.categories.length > 0 || prefs.musicalAffinitiesOnly;
}
