import type { Live, Salon } from '../types';

export const FRANCE_COUNTRY_CODE = 'FR';
export const LIVES_COUNTRY_FILTER_ALL = 'all';
export const LIVES_COUNTRY_FILTER_STORAGE_KEY = 'melosong_lives_country_filter';

interface CountryRegion {
  code: string;
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/** Régions plus petites en premier — aligné sur commun/backend/src/lib/liveCountry.ts */
const REGIONS: CountryRegion[] = [
  { code: 'BE', name: 'Belgique', latMin: 49.45, latMax: 51.55, lonMin: 2.45, lonMax: 6.45 },
  { code: 'NL', name: 'Pays-Bas', latMin: 50.75, latMax: 53.58, lonMin: 3.2, lonMax: 7.25 },
  { code: 'CH', name: 'Suisse', latMin: 45.78, latMax: 47.85, lonMin: 5.9, lonMax: 10.55 },
  { code: 'LU', name: 'Luxembourg', latMin: 49.44, latMax: 50.2, lonMin: 5.7, lonMax: 6.55 },
  { code: 'AT', name: 'Autriche', latMin: 46.35, latMax: 49.05, lonMin: 9.5, lonMax: 17.2 },
  { code: 'PT', name: 'Portugal', latMin: 36.95, latMax: 42.15, lonMin: -9.55, lonMax: -6.18 },
  { code: 'IE', name: 'Irlande', latMin: 51.4, latMax: 55.45, lonMin: -10.5, lonMax: -5.9 },
  { code: 'SG', name: 'Singapour', latMin: 1.15, latMax: 1.47, lonMin: 103.6, lonMax: 104.1 },
  { code: 'AE', name: 'Émirats arabes unis', latMin: 22.6, latMax: 26.1, lonMin: 51.5, lonMax: 56.4 },
  { code: 'IL', name: 'Israël', latMin: 29.45, latMax: 33.35, lonMin: 34.25, lonMax: 35.9 },
  { code: 'FR', name: 'France', latMin: 41.3, latMax: 51.1, lonMin: -5.15, lonMax: 9.65 },
  { code: 'DE', name: 'Allemagne', latMin: 47.25, latMax: 55.1, lonMin: 5.85, lonMax: 15.05 },
  { code: 'GB', name: 'Royaume-Uni', latMin: 49.85, latMax: 60.9, lonMin: -8.65, lonMax: 1.8 },
  { code: 'ES', name: 'Espagne', latMin: 35.95, latMax: 43.8, lonMin: -9.35, lonMax: 4.35 },
  { code: 'IT', name: 'Italie', latMin: 36.65, latMax: 47.1, lonMin: 6.6, lonMax: 18.55 },
  { code: 'PL', name: 'Pologne', latMin: 49.0, latMax: 54.85, lonMin: 14.1, lonMax: 24.15 },
  { code: 'SE', name: 'Suède', latMin: 55.3, latMax: 69.1, lonMin: 11.1, lonMax: 24.2 },
  { code: 'NO', name: 'Norvège', latMin: 57.95, latMax: 71.2, lonMin: 4.5, lonMax: 31.2 },
  { code: 'TR', name: 'Turquie', latMin: 35.8, latMax: 42.15, lonMin: 25.95, lonMax: 44.8 },
  { code: 'RU', name: 'Russie', latMin: 41.2, latMax: 81.9, lonMin: 19.6, lonMax: 180 },
  { code: 'US', name: 'États-Unis', latMin: 24.5, latMax: 49.5, lonMin: -125, lonMax: -66.9 },
  { code: 'CA', name: 'Canada', latMin: 41.7, latMax: 83.1, lonMin: -141, lonMax: -52.6 },
  { code: 'MX', name: 'Mexique', latMin: 14.5, latMax: 32.75, lonMin: -118.4, lonMax: -86.7 },
  { code: 'BR', name: 'Brésil', latMin: -33.75, latMax: 5.27, lonMin: -73.99, lonMax: -34.79 },
  { code: 'AR', name: 'Argentine', latMin: -55.1, latMax: -21.8, lonMin: -73.6, lonMax: -53.6 },
  { code: 'JP', name: 'Japon', latMin: 24.2, latMax: 45.55, lonMin: 122.9, lonMax: 153.99 },
  { code: 'KR', name: 'Corée du Sud', latMin: 33.1, latMax: 38.65, lonMin: 124.6, lonMax: 131.9 },
  { code: 'CN', name: 'Chine', latMin: 18.15, latMax: 53.55, lonMin: 73.5, lonMax: 134.77 },
  { code: 'IN', name: 'Inde', latMin: 6.75, latMax: 35.5, lonMin: 68.1, lonMax: 97.4 },
  { code: 'ID', name: 'Indonésie', latMin: -11.0, latMax: 6.2, lonMin: 95.0, lonMax: 141.0 },
  { code: 'TH', name: 'Thaïlande', latMin: 5.6, latMax: 20.5, lonMin: 97.3, lonMax: 105.65 },
  { code: 'VN', name: 'Vietnam', latMin: 8.35, latMax: 23.4, lonMin: 102.1, lonMax: 109.5 },
  { code: 'PH', name: 'Philippines', latMin: 4.6, latMax: 21.1, lonMin: 116.9, lonMax: 126.6 },
  { code: 'AU', name: 'Australie', latMin: -43.65, latMax: -10.05, lonMin: 112.9, lonMax: 153.65 },
  { code: 'NZ', name: 'Nouvelle-Zélande', latMin: -47.3, latMax: -34.4, lonMin: 166.4, lonMax: 178.6 },
  { code: 'ZA', name: 'Afrique du Sud', latMin: -34.85, latMax: -22.1, lonMin: 16.45, lonMax: 32.9 },
  { code: 'EG', name: 'Égypte', latMin: 22.0, latMax: 31.7, lonMin: 24.7, lonMax: 36.9 },
  { code: 'NG', name: 'Nigeria', latMin: 4.25, latMax: 13.9, lonMin: 2.7, lonMax: 14.7 },
];

export function countryFromCoordinates(latitude: number, longitude: number): { code: string; name: string } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  for (const r of REGIONS) {
    if (
      latitude >= r.latMin &&
      latitude <= r.latMax &&
      longitude >= r.lonMin &&
      longitude <= r.lonMax
    ) {
      return { code: r.code, name: r.name };
    }
  }
  return null;
}

export function getLivesCountryFilter(): string {
  try {
    const raw = localStorage.getItem(LIVES_COUNTRY_FILTER_STORAGE_KEY);
    if (!raw) return LIVES_COUNTRY_FILTER_ALL;
    const parsed = JSON.parse(raw) as { code?: string };
    return typeof parsed.code === 'string' && parsed.code ? parsed.code : LIVES_COUNTRY_FILTER_ALL;
  } catch {
    return LIVES_COUNTRY_FILTER_ALL;
  }
}

export function setLivesCountryFilter(code: string): string {
  const next = code || LIVES_COUNTRY_FILTER_ALL;
  localStorage.setItem(LIVES_COUNTRY_FILTER_STORAGE_KEY, JSON.stringify({ code: next }));
  return next;
}

export function liveCountryCode(live: Live): string | null {
  const code = live.countryCode?.trim().toUpperCase();
  return code && code.length === 2 ? code : null;
}

/** Pays d'un live sur la carte : countryCode API, sinon bbox coords. */
export function resolveLiveMarkerCountryCode(live: Live): string | null {
  return liveCountryCode(live) ?? countryFromCoordinates(live.latitude, live.longitude)?.code ?? null;
}

/** Pays d'un salon live sur la carte (coords). */
export function salonMarkerCountryCode(salon: Pick<Salon, 'latitude' | 'longitude'>): string | null {
  return countryFromCoordinates(salon.latitude, salon.longitude)?.code ?? null;
}

export function hasLivesOutsideFrance(lives: Live[]): boolean {
  return lives.some((l) => {
    const code = liveCountryCode(l);
    return code != null && code !== FRANCE_COUNTRY_CODE;
  });
}

export interface LiveCountryOption {
  code: string;
  name: string;
}

/** Pays distincts présents dans les lives actifs (France en premier, puis alpha). */
export function collectLiveCountryOptions(lives: Live[]): LiveCountryOption[] {
  const byCode = new Map<string, string>();
  for (const live of lives) {
    const code = liveCountryCode(live);
    if (!code) continue;
    const name = live.countryName?.trim() || code;
    if (!byCode.has(code)) byCode.set(code, name);
  }
  const options = [...byCode.entries()].map(([code, name]) => ({ code, name }));
  options.sort((a, b) => {
    if (a.code === FRANCE_COUNTRY_CODE) return -1;
    if (b.code === FRANCE_COUNTRY_CODE) return 1;
    return a.name.localeCompare(b.name, 'fr');
  });
  return options;
}

export function filterLivesByCountry(lives: Live[], countryFilter: string): Live[] {
  if (!countryFilter || countryFilter === LIVES_COUNTRY_FILTER_ALL) return lives;
  const wanted = countryFilter.toUpperCase();
  return lives.filter((l) => liveCountryCode(l) === wanted);
}
