-- 012: Table abonnements créateurs + colonne password_hash sécurisée

-- Table dédiée pour les abonnements créateurs / OnScen+
-- (remplace le stockage en RAM uniquement, permet de restaurer après redémarrage)
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id                    TEXT PRIMARY KEY,
  subscriber_id         TEXT NOT NULL,
  creator_id            TEXT NOT NULL,
  tier_id               TEXT NOT NULL,
  tier_label            TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  target_type           TEXT NOT NULL,
  status                TEXT NOT NULL,
  payment_mode          TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id    TEXT,
  current_period_end    BIGINT NOT NULL,
  created_at            BIGINT NOT NULL,
  updated_at            BIGINT NOT NULL,
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_creator_subs_subscriber
  ON creator_subscriptions (subscriber_id);

CREATE INDEX IF NOT EXISTS idx_creator_subs_creator
  ON creator_subscriptions (creator_id);

CREATE INDEX IF NOT EXISTS idx_creator_subs_status
  ON creator_subscriptions (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_subs_stripe_id
  ON creator_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Colonne dédiée pour le hash bcrypt des mots de passe
-- (extrait du JSONB payload pour éviter l'exposition dans les logs PostgreSQL)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Backfill des utilisateurs existants depuis le payload
UPDATE users
SET password_hash = payload->>'passwordHash'
WHERE password_hash IS NULL
  AND payload->>'passwordHash' IS NOT NULL;
