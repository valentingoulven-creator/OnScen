ALTER TABLE store_meta
  ADD COLUMN IF NOT EXISTS stripe_subscription_ledger JSONB NOT NULL DEFAULT '{}'::jsonb;
