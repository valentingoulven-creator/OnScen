-- 029: Ajoute des FK (NOT VALID) vers users(id) sur les tables de contenu les
-- plus critiques identifiées par l'audit DB/infra §4 (High — ~90% des tables
-- sans FK). Périmètre volontairement limité à 5 tables (sur ~30 concernées) :
-- feed_posts, notifications, gifts, user_reels, heart_events.
--
-- NOT VALID (comme le pattern déjà utilisé en migration 025) : n'exige pas de
-- scan complet bloquant au moment de l'ajout et ne bloque pas le boot en cas
-- d'orphelins historiques déjà présents. La VALIDATE CONSTRAINT (scan complet)
-- est volontairement laissée pour une intervention ultérieure dédiée, après
-- vérification qu'il n'existe pas d'orphelins en prod — HORS SCOPE ici.
--
-- Politique de suppression :
--   - Contenu utilisateur direct (feed_posts, user_reels) → CASCADE. Cohérent
--     avec le comportement déjà implémenté côté RAM
--     (`accountDeletion.ts:deleteUserAccountCascade` filtre déjà ces
--     collections à la suppression de compte).
--   - Engagement/notifications éphémères (notifications, heart_events) →
--     CASCADE. Ce sont des événements liés à l'activité du compte, sans valeur
--     d'historique comptable — déjà purgés côté RAM à la suppression de compte.
--   - gifts → SET NULL (colonne rendue nullable). Contrairement à `feed_posts`
--     etc., `gifts` porte un montant (`amount`) à valeur quasi-financière
--     (dons reçus en live) : on préserve la ligne (montants agrégés, stats
--     créateur) plutôt que de la détruire, par analogie avec
--     `donation_payments`/`creator_subscriptions` (migration 028).

-- feed_posts.user_id est déjà nullable (voir 001_init.sql) — CASCADE direct.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feed_posts_user_fk'
  ) THEN
    ALTER TABLE feed_posts
      ADD CONSTRAINT feed_posts_user_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_fk'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_recipient_fk
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_sender_fk'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_sender_fk
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE gifts ALTER COLUMN sender_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gifts_sender_fk'
  ) THEN
    ALTER TABLE gifts
      ADD CONSTRAINT gifts_sender_fk
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_reels_author_fk'
  ) THEN
    ALTER TABLE user_reels
      ADD CONSTRAINT user_reels_author_fk
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'heart_events_from_fk'
  ) THEN
    ALTER TABLE heart_events
      ADD CONSTRAINT heart_events_from_fk
      FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'heart_events_to_fk'
  ) THEN
    ALTER TABLE heart_events
      ADD CONSTRAINT heart_events_to_fk
      FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Après vérification manuelle sans orphelin en prod (hors scope de cette
-- migration) :
-- ALTER TABLE feed_posts VALIDATE CONSTRAINT feed_posts_user_fk;
-- ALTER TABLE notifications VALIDATE CONSTRAINT notifications_recipient_fk;
-- ALTER TABLE notifications VALIDATE CONSTRAINT notifications_sender_fk;
-- ALTER TABLE gifts VALIDATE CONSTRAINT gifts_sender_fk;
-- ALTER TABLE user_reels VALIDATE CONSTRAINT user_reels_author_fk;
-- ALTER TABLE heart_events VALIDATE CONSTRAINT heart_events_from_fk;
-- ALTER TABLE heart_events VALIDATE CONSTRAINT heart_events_to_fk;
