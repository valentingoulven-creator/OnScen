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

export interface AdminAuditLogRow {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminAuditListResult {
  entries: AdminAuditLogRow[];
  available: boolean;
}

function asDetails(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Dernières actions admin visant cette cible (fiche compte). */
export async function listAdminAuditForTarget(
  targetId: string,
  limit = 40
): Promise<AdminAuditListResult> {
  const id = targetId.trim();
  if (!id) return { entries: [], available: false };
  if (!isPostgresEnabled()) return { entries: [], available: false };

  const cap = Math.min(Math.max(Math.floor(limit) || 40, 1), 100);
  try {
    const { rows } = await getPool().query<{
      id: string | number;
      admin_id: string;
      action: string;
      target_type: string | null;
      target_id: string | null;
      details: unknown;
      ip: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, admin_id, action, target_type, target_id, details, ip, created_at
       FROM admin_audit_log
       WHERE target_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, cap]
    );
    return {
      available: true,
      entries: rows.map((row) => ({
        id: String(row.id),
        adminId: row.admin_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        details: asDetails(row.details),
        ip: row.ip,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      })),
    };
  } catch (err) {
    console.error(
      '[admin-audit] lecture cible échouée :',
      err instanceof Error ? err.message : err
    );
    return { entries: [], available: false };
  }
}
