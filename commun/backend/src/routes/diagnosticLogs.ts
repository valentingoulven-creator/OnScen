import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, verifyAuthToken, AUTH_TOKEN_HEADER, AUTH_COOKIE_NAME } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  appendDiagnosticLogs,
  canPersistDiagnosticLogs,
  listDiagnosticLogs,
  type DiagnosticLogInput,
  type DiagnosticLogLevel,
} from '../lib/appDiagnosticLogs';

export const diagnosticLogsRouter = Router();

const ingestLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes de logs' },
});

function extractOptionalToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const cookieToken = cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) return cookieToken.trim();
  const header = req.headers[AUTH_TOKEN_HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return null;
}

function attachOptionalUser(req: Request): void {
  const token = extractOptionalToken(req);
  if (!token) return;
  const decoded = verifyAuthToken(token);
  if (decoded) {
    (req as Request & { user?: { id: string; username: string } }).user = decoded;
  }
}

function parseIncomingEntries(body: unknown): DiagnosticLogInput[] {
  if (!body || typeof body !== 'object') return [];
  const entries = (body as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  const out: DiagnosticLogInput[] = [];
  for (const raw of entries.slice(0, 50)) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const message = typeof e.message === 'string' ? e.message.trim() : '';
    if (!message) continue;
    const level = typeof e.level === 'string' ? (e.level as DiagnosticLogLevel) : 'info';
    out.push({
      id: typeof e.id === 'string' ? e.id : undefined,
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : undefined,
      level,
      source: typeof e.source === 'string' ? e.source : 'client',
      message,
      stack: typeof e.stack === 'string' ? e.stack : undefined,
      context: e.context && typeof e.context === 'object' ? (e.context as Record<string, unknown>) : undefined,
      userId: typeof e.userId === 'string' ? e.userId : undefined,
      username: typeof e.username === 'string' ? e.username : undefined,
      url: typeof e.url === 'string' ? e.url : undefined,
      userAgent: typeof e.userAgent === 'string' ? e.userAgent : undefined,
      clientId: typeof e.clientId === 'string' ? e.clientId : undefined,
    });
  }
  return out;
}

/** Client-side error / diagnostic log ingestion (optional auth). */
diagnosticLogsRouter.post('/', ingestLimiter, (req: Request, res: Response) => {
  attachOptionalUser(req);
  const user = (req as Request & { user?: { id: string; username: string } }).user;
  const entries = parseIncomingEntries(req.body).map((entry) => ({
    ...entry,
    userId: entry.userId ?? user?.id ?? null,
    username: entry.username ?? user?.username ?? null,
    userAgent: entry.userAgent ?? req.headers['user-agent'] ?? null,
  }));

  if (entries.length === 0) {
    res.status(400).json({ error: 'Aucune entrée valide' });
    return;
  }

  if (!canPersistDiagnosticLogs()) {
    res.json({ ok: true, stored: 0, persisted: false });
    return;
  }

  void appendDiagnosticLogs(entries)
    .then((stored) => res.json({ ok: true, stored, persisted: true }))
    .catch((err) => {
      console.error('[diagnostic-logs] ingest failed:', err);
      res.status(500).json({ error: 'Impossible de sauvegarder les logs' });
    });
});

/** Admin: list persisted client diagnostic logs (retention 5 months). */
diagnosticLogsRouter.get('/admin/diagnostic-logs', authenticateJWT, async (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;

  const level = typeof req.query.level === 'string' ? req.query.level : 'all';
  const limit = Number(req.query.limit) || 200;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;

  try {
    const { logs, total } = await listDiagnosticLogs({
      limit,
      level: level as DiagnosticLogLevel | 'all',
      userId,
      clientId,
      since,
      q,
    });
    res.json({
      logs,
      count: logs.length,
      total,
      persisted: canPersistDiagnosticLogs(),
      retentionMonths: 5,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[diagnostic-logs] list failed:', err);
    res.status(500).json({ error: 'Impossible de charger les logs' });
  }
});
