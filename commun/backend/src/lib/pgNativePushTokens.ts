import { getPool, isPostgresEnabled } from '../db/pool';

export type NativePushPlatform = 'ios' | 'android';

export interface NativePushTokenRecord {
  id: string;
  userId: string;
  token: string;
  platform: NativePushPlatform;
  createdAt: number;
}

export async function upsertNativePushToken(record: NativePushTokenRecord): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO native_push_tokens (id, user_id, token, platform, created_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       token = EXCLUDED.token,
       platform = EXCLUDED.platform,
       payload = EXCLUDED.payload`,
    [
      record.id,
      record.userId,
      record.token,
      record.platform,
      record.createdAt,
      JSON.stringify(record),
    ]
  );
}

export async function deleteNativePushTokenByToken(token: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM native_push_tokens WHERE token = $1', [token]);
}

/** Dé-enregistrement utilisateur : ne supprime que les tokens appartenant à `userId`. */
export async function deleteNativePushTokenByTokenForUser(
  token: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query('DELETE FROM native_push_tokens WHERE token = $1 AND user_id = $2', [
    token,
    userId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function listNativePushTokensForUser(
  userId: string
): Promise<NativePushTokenRecord[]> {
  const pool = getPool();
  const res = await pool.query<{ payload: NativePushTokenRecord }>(
    'SELECT payload FROM native_push_tokens WHERE user_id = $1',
    [userId]
  );
  return res.rows.map((r) => r.payload).filter((p) => p?.token);
}

export function isNativePushTokensPgEnabled(): boolean {
  return isPostgresEnabled();
}
