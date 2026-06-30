-- 024: Correct schema drift when migration 002 created tables before 010/012 added columns.

ALTER TABLE donation_payments ADD COLUMN IF NOT EXISTS host_id TEXT;
ALTER TABLE donation_payments ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER;

ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS tier_label TEXT;
ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

UPDATE creator_subscriptions
SET tier_label = COALESCE(tier_label, payload->>'tierLabel', tier_id)
WHERE tier_label IS NULL;

UPDATE creator_subscriptions
SET amount_cents = COALESCE(amount_cents, NULLIF(payload->>'amountCents', '')::INTEGER, 0)
WHERE amount_cents IS NULL;

UPDATE creator_subscriptions
SET payment_mode = COALESCE(payment_mode, payload->>'paymentMode', 'stripe')
WHERE payment_mode IS NULL;

UPDATE donation_payments
SET host_id = COALESCE(host_id, payload->>'hostId')
WHERE host_id IS NULL;

UPDATE donation_payments
SET platform_fee_cents = COALESCE(
  platform_fee_cents,
  NULLIF(payload->>'platformFeeCents', '')::INTEGER
)
WHERE platform_fee_cents IS NULL;

CREATE INDEX IF NOT EXISTS idx_donation_payments_host_id ON donation_payments (host_id)
  WHERE host_id IS NOT NULL;
