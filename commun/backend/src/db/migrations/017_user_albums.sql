CREATE TABLE IF NOT EXISTS user_albums (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS user_albums_user_idx
  ON user_albums (user_id, created_at DESC);
