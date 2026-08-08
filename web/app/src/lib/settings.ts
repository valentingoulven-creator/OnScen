import { isMsdevEnvironment } from './liveCameraSupport';

export type AppLanguage = 'fr' | 'en';

export interface PrivacyPreferences {
  showOnNearbyList: boolean;
  locationSharing: boolean;
}

const KEYS = {
  nearbyRadiusKm: 'onscen_nearby_radius_km',
  nearbyDistanceFilter: 'onscen_nearby_distance_filter',
  language: 'onscen_language',
  privacy: 'onscen_privacy_prefs',
} as const;

export const SETTINGS_CHANGED_EVENT = 'onscen-settings-changed';
export const APP_LANGUAGE_CHANGED_EVENT = 'onscen-language-changed';

/**
 * Accès défensif à `localStorage` : évite un crash quand ce module est importé
 * dans un contexte sans DOM (tests unitaires en environnement `node`, SSR…).
 */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const NEARBY_RADIUS_MIN = 1;
/** Slider max (0–500 km). Au-delà, saisir manuellement dans le champ texte. */
export const NEARBY_RADIUS_MAX = 500;
/** Limite absolue acceptée en saisie manuelle (≈ moitié du périmètre terrestre). */
export const NEARBY_RADIUS_HARD_MAX = 20000;
/** Valeur spéciale "Illimité" – stockée et affichée comme ∞. */
export const NEARBY_RADIUS_UNLIMITED = NEARBY_RADIUS_HARD_MAX;
/** Rayon par défaut du panneau « À proximité » (km). */
export const NEARBY_DEFAULT_RADIUS_KM = 20;
const DEFAULT_RADIUS = NEARBY_DEFAULT_RADIUS_KM;

/** 0 ou invalide → 1 km minimum. Accepte jusqu'à NEARBY_RADIUS_HARD_MAX (saisie manuelle). */
export function clampNearbyRadiusKm(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return NEARBY_RADIUS_MIN;
  return Math.min(NEARBY_RADIUS_HARD_MAX, Math.max(NEARBY_RADIUS_MIN, Math.round(km)));
}

/** Formate un rayon pour l'affichage : "20 000 km" → "Illimité". */
export function formatRadiusKm(km: number): string {
  if (km >= NEARBY_RADIUS_HARD_MAX) return 'Illimité';
  return `${km} km`;
}

/** Filtre par rayon km (désactivé = carte mondiale, ~1000 bots msdev). Défaut msdev : désactivé. */
export function getNearbyDistanceFilterEnabled(): boolean {
  const raw = safeStorage()?.getItem(KEYS.nearbyDistanceFilter) ?? null;
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  return !isMsdevEnvironment();
}

export function setNearbyDistanceFilterEnabled(enabled: boolean): void {
  safeStorage()?.setItem(KEYS.nearbyDistanceFilter, enabled ? 'true' : 'false');
  notifySettingsChanged();
}
const DEFAULT_PRIVACY: PrivacyPreferences = {
  showOnNearbyList: true,
  locationSharing: true,
};

export function notifySettingsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function getNearbyRadiusKm(): number {
  const raw = safeStorage()?.getItem(KEYS.nearbyRadiusKm) ?? null;
  if (raw == null || raw === '') return DEFAULT_RADIUS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS;
  return clampNearbyRadiusKm(n);
}

export function setNearbyRadiusKm(km: number): void {
  const v = clampNearbyRadiusKm(km);
  safeStorage()?.setItem(KEYS.nearbyRadiusKm, String(v));
  notifySettingsChanged();
}

export function getAppLanguage(): AppLanguage {
  const lang = safeStorage()?.getItem(KEYS.language) ?? null;
  return lang === 'en' ? 'en' : 'fr';
}

export function setAppLanguage(lang: AppLanguage): void {
  safeStorage()?.setItem(KEYS.language, lang);
  notifySettingsChanged();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_LANGUAGE_CHANGED_EVENT, { detail: lang }));
  }
}

export function getPrivacyPreferences(): PrivacyPreferences {
  try {
    const raw = safeStorage()?.getItem(KEYS.privacy) ?? null;
    if (!raw) return { ...DEFAULT_PRIVACY };
    const parsed = JSON.parse(raw) as Partial<PrivacyPreferences>;
    return {
      showOnNearbyList: parsed.showOnNearbyList ?? DEFAULT_PRIVACY.showOnNearbyList,
      locationSharing: parsed.locationSharing ?? DEFAULT_PRIVACY.locationSharing,
    };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

export function setPrivacyPreferences(prefs: PrivacyPreferences): void {
  safeStorage()?.setItem(KEYS.privacy, JSON.stringify(prefs));
  notifySettingsChanged();
}
