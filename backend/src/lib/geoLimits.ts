import { getMsdevBotCount, isLocalDevEnvironment } from '../seed-bots';

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

const NAMED_MAP_BOTS = 8;

function envCap(name: string, fallback: number, hardMax: number): number {
  const n = Number(process.env[name]);
  const base = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(hardMax, Math.max(20, Math.round(base)));
}

/** Limites réponses carte / proximité (rayon actif). */
export const GEO_NEARBY_MAX_SALONS = envCap('GEO_NEARBY_MAX_SALONS', 120, 200);
export const GEO_NEARBY_MAX_LIVES = envCap('GEO_NEARBY_MAX_LIVES', 80, 80);
export const GEO_NEARBY_MAX_PEOPLE = envCap('GEO_NEARBY_MAX_PEOPLE', 100, 150);
export const LIVES_LIST_MAX = envCap('LIVES_LIST_MAX', 80, 80);

/** Plafond liste nearbyPeople avant slice geo (souvent ≥ GEO_NEARBY_MAX_PEOPLE). */
export const NEARBY_PEOPLE_LIMIT_DEFAULT = envCap('NEARBY_PEOPLE_LIMIT', 200, 1500);

/** Cap msdev quand le filtre distance est désactivé (bots monde + marge). */
export function resolveMsdevWorldMapCap(): number {
  const bots = getMsdevBotCount();
  if (bots <= 0) return GEO_NEARBY_MAX_PEOPLE;
  const fromEnv = Number(process.env.GEO_NEARBY_WORLD_CAP);
  const target =
    Number.isFinite(fromEnv) && fromEnv > 0
      ? fromEnv
      : bots + NAMED_MAP_BOTS + 20;
  return Math.min(50000, Math.max(GEO_NEARBY_MAX_PEOPLE, Math.round(target)));
}

export interface GeoNearbyLimits {
  maxSalons: number;
  maxLives: number;
  maxPeople: number;
  nearbyPeopleLimit: number;
}

export function resolveGeoNearbyLimits(distanceFilter: boolean): GeoNearbyLimits {
  const world =
    !distanceFilter && isLocalDevEnvironment() && getMsdevBotCount() > 0;
  if (world) {
    const cap = resolveMsdevWorldMapCap();
    return {
      maxSalons: cap,
      maxLives: GEO_NEARBY_MAX_LIVES,
      maxPeople: cap,
      nearbyPeopleLimit: cap,
    };
  }
  return {
    maxSalons: GEO_NEARBY_MAX_SALONS,
    maxLives: GEO_NEARBY_MAX_LIVES,
    maxPeople: GEO_NEARBY_MAX_PEOPLE,
    nearbyPeopleLimit: NEARBY_PEOPLE_LIMIT_DEFAULT,
  };
}
