import { getPool, isPostgresEnabled } from '../db/pool';

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: number;
}

export async function upsertPushSubscription(record: PushSubscriptionRecord): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       endpoint = EXCLUDED.endpoint,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       payload = EXCLUDED.payload`,
    [
      record.id,
      record.userId,
      record.endpoint,
      record.p256dh,
      record.auth,
      record.createdAt,
      JSON.stringify(record),
    ]
  );
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

export async function listPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  const pool = getPool();
  const res = await pool.query<{ payload: PushSubscriptionRecord }>(
    'SELECT payload FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  return res.rows.map((r) => r.payload).filter((p) => p?.endpoint);
}

export function isPushSubscriptionsPgEnabled(): boolean {
  return isPostgresEnabled();
}
