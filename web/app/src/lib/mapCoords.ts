import { DEFAULT_CENTER } from './livesGeo';

export const DEFAULT_MAP_CENTER: [number, number] = [...DEFAULT_CENTER];

export function isValidCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function isValidLatLng(lat: unknown, lon: unknown): boolean {
  return (
    isValidCoord(lat) &&
    isValidCoord(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function sanitizeLatLngTuple(
  lat: unknown,
  lon: unknown,
  fallback: [number, number] = DEFAULT_MAP_CENTER
): [number, number] {
  if (isValidLatLng(lat, lon)) return [lat as number, lon as number];
  return fallback;
}
