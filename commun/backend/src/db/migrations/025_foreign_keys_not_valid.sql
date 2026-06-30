-- 025: Foreign keys (NOT VALID) — intégrité progressive sans bloquer le boot si orphelins historiques.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donation_payments_sender_fk'
  ) THEN
    ALTER TABLE donation_payments
      ADD CONSTRAINT donation_payments_sender_fk
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_subscriptions_subscriber_fk'
  ) THEN
    ALTER TABLE creator_subscriptions
      ADD CONSTRAINT creator_subscriptions_subscriber_fk
      FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creator_subscriptions_creator_fk'
  ) THEN
    ALTER TABLE creator_subscriptions
      ADD CONSTRAINT creator_subscriptions_creator_fk
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_checkouts_subscriber_fk'
  ) THEN
    ALTER TABLE subscription_checkouts
      ADD CONSTRAINT subscription_checkouts_subscriber_fk
      FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Après nettoyage orphelins : ALTER TABLE ... VALIDATE CONSTRAINT donation_payments_sender_fk;
