import { searchCities, type CitySuggestion } from './citySearch';
import { filterPresetCitySuggestions, PRESET_CITIES, presetCityToSuggestion } from './livesGeo';

export interface PlaceSearchCityHit {
  kind: 'city';
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
}

export interface PlaceSearchCountryHit {
  kind: 'country';
  label: string;
  code?: string;
  latitude: number;
  longitude: number;
}

export type PlaceSearchHit = PlaceSearchCityHit | PlaceSearchCountryHit;

const COUNTRY_CENTROIDS: Array<{ label: string; code: string; latitude: number; longitude: number }> = [
  { label: 'France', code: 'FR', latitude: 46.603354, longitude: 1.888334 },
  { label: 'Belgique', code: 'BE', latitude: 50.503887, longitude: 4.469936 },
  { label: 'Suisse', code: 'CH', latitude: 46.818188, longitude: 8.227512 },
  { label: 'Canada', code: 'CA', latitude: 56.130366, longitude: -106.346771 },
  { label: 'Allemagne', code: 'DE', latitude: 51.165691, longitude: 10.451526 },
  { label: 'Italie', code: 'IT', latitude: 41.87194, longitude: 12.56738 },
  { label: 'Espagne', code: 'ES', latitude: 40.463667, longitude: -3.74922 },
  { label: 'Royaume-Uni', code: 'GB', latitude: 55.378051, longitude: -3.435973 },
  { label: 'États-Unis', code: 'US', latitude: 37.09024, longitude: -95.712891 },
  { label: 'Maroc', code: 'MA', latitude: 31.791702, longitude: -7.09262 },
];

function normalizePlaceQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cityFromSuggestion(s: CitySuggestion): PlaceSearchCityHit | null {
  if (s.latitude == null || s.longitude == null) return null;
  return {
    kind: 'city',
    label: s.label,
    latitude: s.latitude,
    longitude: s.longitude,
    postalCode: s.postalCode,
  };
}

function presetCitiesForQuery(query: string): PlaceSearchCityHit[] {
  return filterPresetCitySuggestions(query, 6).map((c) => {
    const s = presetCityToSuggestion(c);
    return {
      kind: 'city' as const,
      label: s.label,
      latitude: s.latitude,
      longitude: s.longitude,
      postalCode: s.postalCode,
    };
  });
}

function countriesForQuery(query: string): PlaceSearchCountryHit[] {
  const q = normalizePlaceQuery(query);
  if (q.length < 2) return [];
  return COUNTRY_CENTROIDS.filter(
    (c) =>
      normalizePlaceQuery(c.label).includes(q) ||
      c.code.toLowerCase().startsWith(q)
  ).map((c) => ({
    kind: 'country' as const,
    label: c.label,
    code: c.code,
    latitude: c.latitude,
    longitude: c.longitude,
  }));
}

function popularCities(): PlaceSearchCityHit[] {
  return PRESET_CITIES.slice(0, 6).map((c) => {
    const s = presetCityToSuggestion(c);
    return {
      kind: 'city',
      label: s.label,
      latitude: s.latitude,
      longitude: s.longitude,
      postalCode: s.postalCode,
    };
  });
}

/** Villes + pays pour la recherche globale (côté client). */
export async function searchPlaces(
  query: string,
  opts?: { signal?: AbortSignal }
): Promise<PlaceSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return popularCities();

  const presetCities = presetCitiesForQuery(q);
  const countries = countriesForQuery(q);
  const seen = new Set<string>();
  const out: PlaceSearchHit[] = [];

  const push = (hit: PlaceSearchHit) => {
    const key = `${hit.kind}|${hit.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hit);
  };

  for (const c of countries) push(c);
  for (const c of presetCities) push(c);

  if (opts?.signal?.aborted) return out;

  try {
    const remote = await searchCities(q);
    if (opts?.signal?.aborted) return out;
    for (const item of remote) {
      const city = cityFromSuggestion(item);
      if (city) push(city);
      if (out.length >= 8) break;
    }
  } catch {
    // presets + countries suffisent
  }

  return out.slice(0, 8);
}
