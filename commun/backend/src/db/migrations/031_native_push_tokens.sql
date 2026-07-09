-- Notifications push natives (Capacitor iOS/Android, via FCM) — distinctes du Web Push
-- (push_subscriptions, VAPID/PushManager). Un même utilisateur peut avoir plusieurs devices.
CREATE TABLE IF NOT EXISTS native_push_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS native_push_tokens_token_idx ON native_push_tokens (token);
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx ON native_push_tokens (user_id);
