-- OnScen / OnScen — index production v3
-- Index composites, partiels et GIN pour les chemins chauds à grande échelle
-- Compatible PostgreSQL 16 (Scaleway Managed Database)
-- NOTE : ces index complètent ceux créés dans 001 et 002.

-- ═══════════════════════════════════════════════════════════════════
-- USERS — recherche plein texte (pseudo + bio + ville)
-- ═══════════════════════════════════════════════════════════════════
-- Dictionnaire 'simple' : pas de stemming, neutre pour le français et l'anglais
CREATE INDEX IF NOT EXISTS users_fts_idx ON users
  USING gin (to_tsvector('simple',
    coalesce(lower(username), '') || ' ' ||
    coalesce(lower(payload->>'bio'), '') || ' ' ||
    coalesce(lower(payload->>'city'), '')
  ));

-- Lookup par username (insensible à la casse) — hot path : login, @mention
-- Déjà dans 001, mais on s'assure qu'il couvre aussi username extrait
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

-- ═══════════════════════════════════════════════════════════════════
-- USERS — localisation géographique (carte, salons proches)
-- ═══════════════════════════════════════════════════════════════════
-- Index composite (lat, lng) sur les utilisateurs ayant une position
CREATE INDEX IF NOT EXISTS users_geo_idx ON users (
  ((payload->>'latitude')::DOUBLE PRECISION),
  ((payload->>'longitude')::DOUBLE PRECISION)
)
WHERE payload->>'latitude' IS NOT NULL
  AND payload->>'longitude' IS NOT NULL
  AND (payload->>'isGhostMode')::BOOLEAN IS NOT TRUE;

-- ═══════════════════════════════════════════════════════════════════
-- FEED POSTS — reposts (resharedFromId)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS feed_posts_reshared_idx ON feed_posts ((payload->>'resharedFromId'))
  WHERE payload->>'resharedFromId' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- FEED POST COMMENTS — tri par date dans un post (pagination)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS feed_comments_post_created_idx ON feed_post_comments (
  post_id,
  ((payload->>'createdAt')::BIGINT) DESC
);

-- ═══════════════════════════════════════════════════════════════════
-- FOLLOWS — index inverse (qui suit X ?)
-- ═══════════════════════════════════════════════════════════════════
-- 001 n'a pas d'index sur followed_id → slow queries pour "followers count"
CREATE INDEX IF NOT EXISTS user_follows_followed_idx ON user_follows (followed_id);

-- ═══════════════════════════════════════════════════════════════════
-- FAVORITES (fan → host)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS user_favorites_host_idx ON user_favorites (host_id);

-- ═══════════════════════════════════════════════════════════════════
-- STORIES — recherche par tag utilisateur (payload->'taggedUserIds')
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS stories_tagged_idx ON stories
  USING gin ((payload->'taggedUserIds'));

-- ═══════════════════════════════════════════════════════════════════
-- STORIES — actives seulement (carte, pas les expirées)
-- expires_at_ts vient de la migration 002
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS stories_live_idx ON stories (expires_at_ts DESC)
  WHERE expires_at_ts > 0;

-- ═══════════════════════════════════════════════════════════════════
-- DIRECT MESSAGES — GIN sur les réactions (payload->'reactions')
-- Requêtes : "tous les messages avec réaction X"
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS direct_messages_reactions_idx ON direct_messages
  USING gin ((payload->'reactions'))
  WHERE payload->'reactions' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- MESSAGE GROUPS — membres (payload->'memberIds' est un tableau JSON)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS message_groups_members_idx ON message_groups
  USING gin ((payload->'memberIds'));

-- ═══════════════════════════════════════════════════════════════════
-- CREATOR SUBSCRIPTIONS — lookup abonnement actif d'un subscriber
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS creator_subs_active_sub_idx ON creator_subscriptions (
  subscriber_id, creator_id
)
WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════
-- NOTIFICATIONS — nettoyage : index pour purge des anciennes notifs
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at ASC);

-- ═══════════════════════════════════════════════════════════════════
-- HEART EVENTS — double lookup "ai-je déjà liké ?"
-- ═══════════════════════════════════════════════════════════════════
-- Le PRIMARY KEY (from_id, to_id) couvre déjà le sens A→B
-- L'index to_id → from_id (déjà dans 002) couvre le sens inverse

-- ═══════════════════════════════════════════════════════════════════
-- MUSIC MATCHES — GIN sur les payloads JSONB volumeux (si ajoutés)
-- ═══════════════════════════════════════════════════════════════════
-- (non requis pour l'instant — la table est mince)

-- ═══════════════════════════════════════════════════════════════════
-- GIFTS / DONATIONS — agrégat par live (total dons en direct)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS gifts_live_type_idx ON gifts (live_id, gift_type);

-- ═══════════════════════════════════════════════════════════════════
-- USER REELS — GIN sur genre (payload->>'genre') pour exploration
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS user_reels_genre_idx ON user_reels ((payload->>'genre'))
  WHERE payload->>'genre' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- ACCESS INVITE CODES — lookup par code (payload->>'code')
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON access_invite_codes ((payload->>'code'))
  WHERE payload->>'code' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- ENREGISTREMENT VERSION
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO schema_migrations (version) VALUES (3) ON CONFLICT DO NOTHING;
