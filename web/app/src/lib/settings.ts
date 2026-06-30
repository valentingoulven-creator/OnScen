import { isMsdevEnvironment } from './liveCameraSupport';

export type AppLanguage = 'fr' | 'en';

export interface PrivacyPreferences {
  showOnNearbyList: boolean;
  locationSharing: boolean;
}

const KEYS = {
  nearbyRadiusKm: 'melosong_nearby_radius_km',
  nearbyDistanceFilter: 'melosong_nearby_distance_filter',
  language: 'melosong_language',
  privacy: 'melosong_privacy_prefs',
} as const;

export const SETTINGS_CHANGED_EVENT = 'melosong-settings-changed';
export const APP_LANGUAGE_CHANGED_EVENT = 'melosong-language-changed';

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
  const raw = localStorage.getItem(KEYS.nearbyDistanceFilter);
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  return !isMsdevEnvironment();
}

export function setNearbyDistanceFilterEnabled(enabled: boolean): void {
  localStorage.setItem(KEYS.nearbyDistanceFilter, enabled ? 'true' : 'false');
  notifySettingsChanged();
}
const DEFAULT_PRIVACY: PrivacyPreferences = {
  showOnNearbyList: true,
  locationSharing: true,
};

export function notifySettingsChanged(): void {
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function getNearbyRadiusKm(): number {
  const raw = localStorage.getItem(KEYS.nearbyRadiusKm);
  if (raw == null || raw === '') return DEFAULT_RADIUS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS;
  return clampNearbyRadiusKm(n);
}

export function setNearbyRadiusKm(km: number): void {
  const v = clampNearbyRadiusKm(km);
  localStorage.setItem(KEYS.nearbyRadiusKm, String(v));
  notifySettingsChanged();
}

export function getAppLanguage(): AppLanguage {
  const lang = localStorage.getItem(KEYS.language);
  return lang === 'en' ? 'en' : 'fr';
}

export function setAppLanguage(lang: AppLanguage): void {
  localStorage.setItem(KEYS.language, lang);
  notifySettingsChanged();
  window.dispatchEvent(new CustomEvent(APP_LANGUAGE_CHANGED_EVENT, { detail: lang }));
}

export function getPrivacyPreferences(): PrivacyPreferences {
  try {
    const raw = localStorage.getItem(KEYS.privacy);
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
  localStorage.setItem(KEYS.privacy, JSON.stringify(prefs));
  notifySettingsChanged();
}
