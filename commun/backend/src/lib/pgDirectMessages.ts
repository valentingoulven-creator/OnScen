import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { DirectMessage } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertDirectMessage(dbExec: DbExec, dm: DirectMessage): Promise<void> {
  await dbExec.query(
    `INSERT INTO direct_messages (id, payload) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
    [dm.id, JSON.stringify(dm)]
  );
}

export async function deleteDirectMessageFromPg(dbExec: DbExec, messageId: string): Promise<void> {
  await dbExec.query('DELETE FROM direct_messages WHERE id = $1', [messageId]);
}

export function schedulePersistDirectMessageToPg(dm: DirectMessage): void {
  if (!isPostgresEnabled()) return;
  void upsertDirectMessage(getPool(), dm).catch((e) => {
    console.error('[pgDirectMessages] Échec upsert DM PostgreSQL:', e);
  });
}

export function scheduleDeleteDirectMessageFromPg(messageId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteDirectMessageFromPg(getPool(), messageId).catch((e) => {
    console.error('[pgDirectMessages] Échec suppression DM PostgreSQL:', e);
  });
}

/** Upsert DMs puis prune des ids absents du snapshot mémoire. */
export async function syncDirectMessagesToPg(
  client: PoolClient,
  dms: DirectMessage[]
): Promise<void> {
  const ids = dms.map((d) => d.id);
  for (const dm of dms) {
    await upsertDirectMessage(client, dm);
  }
  if (ids.length) {
    await client.query('DELETE FROM direct_messages WHERE NOT (id = ANY($1::text[]))', [ids]);
  } else {
    await client.query('DELETE FROM direct_messages');
  }
}
