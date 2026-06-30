CREATE TABLE IF NOT EXISTS live_gifts (
  id TEXT PRIMARY KEY,
  live_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  host_id TEXT,
  gift_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_mode TEXT,
  payment_intent_id TEXT,
  timestamp BIGINT NOT NULL,
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_gifts_payment_intent
  ON live_gifts (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_gifts_live_id ON live_gifts (live_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_sender_id ON live_gifts (sender_id);
CREATE INDEX IF NOT EXISTS idx_live_gifts_timestamp ON live_gifts (timestamp);

CREATE TABLE IF NOT EXISTS donation_payments (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL UNIQUE,
  live_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  host_id TEXT,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donation_payments_live_id ON donation_payments (live_id);
CREATE INDEX IF NOT EXISTS idx_donation_payments_sender_id ON donation_payments (sender_id);
CREATE INDEX IF NOT EXISTS idx_donation_payments_created_at ON donation_payments (created_at);
