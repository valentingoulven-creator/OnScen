import { randomUUID } from 'crypto';
import { getDatabaseUrl, getPool } from '../db/pool';

export type DiagnosticLogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface DiagnosticLogInput {
  id?: string;
  createdAt?: string;
  level: DiagnosticLogLevel;
  source?: string;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  userId?: string | null;
  username?: string | null;
  url?: string | null;
  userAgent?: string | null;
  clientId?: string | null;
}

export interface DiagnosticLogRow extends DiagnosticLogInput {
  id: string;
  createdAt: string;
}

const RETENTION_INTERVAL = '5 months';
const MAX_MESSAGE_LEN = 8000;
const MAX_STACK_LEN = 16000;

let pruneScheduled = false;

export function canPersistDiagnosticLogs(): boolean {
  return Boolean(getDatabaseUrl()?.trim());
}

function clampText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeLevel(level: string): DiagnosticLogLevel {
  if (level === 'error' || level === 'warn' || level === 'info' || level === 'debug') return level;
  return 'info';
}

export async function appendDiagnosticLogs(entries: DiagnosticLogInput[]): Promise<number> {
  if (!canPersistDiagnosticLogs() || entries.length === 0) return 0;

  const pool = getPool();
  const rows = entries.slice(0, 50).map((entry) => ({
    id: entry.id?.trim() || randomUUID(),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    level: normalizeLevel(entry.level),
    source: clampText(entry.source ?? 'client', 120) ?? 'client',
    message: clampText(entry.message, MAX_MESSAGE_LEN) ?? '(empty)',
    stack: clampText(entry.stack, MAX_STACK_LEN),
    context: entry.context && typeof entry.context === 'object' ? entry.context : null,
    userId: clampText(entry.userId, 80),
    username: clampText(entry.username, 80),
    url: clampText(entry.url, 2000),
    userAgent: clampText(entry.userAgent, 500),
    clientId: clampText(entry.clientId, 80),
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        `INSERT INTO app_diagnostic_logs (
          id, created_at, level, source, message, stack, context,
          user_id, username, url, user_agent, client_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.createdAt,
          row.level,
          row.source,
          row.message,
          row.stack,
          row.context ? JSON.stringify(row.context) : null,
          row.userId,
          row.username,
          row.url,
          row.userAgent,
          row.clientId,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  schedulePruneOldDiagnosticLogs();
  return rows.length;
}

function schedulePruneOldDiagnosticLogs(): void {
  if (pruneScheduled || !canPersistDiagnosticLogs()) return;
  pruneScheduled = true;
  setTimeout(() => {
    pruneScheduled = false;
    void pruneOldDiagnosticLogs().catch((err) => {
      console.error('[diagnostic-logs] prune failed:', err);
    });
  }, 5000);
}

export async function pruneOldDiagnosticLogs(): Promise<number> {
  if (!canPersistDiagnosticLogs()) return 0;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM app_diagnostic_logs WHERE created_at < NOW() - INTERVAL '${RETENTION_INTERVAL}'`
  );
  return result.rowCount ?? 0;
}

export interface ListDiagnosticLogsOpts {
  limit?: number;
  level?: DiagnosticLogLevel | 'all';
  userId?: string;
  clientId?: string;
  since?: string;
  q?: string;
}

export async function listDiagnosticLogs(
  opts: ListDiagnosticLogsOpts = {}
): Promise<{ logs: DiagnosticLogRow[]; total: number }> {
  if (!canPersistDiagnosticLogs()) {
    return { logs: [], total: 0 };
  }

  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const params: unknown[] = [];
  const where: string[] = [`created_at >= NOW() - INTERVAL '${RETENTION_INTERVAL}'`];

  if (opts.level && opts.level !== 'all') {
    params.push(opts.level);
    where.push(`level = $${params.length}`);
  }
  if (opts.userId?.trim()) {
    params.push(opts.userId.trim());
    where.push(`user_id = $${params.length}`);
  }
  if (opts.clientId?.trim()) {
    params.push(opts.clientId.trim());
    where.push(`client_id = $${params.length}`);
  }
  if (opts.since?.trim()) {
    params.push(opts.since.trim());
    where.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim().slice(0, 120)}%`);
    where.push(`(message ILIKE $${params.length} OR stack ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit);

  const pool = getPool();
  const [rowsRes, countRes] = await Promise.all([
    pool.query(
      `SELECT id, created_at, level, source, message, stack, context,
              user_id, username, url, user_agent, client_id
       FROM app_diagnostic_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    ),
    pool.query(`SELECT COUNT(*)::int AS total FROM app_diagnostic_logs ${whereSql}`, params.slice(0, -1)),
  ]);

  const logs: DiagnosticLogRow[] = rowsRes.rows.map((row) => ({
    id: row.id as string,
    createdAt: new Date(row.created_at as string).toISOString(),
    level: normalizeLevel(row.level as string),
    source: row.source as string,
    message: row.message as string,
    stack: (row.stack as string | null) ?? undefined,
    context: (row.context as Record<string, unknown> | null) ?? undefined,
    userId: (row.user_id as string | null) ?? undefined,
    username: (row.username as string | null) ?? undefined,
    url: (row.url as string | null) ?? undefined,
    userAgent: (row.user_agent as string | null) ?? undefined,
    clientId: (row.client_id as string | null) ?? undefined,
  }));

  return { logs, total: (countRes.rows[0]?.total as number) ?? logs.length };
}
