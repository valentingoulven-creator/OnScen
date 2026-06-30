import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type UserComposition } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertComposition(dbExec: DbExec, composition: UserComposition): Promise<void> {
  await dbExec.query(
    `INSERT INTO user_compositions (id, user_id, created_at, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       created_at = EXCLUDED.created_at,
       payload = EXCLUDED.payload`,
    [composition.id, composition.userId, composition.createdAt, JSON.stringify(composition)]
  );
}

export async function deleteCompositionFromPg(dbExec: DbExec, compositionId: string): Promise<void> {
  await dbExec.query('DELETE FROM user_compositions WHERE id = $1', [compositionId]);
}

export async function deleteCompositionsByUserFromPg(dbExec: DbExec, userId: string): Promise<void> {
  await dbExec.query('DELETE FROM user_compositions WHERE user_id = $1', [userId]);
}

export async function loadCompositionsFromPg(): Promise<{ compositions: number }> {
  const pool = getPool();
  const res = await pool.query<{ payload: UserComposition }>(
    'SELECT payload FROM user_compositions ORDER BY created_at DESC'
  );

  db.compositions.length = 0;
  for (const row of res.rows) {
    const composition = row.payload;
    if (composition?.id && composition.userId) db.compositions.push(composition);
  }

  return { compositions: db.compositions.length };
}

export async function persistCompositionToPg(composition: UserComposition): Promise<void> {
  if (!isPostgresEnabled()) return;
  await upsertComposition(getPool(), composition);
}

export async function removeCompositionFromPg(compositionId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteCompositionFromPg(getPool(), compositionId);
}

export async function removeCompositionsByUserFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  await deleteCompositionsByUserFromPg(getPool(), userId);
}

export function schedulePersistCompositionToPg(composition: UserComposition): void {
  if (!isPostgresEnabled()) return;
  void persistCompositionToPg(composition).catch((e) => {
    console.error('[pgCompositions] Échec upsert composition PostgreSQL:', e);
  });
}

export function scheduleDeleteCompositionFromPg(compositionId: string): void {
  if (!isPostgresEnabled()) return;
  void removeCompositionFromPg(compositionId).catch((e) => {
    console.error('[pgCompositions] Échec suppression composition PostgreSQL:', e);
  });
}

export function scheduleDeleteCompositionsByUserFromPg(userId: string): void {
  if (!isPostgresEnabled()) return;
  void removeCompositionsByUserFromPg(userId).catch((e) => {
    console.error('[pgCompositions] Échec suppression compositions utilisateur PostgreSQL:', e);
  });
}
