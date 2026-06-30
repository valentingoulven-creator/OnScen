import { getPool, isPostgresEnabled } from '../db/pool';

/** Purge PostgreSQL rows tied to a user (post-RAM cascade). */
export async function purgeUserAccountFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  const pool = getPool();

  await pool.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
  await pool.query(
    'DELETE FROM creator_subscriptions WHERE subscriber_id = $1 OR creator_id = $1',
    [userId]
  );
  await pool.query('DELETE FROM subscription_checkouts WHERE subscriber_id = $1', [userId]);
  await pool.query('DELETE FROM donation_payments WHERE sender_id = $1', [userId]);
}
