import { getPool, isPostgresEnabled } from '../db/pool';
import { backfillPostGisGeom } from './pgGeoBackfill';

let postgisAvailable: boolean | null = null;

/** Détecte PostGIS au boot (après migrations). */
export async function initPostGis(): Promise<boolean> {
  if (!isPostgresEnabled()) {
    postgisAvailable = false;
    return false;
  }
  try {
    const pool = getPool();
    const ext = await pool.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'postgis'`
    );
    if (ext.rows.length === 0) {
      postgisAvailable = false;
      console.warn('[postgis] Extension postgis absente — requêtes nearby en scan RAM');
      return false;
    }
    await pool.query('SELECT PostGIS_Version()');
    postgisAvailable = true;
    console.log('[postgis] PostGIS actif — requêtes ST_DWithin pour nearby');
    void backfillPostGisGeom().catch((err) => {
      console.warn('[postgis] Backfill geom échoué:', err);
    });
    return true;
  } catch (err) {
    postgisAvailable = false;
    console.warn('[postgis] PostGIS indisponible — fallback scan RAM:', err);
    return false;
  }
}

export function isPostGisEnabled(): boolean {
  return postgisAvailable === true;
}

export interface PostGisEntityGeomStats {
  total: number;
  withGeom: number;
}

export interface PostGisAdminReport {
  enabled: boolean;
  version?: string;
  entities?: {
    users: PostGisEntityGeomStats;
    salons: PostGisEntityGeomStats;
    lives: PostGisEntityGeomStats;
  };
}

/** Rapport PostGIS pour l'admin diagnostic (couverture geom). */
export async function getPostGisAdminReport(): Promise<PostGisAdminReport> {
  if (!isPostgresEnabled() || !isPostGisEnabled()) {
    return { enabled: false };
  }
  try {
    const pool = getPool();
    const verRes = await pool.query<{ version: string }>('SELECT PostGIS_Version() AS version');
    const countsRes = await pool.query<{ entity: string; total: number; with_geom: number }>(
      `SELECT 'users' AS entity, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE geom IS NOT NULL)::int AS with_geom FROM users
       UNION ALL
       SELECT 'salons', COUNT(*)::int, COUNT(*) FILTER (WHERE geom IS NOT NULL)::int FROM salons
       UNION ALL
       SELECT 'lives', COUNT(*)::int, COUNT(*) FILTER (WHERE geom IS NOT NULL)::int FROM lives`
    );
    const byEntity = Object.fromEntries(
      countsRes.rows.map((r) => [r.entity, { total: r.total, withGeom: r.with_geom }])
    ) as Record<string, PostGisEntityGeomStats>;
    return {
      enabled: true,
      version: verRes.rows[0]?.version,
      entities: {
        users: byEntity.users ?? { total: 0, withGeom: 0 },
        salons: byEntity.salons ?? { total: 0, withGeom: 0 },
        lives: byEntity.lives ?? { total: 0, withGeom: 0 },
      },
    };
  } catch (err) {
    console.warn('[postgis] admin report failed:', err);
    return { enabled: false };
  }
}

/** Réinitialise le cache (tests). */
export function resetPostGisCacheForTests(): void {
  postgisAvailable = null;
}

export function kmToMeters(radiusKm: number): number {
  return Math.max(0, radiusKm) * 1000;
}
