import { getPool, isPostgresEnabled } from '../db/pool';
import { isPostGisEnabled } from './postgisConfig';

/** Remplit geom pour les lignes existantes sans point (après migration ou import). */
export async function backfillPostGisGeom(): Promise<void> {
  if (!isPostgresEnabled() || !isPostGisEnabled()) return;
  const pool = getPool();
  const [users, salons, lives] = await Promise.all([
    pool.query(
      `UPDATE users
       SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
       WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL`
    ),
    pool.query(
      `UPDATE salons
       SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
       WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL`
    ),
    pool.query(
      `UPDATE lives
       SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
       WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL`
    ),
  ]);
  const total =
    (users.rowCount ?? 0) + (salons.rowCount ?? 0) + (lives.rowCount ?? 0);
  if (total > 0) {
    console.log(
      `[postgis] Backfill geom — ${users.rowCount ?? 0} user(s), ${salons.rowCount ?? 0} salon(s), ${lives.rowCount ?? 0} live(s)`
    );
  }
}
