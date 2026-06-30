/** Cache court-terme pour GET /api/geo/nearby (pan carte répété). */

export const NEARBY_CACHE_TTL_MS = 20_000;
export const NEARBY_CACHE_MAX_ENTRIES = 500;

export const MAX_NEARBY_SALONS = 200;
export const MAX_NEARBY_LIVES = 100;
export const MAX_NEARBY_PEOPLE = 150;

export interface NearbyResponseBody {
  salons: unknown[];
  lives: unknown[];
  people: unknown[];
}

interface CacheEntry {
  at: number;
  body: NearbyResponseBody;
}

const cache = new Map<string, CacheEntry>();

export function buildNearbyCacheKey(input: {
  userId: string;
  lat: number;
  lon: number;
  maxRadiusKm: number | null;
  distanceFilter: boolean;
  bounds: { swLat: number; swLng: number; neLat: number; neLng: number } | null;
}): string {
  const { userId, lat, lon, maxRadiusKm, distanceFilter, bounds } = input;
  const latR = lat.toFixed(3);
  const lonR = lon.toFixed(3);
  const radiusPart = maxRadiusKm == null ? 'all' : maxRadiusKm.toFixed(1);
  const filterPart = distanceFilter ? '1' : '0';
  const boundsPart = bounds
    ? `${bounds.swLat.toFixed(3)}:${bounds.swLng.toFixed(3)}:${bounds.neLat.toFixed(3)}:${bounds.neLng.toFixed(3)}`
    : '';
  return `${userId}|${latR}|${lonR}|${radiusPart}|${filterPart}|${boundsPart}`;
}

export function getNearbyCached(key: string): NearbyResponseBody | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > NEARBY_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

export function setNearbyCached(key: string, body: NearbyResponseBody): void {
  if (cache.size >= NEARBY_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), body });
}

/** Vide le cache (tests / après mutation géo massive). */
export function clearNearbyCache(): void {
  cache.clear();
}
