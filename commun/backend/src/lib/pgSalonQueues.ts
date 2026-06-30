import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type SalonQueueItem } from '../models/schema';

export async function loadSalonQueuesFromPg(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ salon_id: string; payload: SalonQueueItem }>(
    'SELECT salon_id, payload FROM salon_queues ORDER BY salon_id, added_at ASC'
  );

  const bySalon = new Map<string, SalonQueueItem[]>();
  for (const row of res.rows) {
    const item = row.payload;
    if (!item?.id) continue;
    if (!bySalon.has(row.salon_id)) bySalon.set(row.salon_id, []);
    bySalon.get(row.salon_id)!.push(item);
  }

  for (const [salonId, queue] of bySalon) {
    db.salonQueues.set(salonId, queue);
  }

  return res.rows.length;
}

async function syncSalonQueueToPg(salonId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const queue = db.salonQueues.get(salonId) ?? [];

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM salon_queues WHERE salon_id = $1', [salonId]);
    for (const item of queue) {
      await client.query(
        `INSERT INTO salon_queues (id, salon_id, added_at, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [item.id, salonId, item.addedAt, JSON.stringify(item)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function logPgSalonQueueError(label: string, err: unknown): void {
  console.error(`[pgSalonQueues] ${label}:`, err);
}

/** Écriture asynchrone — restaure la file après redémarrage serveur. */
export function persistSalonQueueAsync(salonId: string): void {
  if (!isPostgresEnabled()) return;
  void syncSalonQueueToPg(salonId).catch((err) =>
    logPgSalonQueueError(`sync salon ${salonId}`, err)
  );
}

export async function deleteSalonQueueFromPg(salonId: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM salon_queues WHERE salon_id = $1', [salonId]);
}

export function clearSalonQueueFromPgAsync(salonId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteSalonQueueFromPg(salonId).catch((err) =>
    logPgSalonQueueError(`delete salon ${salonId}`, err)
  );
}
