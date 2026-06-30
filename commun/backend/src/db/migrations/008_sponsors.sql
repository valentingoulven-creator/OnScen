CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsors_placement
  ON sponsors ((payload->>'placement'));

CREATE INDEX IF NOT EXISTS idx_sponsors_active
  ON sponsors ((payload->>'active'));

CREATE INDEX IF NOT EXISTS idx_sponsors_priority
  ON sponsors (((payload->>'priority')::int));
