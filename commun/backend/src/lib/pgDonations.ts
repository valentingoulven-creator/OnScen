import { getPool, isPostgresEnabled } from '../db/pool';
import { db, type DonationPayment, type Gift } from '../models/schema';

export async function loadDonationsFromPg(): Promise<{ gifts: number; payments: number }> {
  const pool = getPool();

  const giftsRes = await pool.query<{ payload: Gift }>(
    'SELECT payload FROM live_gifts ORDER BY timestamp ASC'
  );
  const paymentsRes = await pool.query<{ payload: DonationPayment }>(
    'SELECT payload FROM donation_payments ORDER BY created_at ASC'
  );

  db.gifts.length = 0;
  for (const row of giftsRes.rows) {
    const gift = row.payload;
    if (gift?.id) db.gifts.push(gift);
  }

  db.donationPayments.length = 0;
  for (const row of paymentsRes.rows) {
    const payment = row.payload;
    if (payment?.id) db.donationPayments.push(payment);
  }

  return { gifts: db.gifts.length, payments: db.donationPayments.length };
}

export async function upsertGiftToPg(gift: Gift, hostId?: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO live_gifts (
       id, live_id, sender_id, host_id, gift_type, amount,
       payment_mode, payment_intent_id, timestamp, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       live_id = EXCLUDED.live_id,
       sender_id = EXCLUDED.sender_id,
       host_id = EXCLUDED.host_id,
       gift_type = EXCLUDED.gift_type,
       amount = EXCLUDED.amount,
       payment_mode = EXCLUDED.payment_mode,
       payment_intent_id = EXCLUDED.payment_intent_id,
       timestamp = EXCLUDED.timestamp,
       payload = EXCLUDED.payload`,
    [
      gift.id,
      gift.liveId,
      gift.senderId,
      hostId ?? null,
      gift.giftType,
      gift.amount,
      gift.paymentMode ?? null,
      gift.paymentIntentId ?? null,
      gift.timestamp,
      JSON.stringify(gift),
    ]
  );
}

export async function upsertDonationPaymentToPg(payment: DonationPayment): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO donation_payments (
       id, payment_intent_id, live_id, sender_id, host_id,
       amount_cents, platform_fee_cents, status, created_at, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       payment_intent_id = EXCLUDED.payment_intent_id,
       live_id = EXCLUDED.live_id,
       sender_id = EXCLUDED.sender_id,
       host_id = EXCLUDED.host_id,
       amount_cents = EXCLUDED.amount_cents,
       platform_fee_cents = EXCLUDED.platform_fee_cents,
       status = EXCLUDED.status,
       created_at = EXCLUDED.created_at,
       payload = EXCLUDED.payload`,
    [
      payment.id,
      payment.paymentIntentId,
      payment.liveId,
      payment.senderId,
      payment.hostId ?? null,
      payment.amountCents,
      payment.platformFeeCents ?? null,
      payment.status,
      payment.createdAt,
      JSON.stringify(payment),
    ]
  );
}

function logPgDonationError(label: string, err: unknown): void {
  console.error(`[pgDonations] ${label}:`, err);
}

/**
 * Vérifie en base (pas seulement en mémoire) si un paiement Stripe a déjà été
 * crédité. Nécessaire car `db.gifts`/`db.donationPayments` sont des stores en
 * mémoire par process PM2 : un webhook Stripe relivré peut atterrir sur un
 * autre worker qui n'a pas encore vu ce paiement en RAM (risque de double
 * crédit en cluster). `live_gifts.payment_intent_id` et
 * `donation_payments.payment_intent_id` portent une contrainte UNIQUE
 * (migration 010) qui protège en dernier recours au niveau SQL.
 */
export async function donationPaymentIntentExistsInPg(paymentIntentId: string): Promise<boolean> {
  if (!isPostgresEnabled()) return false;
  const pool = getPool();
  const res = await pool.query(
    `SELECT 1 FROM live_gifts WHERE payment_intent_id = $1
     UNION ALL
     SELECT 1 FROM donation_payments WHERE payment_intent_id = $1 AND status = 'succeeded'
     LIMIT 1`,
    [paymentIntentId]
  );
  return (res.rowCount ?? 0) > 0;
}

/** Écriture asynchrone — n'interrompt pas le flux paiement live. */
export function persistGiftToPgAsync(gift: Gift, hostId?: string): void {
  if (!isPostgresEnabled()) return;
  void upsertGiftToPg(gift, hostId).catch((err) => logPgDonationError('upsert gift', err));
}

export function persistDonationPaymentToPgAsync(payment: DonationPayment): void {
  if (!isPostgresEnabled()) return;
  void upsertDonationPaymentToPg(payment).catch((err) =>
    logPgDonationError('upsert payment', err)
  );
}
