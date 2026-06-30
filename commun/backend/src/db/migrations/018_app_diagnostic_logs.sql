CREATE TABLE IF NOT EXISTS app_diagnostic_logs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
  source TEXT NOT NULL DEFAULT 'client',
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  user_id TEXT,
  username TEXT,
  url TEXT,
  user_agent TEXT,
  client_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_diagnostic_logs_created_at
  ON app_diagnostic_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_diagnostic_logs_level
  ON app_diagnostic_logs (level);

CREATE INDEX IF NOT EXISTS idx_app_diagnostic_logs_user_id
  ON app_diagnostic_logs (user_id)
  WHERE user_id IS NOT NULL;
