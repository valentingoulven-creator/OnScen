-- Persistance prod : buckets sponsors + jours de connexion (rétention cohortes).
ALTER TABLE store_meta
  ADD COLUMN IF NOT EXISTS sponsor_analytics_buckets JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE store_meta
  ADD COLUMN IF NOT EXISTS user_login_days JSONB NOT NULL DEFAULT '{}'::jsonb;
