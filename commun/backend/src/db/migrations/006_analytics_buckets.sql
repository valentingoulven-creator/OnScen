ALTER TABLE store_meta
  ADD COLUMN IF NOT EXISTS analytics_buckets JSONB NOT NULL DEFAULT '{}'::jsonb;
