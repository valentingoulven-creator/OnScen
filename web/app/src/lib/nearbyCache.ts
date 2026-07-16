import type { Live, NearbyPerson, Salon } from '../types';

/**
 * Brief TTL cache for /geo/nearby — avoids duplicate calls during pan/zoom.
 * Alignée sur le cache serveur (nearbyResponseCache.ts, TTL 20s / 3 décimales
 * ~111m) : un TTL/précision client plus larges que le serveur (10s / ~1.1km
 * avant ce fix) créaient une fenêtre où le client affichait des données
 * figées plus longtemps que nécessaire sans requête, avec une granularité de
 * bucket incohérente entre les deux caches.
 */
const CACHE_TTL_MS = 15_000;

/** Round coords (~111m) so small pans hit the same cache bucket. */
const COORD_DECIMALS = 3;

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
