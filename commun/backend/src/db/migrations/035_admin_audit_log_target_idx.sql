-- 035: Index cible pour la fiche compte admin (journal par utilisateur).
CREATE INDEX IF NOT EXISTS admin_audit_log_target_id_idx
  ON admin_audit_log (target_id, created_at DESC);
