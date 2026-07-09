import { getPool, isPostgresEnabled } from '../db/pool';

export interface AdminAuditEntry {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

/**
 * Journalise une action administrative sensible (remboursement, promotion/
 * démotion admin, blocage de compte, modération...) dans la table PG
 * `admin_audit_log` (migration 030).
 *
 * Fire-and-forget volontaire : une panne d'écriture du log ne doit jamais
 * bloquer l'action admin elle-même. En msdev (pas de Postgres), on retombe
 * sur un simple console.log pour garder une trace en dev.
 */
export function logAdminAction(entry: AdminAuditEntry): void {
  const line = `[admin-audit][${entry.action}]`;
  const payload = {
    at: new Date().toISOString(),
    adminId: entry.adminId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ...entry.details,
  };

  if (!isPostgresEnabled()) {
    console.log(line, JSON.stringify(payload));
    return;
  }

  getPool()
    .query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.adminId,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip ?? null,
      ]
    )
    .catch((err) => {
      // Ne jamais faire échouer l'action admin pour un problème de logging.
      console.error(`${line} échec écriture PG :`, err instanceof Error ? err.message : err);
      console.log(line, JSON.stringify(payload));
    });
}
