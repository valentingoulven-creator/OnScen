-- OnScen / OnScen — schéma PostgreSQL production (v1)
-- Aligné sur PersistedStore (backend/src/lib/storeCore.ts)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_policy (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_mode TEXT NOT NULL DEFAULT 'open',
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_invite_codes (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));

CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS direct_messages_sender_idx ON direct_messages ((payload->>'senderId'));
CREATE INDEX IF NOT EXISTS direct_messages_receiver_idx ON direct_messages ((payload->>'receiverId'));

CREATE TABLE IF NOT EXISTS message_groups (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS group_messages (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS group_messages_group_idx ON group_messages ((payload->>'groupId'));

CREATE TABLE IF NOT EXISTS group_read_cursors (
  user_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  last_read_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS dm_read_cursors (
  user_id TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  last_read_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, peer_id)
);

CREATE TABLE IF NOT EXISTS salon_chats (
  salon_id TEXT PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS live_chats (
  live_id TEXT PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS live_bans (
  live_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (live_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id TEXT NOT NULL,
  muted_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (muter_id, muted_id)
);

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id TEXT NOT NULL,
  followed_id TEXT NOT NULL,
  PRIMARY KEY (follower_id, followed_id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  fan_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (fan_id, host_id)
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS feed_posts_user_idx ON feed_posts (user_id);

CREATE TABLE IF NOT EXISTS feed_post_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS feed_post_comments_post_idx ON feed_post_comments (post_id);

CREATE TABLE IF NOT EXISTS feed_post_favorites (
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS stories_user_idx ON stories (user_id);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON stories ((payload->>'expiresAt'));

CREATE TABLE IF NOT EXISTS store_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1,
  saved_at BIGINT NOT NULL DEFAULT 0
);
