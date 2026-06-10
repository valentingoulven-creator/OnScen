import type { Live, NearbyPerson, Salon } from '../types';

/** Brief TTL cache for /geo/nearby — avoids duplicate calls during pan/zoom. */
const CACHE_TTL_MS = 10_000;

/** Round coords (~1.1 km) so small pans hit the same cache bucket. */
const COORD_DECIMALS = 2;

export interface NearbyCachePayload {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
}

interface CacheEntry {
  key: string;
  ts: number;
  data: NearbyCachePayload;
}

let entry: CacheEntry | null = null;

export function nearbyCacheKey(
  lat: number,
  lon: number,
  radiusKm: number,
  distanceFilter: boolean
): string {
  return `${lat.toFixed(COORD_DECIMALS)},${lon.toFixed(COORD_DECIMALS)},${radiusKm},${distanceFilter ? 1 : 0}`;
}

export function readNearbyCache(key: string): NearbyCachePayload | null {
  if (!entry || entry.key !== key) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

export function writeNearbyCache(key: string, data: NearbyCachePayload): void {
  entry = { key, ts: Date.now(), data };
}

export function clearNearbyCache(): void {
  entry = null;
}
