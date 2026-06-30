-- PostGIS — index géographiques GiST pour requêtes nearby (ST_DWithin)
-- Nécessite l'extension PostGIS sur l'instance PostgreSQL (Scaleway : activer dans la console).

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Users ───────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS geom geography(POINT, 4326);

UPDATE users
SET
  latitude = NULLIF(payload->>'latitude', '')::double precision,
  longitude = NULLIF(payload->>'longitude', '')::double precision
WHERE latitude IS NULL
  AND payload->>'latitude' IS NOT NULL
  AND payload->>'longitude' IS NOT NULL;

UPDATE users
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geom IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_geom_gist_idx ON users USING GIST (geom)
  WHERE geom IS NOT NULL;

-- ─── Salons ──────────────────────────────────────────────────────────────────
ALTER TABLE salons ADD COLUMN IF NOT EXISTS geom geography(POINT, 4326);

UPDATE salons
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geom IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS salons_geom_gist_idx ON salons USING GIST (geom)
  WHERE geom IS NOT NULL;

-- ─── Lives ───────────────────────────────────────────────────────────────────
ALTER TABLE lives ADD COLUMN IF NOT EXISTS geom geography(POINT, 4326);

UPDATE lives
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geom IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS lives_geom_gist_idx ON lives USING GIST (geom)
  WHERE geom IS NOT NULL;
