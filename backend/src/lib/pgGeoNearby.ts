import { getPool, isPostgresEnabled } from '../db/pool';
import { isPostGisEnabled, kmToMeters } from './postgisConfig';

export interface GeoNearbyHit {
  id: string;
  distanceKm: number;
}

const MAX_GEO_RESULTS = 500;

/**
 * Utilisateurs avec coordonnées en PG dans le rayon (prefiltre — confidentialité appliquée ensuite en RAM).
 */
export async function findNearbyUserIdsPg(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<GeoNearbyHit[]> {
  if (!isPostgresEnabled() || !isPostGisEnabled()) return [];
  const radiusM = kmToMeters(radiusKm);
  const pool = getPool();
  const res = await pool.query<{ id: string; distance_km: string }>(
    `SELECT u.id,
            ST_Distance(
              u.geom,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1000.0 AS distance_km
     FROM users u
     WHERE u.geom IS NOT NULL
       AND COALESCE((u.payload->>'isGhostMode')::boolean, false) = false
       AND ST_DWithin(
             u.geom,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $3
           )
     ORDER BY distance_km
     LIMIT $4`,
    [lat, lon, radiusM, MAX_GEO_RESULTS]
  );
  return res.rows.map((r) => ({
    id: r.id,
    distanceKm: Number(r.distance_km),
  }));
}

/** Salons actifs dans le rayon. */
export async function findNearbySalonIdsPg(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Array<GeoNearbyHit & { hostId: string }>> {
  if (!isPostgresEnabled() || !isPostGisEnabled()) return [];
  const radiusM = kmToMeters(radiusKm);
  const pool = getPool();
  const res = await pool.query<{ id: string; host_id: string; distance_km: string }>(
    `SELECT s.id,
            s.host_id,
            ST_Distance(
              s.geom,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1000.0 AS distance_km
     FROM salons s
     WHERE s.geom IS NOT NULL
       AND s.is_active = TRUE
       AND ST_DWithin(
             s.geom,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $3
           )
     ORDER BY distance_km
     LIMIT $4`,
    [lat, lon, radiusM, MAX_GEO_RESULTS]
  );
  return res.rows.map((r) => ({
    id: r.id,
    hostId: r.host_id,
    distanceKm: Number(r.distance_km),
  }));
}

/** Lives actifs standalone (sans salon) dans le rayon. */
export async function findNearbyStandaloneLiveIdsPg(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Array<GeoNearbyHit & { hostId: string }>> {
  if (!isPostgresEnabled() || !isPostGisEnabled()) return [];
  const radiusM = kmToMeters(radiusKm);
  const pool = getPool();
  const res = await pool.query<{ id: string; host_id: string; distance_km: string }>(
    `SELECT l.id,
            l.host_id,
            ST_Distance(
              l.geom,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1000.0 AS distance_km
     FROM lives l
     WHERE l.geom IS NOT NULL
       AND l.is_active = TRUE
       AND l.salon_id IS NULL
       AND ST_DWithin(
             l.geom,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $3
           )
     ORDER BY distance_km
     LIMIT $4`,
    [lat, lon, radiusM, MAX_GEO_RESULTS]
  );
  return res.rows.map((r) => ({
    id: r.id,
    hostId: r.host_id,
    distanceKm: Number(r.distance_km),
  }));
}

export interface NearbyGeoCandidates {
  userIds: Set<string>;
  salonIds: Set<string>;
  liveIds: Set<string>;
}

/** Préfiltre IDs candidats via PostGIS (union users + hôtes salons/lives). */
export async function loadNearbyGeoCandidates(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<NearbyGeoCandidates | null> {
  if (!isPostGisEnabled()) return null;
  const [users, salons, lives] = await Promise.all([
    findNearbyUserIdsPg(lat, lon, radiusKm),
    findNearbySalonIdsPg(lat, lon, radiusKm),
    findNearbyStandaloneLiveIdsPg(lat, lon, radiusKm),
  ]);
  const userIds = new Set<string>(users.map((u) => u.id));
  for (const s of salons) userIds.add(s.hostId);
  for (const l of lives) userIds.add(l.hostId);
  return {
    userIds,
    salonIds: new Set(salons.map((s) => s.id)),
    liveIds: new Set(lives.map((l) => l.id)),
  };
}
