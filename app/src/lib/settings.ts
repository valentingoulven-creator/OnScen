export type AppLanguage = 'fr' | 'en';

export interface PrivacyPreferences {
  showOnNearbyList: boolean;
  allowDmFromAnyone: boolean;
}

const KEYS = {
  nearbyRadiusKm: 'melosong_nearby_radius_km',
  language: 'melosong_language',
  privacy: 'melosong_privacy_prefs',
} as const;

export const SETTINGS_CHANGED_EVENT = 'melosong-settings-changed';

const DEFAULT_RADIUS = 15;
const DEFAULT_PRIVACY: PrivacyPreferences = {
  showOnNearbyList: true,
  allowDmFromAnyone: true,
};

export function notifySettingsChanged(): void {
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function getNearbyRadiusKm(): number {
  const n = Number(localStorage.getItem(KEYS.nearbyRadiusKm));
  if (!Number.isFinite(n)) return DEFAULT_RADIUS;
  return Math.min(50, Math.max(5, Math.round(n)));
}

export function setNearbyRadiusKm(km: number): void {
  const v = Math.min(50, Math.max(5, Math.round(km)));
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
}

export function getPrivacyPreferences(): PrivacyPreferences {
  try {
    const raw = localStorage.getItem(KEYS.privacy);
    if (!raw) return { ...DEFAULT_PRIVACY };
    return { ...DEFAULT_PRIVACY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

export function setPrivacyPreferences(prefs: PrivacyPreferences): void {
  localStorage.setItem(KEYS.privacy, JSON.stringify(prefs));
  notifySettingsChanged();
}
