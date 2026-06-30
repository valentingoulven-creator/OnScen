import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type CreatorSubscription } from '../models/schema';

export async function loadCreatorSubscriptionsFromPg(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ payload: CreatorSubscription }>(
    'SELECT payload FROM creator_subscriptions ORDER BY created_at ASC'
  );

  db.creatorSubscriptions.length = 0;
  for (const row of res.rows) {
    const sub = row.payload;
    if (sub?.id) db.creatorSubscriptions.push(sub);
  }

  return db.creatorSubscriptions.length;
}

export async function upsertCreatorSubscriptionToPg(sub: CreatorSubscription): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO creator_subscriptions (
       id, subscriber_id, creator_id, tier_id, tier_label, amount_cents,
       target_type, status, payment_mode, stripe_subscription_id, stripe_customer_id,
       current_period_end, created_at, updated_at, payload
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       status                 = EXCLUDED.status,
       tier_id                = EXCLUDED.tier_id,
       tier_label             = EXCLUDED.tier_label,
       amount_cents           = EXCLUDED.amount_cents,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_customer_id     = EXCLUDED.stripe_customer_id,
       current_period_end     = EXCLUDED.current_period_end,
       updated_at             = EXCLUDED.updated_at,
       payload                = EXCLUDED.payload`,
    [
      sub.id,
      sub.subscriberId,
      sub.creatorId,
      sub.tierId,
      sub.tierLabel,
      sub.amountCents,
      sub.targetType,
      sub.status,
      sub.paymentMode,
      sub.stripeSubscriptionId ?? null,
      sub.stripeCustomerId ?? null,
      sub.currentPeriodEnd,
      sub.createdAt,
      sub.updatedAt,
      JSON.stringify(sub),
    ]
  );
}

/** Écriture asynchrone — n'interrompt pas le flux paiement/webhook. */
export function persistCreatorSubscriptionToPgAsync(sub: CreatorSubscription): void {
  if (!isPostgresEnabled()) return;
  void upsertCreatorSubscriptionToPg(sub).catch((err) => {
    console.error('[pgSubscriptions] upsert error:', err);
  });
}
