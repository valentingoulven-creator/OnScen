-- OnScen / OnScen — schéma complet v2
-- Entités manquantes depuis schema.ts + colonnes extraites pour performance
-- Compatible PostgreSQL 16 (Scaleway Managed Database)

-- ═══════════════════════════════════════════════════════════════════
-- SALONS (temps réel — table prête pour persistance future)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS salons (
  id          TEXT             PRIMARY KEY,
  host_id     TEXT             NOT NULL,
  created_at  BIGINT           NOT NULL,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
  payload     JSONB            NOT NULL
);

CREATE INDEX IF NOT EXISTS salons_host_idx    ON salons (host_id);
CREATE INDEX IF NOT EXISTS salons_active_idx  ON salons (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS salons_created_idx ON salons (created_at DESC);
-- Géo : requêtes "salons proches" (sans PostGIS, index simple suffit pour ~100k salons)
CREATE INDEX IF NOT EXISTS salons_geo_idx     ON salons (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- LIVES
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lives (
  id          TEXT             PRIMARY KEY,
  host_id     TEXT             NOT NULL,
  salon_id    TEXT,
  started_at  BIGINT           NOT NULL,
  is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  payload     JSONB            NOT NULL
);

CREATE INDEX IF NOT EXISTS lives_host_idx    ON lives (host_id);
CREATE INDEX IF NOT EXISTS lives_active_idx  ON lives (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS lives_started_idx ON lives (started_at DESC);
CREATE INDEX IF NOT EXISTS lives_salon_idx   ON lives (salon_id) WHERE salon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lives_geo_idx     ON lives (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- FILE D'ATTENTE SALON (SalonQueueItem)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS salon_queues (
  id        TEXT   PRIMARY KEY,
  salon_id  TEXT   NOT NULL,
  added_at  BIGINT NOT NULL,
  payload   JSONB  NOT NULL
);

CREATE INDEX IF NOT EXISTS salon_queues_salon_idx ON salon_queues (salon_id, added_at ASC);

-- ═══════════════════════════════════════════════════════════════════
-- PROPOSITIONS DE MORCEAUX (SalonTrackProposal)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS salon_proposals (
  id          TEXT   PRIMARY KEY,
  salon_id    TEXT   NOT NULL,
  proposer_id TEXT   NOT NULL,
  status      TEXT   NOT NULL DEFAULT 'pending',
  created_at  BIGINT NOT NULL,
  payload     JSONB  NOT NULL
);

CREATE INDEX IF NOT EXISTS salon_proposals_salon_idx   ON salon_proposals (salon_id, status);
CREATE INDEX IF NOT EXISTS salon_proposals_created_idx ON salon_proposals (created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- BANS SALON (SalonBan)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS salon_bans (
  salon_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  payload  JSONB NOT NULL,
  PRIMARY KEY (salon_id, user_id)
);

CREATE INDEX IF NOT EXISTS salon_bans_user_idx ON salon_bans (user_id);

-- ═══════════════════════════════════════════════════════════════════
-- CADEAUX / DONS LIVE (Gift)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gifts (
  id          TEXT    PRIMARY KEY,
  live_id     TEXT    NOT NULL,
  sender_id   TEXT    NOT NULL,
  sender_name TEXT    NOT NULL,
  gift_type   TEXT    NOT NULL,
  amount      INTEGER NOT NULL,
  timestamp   BIGINT  NOT NULL,
  payload     JSONB   NOT NULL
);

CREATE INDEX IF NOT EXISTS gifts_live_idx   ON gifts (live_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS gifts_sender_idx ON gifts (sender_id);

-- ═══════════════════════════════════════════════════════════════════
-- PAIEMENTS DONATIONS (DonationPayment)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS donation_payments (
  id                TEXT    PRIMARY KEY,
  payment_intent_id TEXT    NOT NULL,
  live_id           TEXT    NOT NULL,
  sender_id         TEXT    NOT NULL,
  amount_cents      INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'pending',
  created_at        BIGINT  NOT NULL,
  payload           JSONB   NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS donation_payments_intent_idx  ON donation_payments (payment_intent_id);
CREATE INDEX        IF NOT EXISTS donation_payments_live_idx    ON donation_payments (live_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS donation_payments_sender_idx  ON donation_payments (sender_id);

-- ═══════════════════════════════════════════════════════════════════
-- ABONNEMENTS CRÉATEUR / ONSCEN+ (CreatorSubscription)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id                     TEXT    PRIMARY KEY,
  subscriber_id          TEXT    NOT NULL,
  creator_id             TEXT    NOT NULL,
  tier_id                TEXT    NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'active',
  target_type            TEXT    NOT NULL DEFAULT 'creator',
  current_period_end     BIGINT  NOT NULL,
  created_at             BIGINT  NOT NULL,
  updated_at             BIGINT  NOT NULL,
  stripe_subscription_id TEXT,
  payload                JSONB   NOT NULL
);

CREATE INDEX        IF NOT EXISTS creator_subs_subscriber_idx ON creator_subscriptions (subscriber_id);
CREATE INDEX        IF NOT EXISTS creator_subs_creator_idx    ON creator_subscriptions (creator_id, status);
-- Abonnements actifs à renouveler (cron/webhook Stripe)
CREATE INDEX        IF NOT EXISTS creator_subs_period_idx     ON creator_subscriptions (current_period_end)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS creator_subs_stripe_idx     ON creator_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- CHECKOUT SESSIONS ABONNEMENTS (SubscriptionCheckout)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_checkouts (
  id            TEXT   PRIMARY KEY,
  session_id    TEXT   NOT NULL,
  subscriber_id TEXT   NOT NULL,
  creator_id    TEXT   NOT NULL,
  status        TEXT   NOT NULL DEFAULT 'pending',
  created_at    BIGINT NOT NULL,
  payload       JSONB  NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sub_checkouts_session_idx     ON subscription_checkouts (session_id);
CREATE INDEX        IF NOT EXISTS sub_checkouts_subscriber_idx  ON subscription_checkouts (subscriber_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- NOTES HÔTES (HostRating)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS host_ratings (
  id        TEXT     PRIMARY KEY,
  host_id   TEXT     NOT NULL,
  rater_id  TEXT     NOT NULL,
  stars     SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  timestamp BIGINT   NOT NULL,
  payload   JSONB    NOT NULL
);

CREATE INDEX        IF NOT EXISTS host_ratings_host_idx  ON host_ratings (host_id, timestamp DESC);
CREATE INDEX        IF NOT EXISTS host_ratings_rater_idx ON host_ratings (rater_id);
-- Un utilisateur ne peut noter un hôte qu'une fois
CREATE UNIQUE INDEX IF NOT EXISTS host_ratings_pair_idx  ON host_ratings (host_id, rater_id);

-- ═══════════════════════════════════════════════════════════════════
-- NOTIFICATIONS (AppNotification)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT    PRIMARY KEY,
  recipient_id TEXT    NOT NULL,
  sender_id    TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   BIGINT  NOT NULL,
  payload      JSONB   NOT NULL
);

-- Hot path : notifications non lues par destinataire (badge, liste)
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON notifications (recipient_id)
  WHERE read = FALSE;

-- ═══════════════════════════════════════════════════════════════════
-- ÉVÉNEMENTS CŒUR / LIKE (HeartEvent)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS heart_events (
  from_id    TEXT   NOT NULL,
  to_id      TEXT   NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS heart_events_to_idx   ON heart_events (to_id, created_at DESC);
CREATE INDEX IF NOT EXISTS heart_events_from_idx ON heart_events (from_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- MATCHS MUSICAUX (MusicMatch)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS music_matches (
  id         TEXT   PRIMARY KEY,
  user_id_a  TEXT   NOT NULL,
  user_id_b  TEXT   NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS music_matches_a_idx    ON music_matches (user_id_a, created_at DESC);
CREATE INDEX IF NOT EXISTS music_matches_b_idx    ON music_matches (user_id_b, created_at DESC);
-- Lookup bidirectionnel (A↔B)
CREATE INDEX IF NOT EXISTS music_matches_pair_idx ON music_matches (
  LEAST(user_id_a, user_id_b), GREATEST(user_id_a, user_id_b)
);

-- ═══════════════════════════════════════════════════════════════════
-- REELS UTILISATEURS (UserReel)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_reels (
  id         TEXT   PRIMARY KEY,
  author_id  TEXT   NOT NULL,
  created_at BIGINT NOT NULL,
  visibility TEXT   NOT NULL DEFAULT 'public',
  payload    JSONB  NOT NULL
);

CREATE INDEX IF NOT EXISTS user_reels_author_idx ON user_reels (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reels_public_idx ON user_reels (created_at DESC)
  WHERE visibility = 'public';

-- ═══════════════════════════════════════════════════════════════════
-- LIKES REELS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_likes_user_idx ON reel_likes (user_id);

-- ═══════════════════════════════════════════════════════════════════
-- COMMENTAIRES REELS (ReelComment)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_comments (
  id         TEXT   PRIMARY KEY,
  reel_id    TEXT   NOT NULL,
  user_id    TEXT   NOT NULL,
  created_at BIGINT NOT NULL,
  payload    JSONB  NOT NULL
);

CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON reel_comments (reel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reel_comments_user_idx ON reel_comments (user_id);

-- ═══════════════════════════════════════════════════════════════════
-- PARTAGES REELS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_shares (
  reel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_shares_user_idx ON reel_shares (user_id);

-- ═══════════════════════════════════════════════════════════════════
-- VUES REELS (spectateurs uniques)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reel_views (
  reel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS reel_views_reel_idx ON reel_views (reel_id);

-- ═══════════════════════════════════════════════════════════════════
-- PAIRES DM EN ATTENTE (dmPendingPairs)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dm_pending_pairs (
  sender_id   TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  PRIMARY KEY (sender_id, receiver_id)
);

-- Hot path : lister les demandes reçues non traitées
CREATE INDEX IF NOT EXISTS dm_pending_pairs_receiver_idx ON dm_pending_pairs (receiver_id, status);

-- ═══════════════════════════════════════════════════════════════════
-- AMÉLIORATION DES TABLES EXISTANTES (001)
-- Colonnes générées pour éviter des casts JSONB coûteux en hot path
-- ═══════════════════════════════════════════════════════════════════

-- Feed posts : colonne created_at native (générée depuis payload)
-- Permet ORDER BY created_at DESC sur un B-tree standard (très rapide)
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS created_at BIGINT
    GENERATED ALWAYS AS (((payload->>'createdAt')::BIGINT)) STORED;

-- Feed posts : colonne is_event pour filtrer rapidement les événements
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS is_event BOOLEAN
    GENERATED ALWAYS AS ((payload->>'isEvent')::BOOLEAN) STORED;

-- Stories : colonne expires_at native (générée depuis payload)
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS expires_at_ts BIGINT
    GENERATED ALWAYS AS (((payload->>'expiresAt')::BIGINT)) STORED;

-- Direct messages : colonnes sender/receiver/timestamp natifs
ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS sender_id   TEXT   GENERATED ALWAYS AS (payload->>'senderId')   STORED,
  ADD COLUMN IF NOT EXISTS receiver_id TEXT   GENERATED ALWAYS AS (payload->>'receiverId') STORED,
  ADD COLUMN IF NOT EXISTS timestamp   BIGINT GENERATED ALWAYS AS (((payload->>'timestamp')::BIGINT)) STORED;

-- Group messages : colonnes group_id/timestamp natifs
ALTER TABLE group_messages
  ADD COLUMN IF NOT EXISTS group_id_col  TEXT   GENERATED ALWAYS AS (payload->>'groupId')  STORED,
  ADD COLUMN IF NOT EXISTS timestamp_col BIGINT GENERATED ALWAYS AS (((payload->>'timestamp')::BIGINT)) STORED;

-- Users : colonne account_status pour filtrer comptes bloqués/pending
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT
    GENERATED ALWAYS AS (payload->>'accountStatus') STORED;

-- ═══════════════════════════════════════════════════════════════════
-- INDEX SUR LES NOUVELLES COLONNES GÉNÉRÉES
-- ═══════════════════════════════════════════════════════════════════

-- Feed pagination (chemin chaud)
CREATE INDEX IF NOT EXISTS feed_posts_created_idx      ON feed_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_user_created_idx ON feed_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_posts_events_idx       ON feed_posts (created_at DESC)
  WHERE is_event = TRUE;

-- Stories actives (carte)
CREATE INDEX IF NOT EXISTS stories_active_ts_idx ON stories (user_id, expires_at_ts DESC);
CREATE INDEX IF NOT EXISTS stories_expires_ts_idx ON stories (expires_at_ts DESC);

-- DMs par conversation (remplace les index sur payload->>'senderId')
CREATE INDEX IF NOT EXISTS direct_messages_sender_ts_idx   ON direct_messages (sender_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS direct_messages_receiver_ts_idx ON direct_messages (receiver_id, timestamp DESC);
-- Index de conversation bidirectionnel (A↔B)
CREATE INDEX IF NOT EXISTS direct_messages_conv_idx ON direct_messages (
  LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), timestamp DESC
);

-- Group messages paginés
CREATE INDEX IF NOT EXISTS group_messages_group_ts_idx ON group_messages (group_id_col, timestamp_col DESC);

-- Users par statut (admin : modération)
CREATE INDEX IF NOT EXISTS users_status_idx ON users (account_status)
  WHERE account_status IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- ENREGISTREMENT VERSION
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO schema_migrations (version) VALUES (2) ON CONFLICT DO NOTHING;
