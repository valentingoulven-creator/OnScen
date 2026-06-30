-- Migration 015: WebAuthn / Passkeys credentials
-- Stockage des clés biométriques (Face ID, Touch ID, empreinte Android, Windows Hello)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        TEXT         NOT NULL,
  credential_id  TEXT         NOT NULL,
  public_key     BYTEA        NOT NULL,
  counter        BIGINT       NOT NULL DEFAULT 0,
  transports     JSONB,
  device_type    TEXT,
  backed_up      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT webauthn_credentials_credential_id_unique UNIQUE (credential_id)
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx
  ON webauthn_credentials (user_id);
