import { searchCities, type CitySuggestion } from './citySearch';
import { resolveEventCityCoordsSync } from './mapEventCoords';
import { dedupePlaceHits } from './placeSearchDedupe';
import { filterPresetCitySuggestions, PRESET_CITIES, presetCityToSuggestion } from './livesGeo';
import { WORLD_CAPITALS } from './worldCapitals';

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
  const hit: PlaceSearchCityHit = {
    kind: 'city',
    label: s.label,
    latitude: s.latitude,
    longitude: s.longitude,
    postalCode: s.postalCode,
  };
  return enrichPlaceCityCoords(hit);
}

function enrichPlaceCityCoords(hit: PlaceSearchCityHit): PlaceSearchCityHit {
  const known = resolveEventCityCoordsSync(hit.label);
  if (!known) return hit;
  return {
    ...hit,
    latitude: known.latitude,
    longitude: known.longitude,
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

  const seen = new Set<string>();
  const hits: PlaceSearchCountryHit[] = [];

  const push = (hit: PlaceSearchCountryHit) => {
    const key = normalizePlaceQuery(hit.label);
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  for (const c of COUNTRY_CENTROIDS) {
    if (normalizePlaceQuery(c.label).includes(q) || c.code.toLowerCase().startsWith(q)) {
      push({
        kind: 'country',
        label: c.label,
        code: c.code,
        latitude: c.latitude,
        longitude: c.longitude,
      });
    }
  }

  for (const cap of WORLD_CAPITALS) {
    const countryNorm = normalizePlaceQuery(cap.country);
    const capitalNorm = normalizePlaceQuery(cap.name);
    if (!countryNorm.includes(q) && !capitalNorm.includes(q)) continue;
    push({
      kind: 'country',
      label: cap.country,
      latitude: cap.lat,
      longitude: cap.lng,
    });
  }

  return hits;
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

  const countries = countriesForQuery(q);
  const merged: PlaceSearchHit[] = [...countries];

  if (opts?.signal?.aborted) return dedupePlaceHits(merged, q).slice(0, 8);

  try {
    const remote = await searchCities(q);
    if (opts?.signal?.aborted) return dedupePlaceHits(merged, q).slice(0, 8);
    for (const item of remote) {
      const city = cityFromSuggestion(item);
      if (city) merged.push(city);
    }
  } catch {
    for (const c of presetCitiesForQuery(q)) merged.push(c);
  }

  return dedupePlaceHits(merged, q).slice(0, 8);
}
