import type { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import { db, type Live, type Salon } from '../models/schema';
import { ensureSalonQueue, ensureSalonProposals } from './salonPlaybackOps';
import { OCCITANIE_SALON_ID_PREFIX } from '../seed-occitanie-spotify';
import { SALON_LIVE_ID_PREFIX } from '../seed-salons-lives';

const PERSISTED_SALON_ID_PREFIXES = [SALON_LIVE_ID_PREFIX, OCCITANIE_SALON_ID_PREFIX];

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
    ensureSalonQueue(salon.id);
    ensureSalonProposals(salon.id);
    if (!db.salonChats.has(salon.id)) db.salonChats.set(salon.id, []);
    salonsLoaded++;
  }

  const livesRes = await pool.query<{ payload: Live }>(
    'SELECT payload FROM lives WHERE is_active = TRUE'
  );
  for (const row of livesRes.rows) {
    const live = row.payload;
    if (!live?.id) continue;
    db.lives.set(live.id, live);
    if (!db.liveChats.has(live.id)) db.liveChats.set(live.id, []);
    livesLoaded++;
  }

  return { salons: salonsLoaded, lives: livesLoaded };
}

async function upsertSalon(client: PoolClient, salon: Salon): Promise<void> {
  await client.query(
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

async function upsertLive(client: PoolClient, live: Live): Promise<void> {
  await client.query(
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
      if (!live.id.startsWith(SALON_LIVE_ID_PREFIX)) continue;
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
