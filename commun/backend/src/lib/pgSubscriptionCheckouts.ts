import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type SubscriptionCheckout } from '../models/schema';

export async function loadSubscriptionCheckoutsFromPg(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ payload: SubscriptionCheckout }>(
    'SELECT payload FROM subscription_checkouts ORDER BY created_at ASC'
  );

  db.subscriptionCheckouts.length = 0;
  for (const row of res.rows) {
    const checkout = row.payload;
    if (checkout?.id) db.subscriptionCheckouts.push(checkout);
  }

  return db.subscriptionCheckouts.length;
}

export async function upsertSubscriptionCheckoutToPg(checkout: SubscriptionCheckout): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO subscription_checkouts (
       id, session_id, subscriber_id, creator_id, status, created_at, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       status     = EXCLUDED.status,
       payload    = EXCLUDED.payload`,
    [
      checkout.id,
      checkout.sessionId,
      checkout.subscriberId,
      checkout.creatorId,
      checkout.status,
      checkout.createdAt,
      JSON.stringify(checkout),
    ]
  );
}

export function persistSubscriptionCheckoutToPgAsync(checkout: SubscriptionCheckout): void {
  if (!isPostgresEnabled()) return;
  void upsertSubscriptionCheckoutToPg(checkout).catch((err) => {
    console.error('[pgSubscriptionCheckouts] upsert error:', err);
  });
}

export async function updateSubscriptionCheckoutStatusInPg(
  sessionId: string,
  status: SubscriptionCheckout['status']
): Promise<void> {
  const checkout = db.subscriptionCheckouts.find((c) => c.sessionId === sessionId);
  if (!checkout) return;
  checkout.status = status;
  await upsertSubscriptionCheckoutToPg(checkout);
}
