CREATE TABLE IF NOT EXISTS user_compositions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS user_compositions_user_idx
  ON user_compositions (user_id, created_at DESC);
