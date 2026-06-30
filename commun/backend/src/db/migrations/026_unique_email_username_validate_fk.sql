-- 026: Intégrité référentielle renforcée.
--
-- 1) Contrainte UNIQUE (case-insensitive) sur email/username : la vérification
--    d'unicité n'était faite qu'en mémoire applicative (routes/auth.ts), ce qui
--    laissait une fenêtre de race condition entre les workers PM2 (cluster).
--    Vérifié sans doublon en production avant application (0 doublon, 30 users).
--
-- 2) Validation des FK ajoutées NOT VALID en migration 025 : vérifié sans
--    orphelin en production avant application.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_email_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX users_email_unique_idx ON users (lower(email))
      WHERE email IS NOT NULL AND length(email) > 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX users_username_unique_idx ON users (lower(username))
      WHERE username IS NOT NULL AND length(username) > 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'donation_payments_sender_fk' AND NOT convalidated
  ) THEN
    ALTER TABLE donation_payments VALIDATE CONSTRAINT donation_payments_sender_fk;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_subscriptions_subscriber_fk' AND NOT convalidated
  ) THEN
    ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_subscriber_fk;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'creator_subscriptions_creator_fk' AND NOT convalidated
  ) THEN
    ALTER TABLE creator_subscriptions VALIDATE CONSTRAINT creator_subscriptions_creator_fk;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_checkouts_subscriber_fk' AND NOT convalidated
  ) THEN
    ALTER TABLE subscription_checkouts VALIDATE CONSTRAINT subscription_checkouts_subscriber_fk;
  END IF;
END $$;
