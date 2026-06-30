import type { Live } from '../types';

export const FRANCE_COUNTRY_CODE = 'FR';
export const LIVES_COUNTRY_FILTER_ALL = 'all';
export const LIVES_COUNTRY_FILTER_STORAGE_KEY = 'melosong_lives_country_filter';

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
