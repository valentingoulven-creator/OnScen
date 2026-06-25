import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
import { db, type Live, type Salon } from '../models/schema';
import { ensureSalonProposals, ensureSalonQueue } from './salonPlaybackOps';
import { purgeStaleYoutubeMetadataForStorage } from './youtubeMetadata';
/** Préfixe IDs salons Occitanie (persistés PostgreSQL). */
export const OCCITANIE_SALON_ID_PREFIX = 'salon_soundy_occitanie_';
import { SALON_LIVE_ID_PREFIX } from '../seed-salons-lives';
import { WORLD_LIVE_ID_PREFIX, WORLD_SALON_ID_PREFIX } from '../seed-world-random';

const PERSISTED_SALON_ID_PREFIXES = [
  SALON_LIVE_ID_PREFIX,
  OCCITANIE_SALON_ID_PREFIX,
  WORLD_SALON_ID_PREFIX,
];

const PERSISTED_LIVE_ID_PREFIXES = [SALON_LIVE_ID_PREFIX, WORLD_LIVE_ID_PREFIX];

function isPersistedSeedLiveId(id: string): boolean {
  return PERSISTED_LIVE_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function isPersistedSeedSalonId(id: string): boolean {
  return PERSISTED_SALON_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export async function loadSalonsLivesFromPostgres(): Promise<{ salons: number; lives: number }> {
  const pool = getPool();
  let salonsLoaded = 0;
  let livesLoaded = 0;

  const salonsRes = await pool.query<{ payload: Salon }>(
    'SELECT payload FROM salons WHERE is_active = TRUE'
  );
  for (const row of salonsRes.rows) {
    const salon = row.payload;
    if (!salon?.id) continue;
    db.salons.set(salon.id, salon);
    ensureSalonProposals(salon.id);
    if (!db.salonChats.has(salon.id)) db.salonChats.set(salon.id, []);
    salonsLoaded++;
  }

  const livesRes = await pool.query<{ payload: Live; is_active: boolean }>(
    'SELECT payload, is_active FROM lives'
  );
  for (const row of livesRes.rows) {
    const live = row.payload;
    if (!live?.id) continue;
    live.isActive = row.is_active;
    db.lives.set(live.id, live);
    if (!db.liveChats.has(live.id)) db.liveChats.set(live.id, []);
    livesLoaded++;
  }

  return { salons: salonsLoaded, lives: livesLoaded };
}

async function upsertSalon(db: DbExec, salon: Salon): Promise<void> {
  await db.query(
    `INSERT INTO salons (id, host_id, created_at, latitude, longitude, is_active, payload)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       host_id = EXCLUDED.host_id,
       created_at = EXCLUDED.created_at,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       is_active = EXCLUDED.is_active,
       payload = EXCLUDED.payload`,
    [salon.id, salon.hostId, salon.createdAt, salon.latitude, salon.longitude, JSON.stringify(salon)]
  );
}

async function upsertLive(db: DbExec, live: Live): Promise<void> {
  await db.query(
    `INSERT INTO lives (id, host_id, salon_id, started_at, is_active, latitude, longitude, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       host_id = EXCLUDED.host_id,
       salon_id = EXCLUDED.salon_id,
       started_at = EXCLUDED.started_at,
       is_active = EXCLUDED.is_active,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       payload = EXCLUDED.payload`,
    [
      live.id,
      live.hostId,
      live.salonId ?? null,
      live.startedAt,
      live.isActive,
      live.latitude,
      live.longitude,
      JSON.stringify(live),
    ]
  );
}

/** Persiste les salons/lives prod-seed-* présents en mémoire vers PostgreSQL. */
export async function saveSalonsLivesToPostgres(): Promise<{ salons: number; lives: number }> {
  const pool = getPool();
  const client = await pool.connect();
  let salonsSaved = 0;
  let livesSaved = 0;

  try {
    await client.query('BEGIN');
    for (const salon of db.salons.values()) {
      if (!isPersistedSeedSalonId(salon.id)) continue;
      await upsertSalon(client, salon);
      salonsSaved++;
    }
    for (const live of db.lives.values()) {
      if (!isPersistedSeedLiveId(live.id)) continue;
      await upsertLive(client, live);
      livesSaved++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { salons: salonsSaved, lives: livesSaved };
}

function logPgLiveError(label: string, err: unknown): void {
  console.error(`[pgSalonsLives] ${label}:`, err);
}

/** Upsert d'un salon utilisateur — persistance immédiate pour récupérer après redémarrage. */
export async function upsertSalonToPg(salon: Salon): Promise<void> {
  const queue = ensureSalonQueue(salon.id);
  purgeStaleYoutubeMetadataForStorage(salon, queue);
  await upsertSalon(getPool(), salon);
}

/** Marque un salon comme inactif en PostgreSQL (après suppression en mémoire). */
export async function markSalonInactivePg(salonId: string): Promise<void> {
  const pool = getPool();
  await pool.query('UPDATE salons SET is_active = FALSE WHERE id = $1', [salonId]);
}

export function upsertSalonToPgAsync(salon: Salon): void {
  if (!isPostgresEnabled()) return;
  void upsertSalonToPg(salon).catch((err) => logPgLiveError(`upsert salon ${salon.id}`, err));
}

export function markSalonInactivePgAsync(salonId: string): void {
  if (!isPostgresEnabled()) return;
  void markSalonInactivePg(salonId).catch((err) =>
    logPgLiveError(`mark salon inactive ${salonId}`, err)
  );
}

/** Upsert d'un live (actif ou archivé) — persistance rediff VOD après arrêt. */
export async function upsertLiveToPg(live: Live): Promise<void> {
  await upsertLive(getPool(), live);
}

export function persistLiveToPgAsync(live: Live): void {
  if (!isPostgresEnabled()) return;
  void upsertLiveToPg(live).catch((err) => logPgLiveError(`upsert live ${live.id}`, err));
}

/** Supprime un live de PostgreSQL (modération admin — ne pas restaurer au redémarrage). */
export async function deleteLiveFromPg(liveId: string): Promise<void> {
  await getPool().query('DELETE FROM lives WHERE id = $1', [liveId]);
}

export function deleteLiveFromPgAsync(liveId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteLiveFromPg(liveId).catch((err) =>
    logPgLiveError(`delete live ${liveId}`, err)
  );
}
