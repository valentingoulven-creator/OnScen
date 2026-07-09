-- 030: Journal d'audit admin structuré (audit sécurité §9 — A09 OWASP).
--
-- Contexte : les actions administratives sensibles (remboursements, promotion/
-- démotion admin, suspension de compte) n'étaient tracées que par
-- `console.log`, perdu au redémarrage du process et non interrogeable. Cette
-- table capture qui a fait quoi, sur quelle cible, à quel moment — nécessaire
-- pour une investigation post-incident et pour la conformité (traçabilité des
-- accès aux données personnelles).
--
-- NOT VALID volontairement omis ici : nouvelle table, pas de FK vers une table
-- volumineuse existante à risque de scan bloquant.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          BIGSERIAL     PRIMARY KEY,
  admin_id    TEXT          NOT NULL,
  action      TEXT          NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_admin_id_idx ON admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log (action);
