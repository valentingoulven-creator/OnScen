import { getPool, isPostgresEnabled } from '../db/pool';
import { getDistanceKm } from './geo';
import { isValidLatLng } from './mapCoords';
import { MAJOR_CITIES_SEED, type MajorCitySeed } from './majorCitiesSeed';

export interface MajorCity {
  id: string;
  name: string;
  countryCode: string;
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string | null;
  population?: number | null;
}

export interface NearestMajorCity extends MajorCity {
  distanceKm: number;
}

let citiesCache: MajorCity[] | null = null;
let seedPromise: Promise<void> | null = null;

function mapRow(row: MajorCitySeed | MajorCity): MajorCity {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.countryCode,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
    postalCode: row.postalCode ?? null,
    population: row.population ?? null,
  };
}

function sortNearest(cities: MajorCity[], lat: number, lon: number, limit: number): NearestMajorCity[] {
  return cities
    .map((city) => ({
      ...city,
      distanceKm: getDistanceKm(lat, lon, city.latitude, city.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/** Insère le référentiel si la table est vide (après migration 021). */
export async function ensureMajorCitiesSeeded(): Promise<void> {
  if (!isPostgresEnabled()) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const pool = getPool();
    const countRes = await pool.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM major_cities');
    if ((countRes.rows[0]?.c ?? 0) > 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const city of MAJOR_CITIES_SEED) {
        await client.query(
          `INSERT INTO major_cities (id, name, country_code, label, latitude, longitude, postal_code, population)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            city.id,
            city.name,
            city.countryCode,
            city.label,
            city.latitude,
            city.longitude,
            city.postalCode ?? null,
            city.population ?? null,
          ]
        );
      }
      await client.query('COMMIT');
      console.log(`[major-cities] ${MAJOR_CITIES_SEED.length} villes insérées`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })().catch((err) => {
    seedPromise = null;
    console.error('[major-cities] seed failed:', err);
    throw err;
  });

  return seedPromise;
}

async function loadMajorCities(): Promise<MajorCity[]> {
  if (citiesCache) return citiesCache;

  if (isPostgresEnabled()) {
    try {
      await ensureMajorCitiesSeeded();
      const pool = getPool();
      const { rows } = await pool.query<{
        id: string;
        name: string;
        country_code: string;
        label: string;
        latitude: number;
        longitude: number;
        postal_code: string | null;
        population: number | null;
      }>('SELECT id, name, country_code, label, latitude, longitude, postal_code, population FROM major_cities');
      if (rows.length > 0) {
        citiesCache = rows.map((row) => ({
          id: row.id,
          name: row.name,
          countryCode: row.country_code,
          label: row.label,
          latitude: row.latitude,
          longitude: row.longitude,
          postalCode: row.postal_code,
          population: row.population,
        }));
        return citiesCache;
      }
    } catch (err) {
      console.warn('[major-cities] lecture PG — repli mémoire:', err);
    }
  }

  citiesCache = MAJOR_CITIES_SEED.map(mapRow);
  return citiesCache;
}

/** Les N grandes villes les plus proches d'un point (DB ou repli seed). */
export async function findNearestMajorCities(
  lat: number,
  lon: number,
  limit = 3
): Promise<NearestMajorCity[]> {
  const safeLimit = Math.min(10, Math.max(1, Math.round(limit)));
  const anchorLat = isValidLatLng(lat, lon) ? lat : MAJOR_CITIES_SEED[0]!.latitude;
  const anchorLon = isValidLatLng(lat, lon) ? lon : MAJOR_CITIES_SEED[0]!.longitude;
  const cities = await loadMajorCities();
  return sortNearest(cities, anchorLat, anchorLon, safeLimit);
}

/** Recharge le cache (tests / admin). */
export function resetMajorCitiesCacheForTests(): void {
  citiesCache = null;
  seedPromise = null;
}
