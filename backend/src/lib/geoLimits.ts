import { isLocalDevEnvironment } from '../seed-bots';

/** Rayon recherche carte / proximité (km). */
export const NEARBY_RADIUS_MIN = 1;
/** Plafond côté serveur : accepte la saisie manuelle jusqu'à 20 000 km. */
export const NEARBY_RADIUS_MAX = 20000;
export const DEFAULT_NEARBY_RADIUS_KM = isLocalDevEnvironment() ? 50 : 10;

/** 0 ou invalide → minimum 1 km. Accepte jusqu'à 20 000 km (saisie manuelle). */
export function clampNearbyRadiusKm(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return NEARBY_RADIUS_MIN;
  return Math.min(NEARBY_RADIUS_MAX, Math.max(NEARBY_RADIUS_MIN, Math.round(km)));
}

export function parseDistanceFilterQuery(value: string | undefined): boolean {
  if (value === 'false' || value === '0') return false;
  if (value === 'true' || value === '1') return true;
  return true;
}

/** Rayon effectif pour filtrage géo ; null = pas de limite (distanceFilter désactivé). */
export function resolveNearbyRadiusKm(
  radiusKm: number,
  distanceFilter: boolean
): number | null {
  if (!distanceFilter) return null;
  return clampNearbyRadiusKm(radiusKm);
}
