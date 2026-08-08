import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;
import { db, type Live, type Salon } from '../models/schema';
import { clearSalonPlaybackData, ensureSalonProposals, ensureSalonQueue } from './salonPlaybackOps';
import { purgeStaleYoutubeMetadataForStorage } from './youtubeMetadata';
/** Préfixe IDs salons Occitanie (persistés PostgreSQL). */
export const OCCITANIE_SALON_ID_PREFIX = 'salon_onscen_occitanie_';
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
    if (live.isActive && live.hostId) {
      // Reconstruit l'index hostId → liveId (perdu au redémarrage du process) pour
      // que la garde anti-doublon de POST /lives/start reste correcte après un restart.
      db.activeLiveByHost.set(live.hostId, live.id);
    }
    livesLoaded++;
  }

  return { salons: salonsLoaded, lives: livesLoaded };
}

async function upsertSalon(db: DbExec, salon: Salon): Promise<void> {
  await db.query(
    `INSERT INTO salons (id, host_id, created_at, latitude, longitude, geom, is_active, payload)
     VALUES (
       $1, $2, $3, $4::double precision, $5::double precision,
       CASE WHEN $4::double precision IS NOT NULL AND $5::double precision IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography
         ELSE NULL
       END,
       TRUE, $6::jsonb
     )
     ON CONFLICT (id) DO UPDATE SET
       host_id = EXCLUDED.host_id,
       created_at = EXCLUDED.created_at,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       geom = EXCLUDED.geom,
       is_active = EXCLUDED.is_active,
       payload = EXCLUDED.payload`,
    [salon.id, salon.hostId, salon.createdAt, salon.latitude, salon.longitude, JSON.stringify(salon)]
  );
}

async function upsertLive(db: DbExec, live: Live): Promise<void> {
  await db.query(
    `INSERT INTO lives (id, host_id, salon_id, started_at, is_active, latitude, longitude, geom, payload)
     VALUES (
       $1, $2, $3, $4, $5, $6::double precision, $7::double precision,
       CASE WHEN $6::double precision IS NOT NULL AND $7::double precision IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geography
         ELSE NULL
       END,
       $8::jsonb
     )
     ON CONFLICT (id) DO UPDATE SET
       host_id = EXCLUDED.host_id,
       salon_id = EXCLUDED.salon_id,
       started_at = EXCLUDED.started_at,
       is_active = EXCLUDED.is_active,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       geom = EXCLUDED.geom,
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
  if (!isPostgresEnabled()) return;
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

function registerSalonInMemory(salon: Salon): void {
  db.salons.set(salon.id, salon);
  ensureSalonQueue(salon.id);
  ensureSalonProposals(salon.id);
  if (!db.salonChats.has(salon.id)) db.salonChats.set(salon.id, []);
}

function dropSalonFromMemory(salonId: string): void {
  db.salons.delete(salonId);
  db.salonChats.delete(salonId);
  clearSalonPlaybackData(salonId);
}

function registerLiveInMemory(live: Live): void {
  db.lives.set(live.id, live);
  if (!db.liveChats.has(live.id)) db.liveChats.set(live.id, []);
  if (live.isActive && live.hostId) {
    db.activeLiveByHost.set(live.hostId, live.id);
  }
}

/**
 * Charge un live actif depuis PostgreSQL dans le store RAM (cluster PM2).
 * Sans cela, un live tout juste créé (POST /lives/start) sur un worker PM2 n'est
 * visible que de ce worker : un socket connecté à un autre worker (host ou viewer)
 * ne trouve pas le live en RAM et le chat (join_live / live_message) échoue
 * silencieusement.
 */
export async function hydrateLiveFromPostgres(liveId: string): Promise<Live | undefined> {
  const cached = db.lives.get(liveId);
  if (cached) return cached;
  if (!isPostgresEnabled()) return undefined;

  const pool = getPool();
  const res = await pool.query<{ payload: Live }>(
    'SELECT payload FROM lives WHERE id = $1 AND is_active = TRUE',
    [liveId]
  );
  const live = res.rows[0]?.payload;
  if (!live?.id) return undefined;
  live.isActive = true;
  registerLiveInMemory(live);
  return live;
}

/** Charge un salon actif depuis PostgreSQL dans le store RAM (cluster PM2). */
export async function hydrateSalonFromPostgres(salonId: string): Promise<Salon | undefined> {
  const cached = db.salons.get(salonId);
  if (cached) return cached;
  if (!isPostgresEnabled()) return undefined;

  const pool = getPool();
  const res = await pool.query<{ payload: Salon }>(
    'SELECT payload FROM salons WHERE id = $1 AND is_active = TRUE',
    [salonId]
  );
  const salon = res.rows[0]?.payload;
  if (!salon?.id) return undefined;
  registerSalonInMemory(salon);
  return salon;
}

/** Charge plusieurs salons actifs manquants en RAM (carte / nearby). */
export async function hydrateSalonsFromPostgres(salonIds: string[]): Promise<number> {
  if (!isPostgresEnabled() || salonIds.length === 0) return 0;
  const missing = [...new Set(salonIds.filter((id) => id && !db.salons.has(id)))];
  if (missing.length === 0) return 0;

  const pool = getPool();
  const res = await pool.query<{ payload: Salon }>(
    'SELECT payload FROM salons WHERE id = ANY($1::text[]) AND is_active = TRUE',
    [missing]
  );
  let loaded = 0;
  for (const row of res.rows) {
    const salon = row.payload;
    if (!salon?.id) continue;
    registerSalonInMemory(salon);
    loaded++;
  }
  return loaded;
}

/**
 * Aligne la RAM du worker avec PostgreSQL pour un hôte (salons actifs uniquement).
 * Supprime les salons fantômes restés en mémoire après arrêt sur un autre worker.
 */
export async function reconcileHostSalonsWithPostgres(hostId: string): Promise<void> {
  if (!isPostgresEnabled()) return;

  const pool = getPool();
  const res = await pool.query<{ id: string; payload: Salon }>(
    'SELECT id, payload FROM salons WHERE host_id = $1 AND is_active = TRUE',
    [hostId]
  );
  const activeIds = new Set<string>();
  for (const row of res.rows) {
    activeIds.add(row.id);
    const salon = row.payload;
    if (!salon?.id) continue;
    registerSalonInMemory(salon);
  }

  for (const s of [...db.salons.values()]) {
    if (s.hostId !== hostId || activeIds.has(s.id)) continue;
    dropSalonFromMemory(s.id);
  }
}

/**
 * Source de vérité salon : vérifie PostgreSQL (is_active) puis hydrate si besoin.
 * Indispensable en mode PM2 cluster (2+ workers, store RAM non partagé).
 */
export async function getSalonFromStore(salonId: string): Promise<Salon | undefined> {
  if (!salonId) return undefined;
  if (!isPostgresEnabled()) return db.salons.get(salonId);

  const pool = getPool();
  const res = await pool.query<{ payload: Salon; is_active: boolean }>(
    'SELECT payload, is_active FROM salons WHERE id = $1',
    [salonId]
  );
  const row = res.rows[0];
  if (!row?.is_active) {
    if (db.salons.has(salonId)) dropSalonFromMemory(salonId);
    return undefined;
  }

  const salon = row.payload;
  if (!salon?.id) return undefined;
  registerSalonInMemory(salon);
  return salon;
}
