-- Grandes villes pour ancrage live / salon (sans GPS)
CREATE TABLE IF NOT EXISTS major_cities (
  id            TEXT             PRIMARY KEY,
  name          TEXT             NOT NULL,
  country_code  TEXT             NOT NULL DEFAULT 'FR',
  label         TEXT             NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  postal_code   TEXT,
  population    INTEGER
);

CREATE INDEX IF NOT EXISTS major_cities_country_idx ON major_cities (country_code);
CREATE INDEX IF NOT EXISTS major_cities_geo_idx ON major_cities (latitude, longitude);
