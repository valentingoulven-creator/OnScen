import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { isAccessAdmin } from '../lib/accessControl';

const execAsync = promisify(exec);

export const adminSyslogRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

export interface SyslogLine {
  ts: string;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  raw: string;
}

function classifyLevel(line: string): 'error' | 'warn' | 'info' {
  const l = line.toLowerCase();
  if (/\b(error|err|fatal|critical|exception|crash|uncaught|unhandled|failed|fail)\b/.test(l)) return 'error';
  if (/\b(warn|warning|deprecated|deprecation)\b/.test(l)) return 'warn';
  return 'info';
}

/** Strip PM2's "0|appname  | " or "[1|appname] " prefixes from log lines. */
function stripPm2Prefix(raw: string): string {
  return raw
    .replace(/^\d+\|[^\s|]+\s*\|\s*/, '')
    .replace(/^\[\d+\|[^\]]+\]\s*/, '');
}

function parsePm2Line(raw: string): SyslogLine | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const clean = stripPm2Prefix(trimmed);

  // Try various timestamp formats
  const tsPatterns: RegExp[] = [
    // ISO with TZ: 2024-01-01T12:00:00.000Z or 2024-01-01T12:00:00+0200
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)[:|\s]/,
    // ISO with brackets: [2024-01-01T12:00:00.000Z]
    /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]/,
    // Date time: 2024-01-01 12:00:00
    /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})[:|\s]/,
  ];

  let ts = new Date().toISOString();
  let message = clean;

  for (const pattern of tsPatterns) {
    const m = clean.match(pattern);
    if (m && m[1]) {
      try {
        ts = new Date(m[1]).toISOString();
        message = clean.slice(m[0].length).replace(/^[:|\s]+/, '').trim();
      } catch {
        // keep defaults
      }
      break;
    }
  }

  return {
    ts,
    level: classifyLevel(raw),
    source: 'pm2',
    message: message || clean,
    raw: trimmed,
  };
}

function parseSystemLine(raw: string): SyslogLine | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('--')) return null;

  let ts = new Date().toISOString();
  let source = 'system';
  let message = trimmed;

  // journalctl short-iso: "2024-01-01T12:00:00+0000 hostname process[pid]: msg"
  const isoJournal = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{4})\s+\S+\s+(\S+?)(?:\[\d+\])?\s*:\s*(.*)/);
  if (isoJournal) {
    try { ts = new Date(isoJournal[1]).toISOString(); } catch { /* keep */ }
    source = isoJournal[2] ?? 'system';
    message = isoJournal[3] ?? trimmed;
    return { ts, level: classifyLevel(raw), source, message, raw: trimmed };
  }

  // syslog format: "Jan  1 12:00:00 hostname process[pid]: msg"
  const syslogMatch = trimmed.match(/^(\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2})\s+\S+\s+(\S+?)(?:\[\d+\])?\s*:\s*(.*)/);
  if (syslogMatch) {
    try {
      // Add current year since syslog doesn't include it
      ts = new Date(`${new Date().getFullYear()} ${syslogMatch[1]}`).toISOString();
    } catch { /* keep */ }
    source = syslogMatch[2] ?? 'system';
    message = syslogMatch[3] ?? trimmed;
    return { ts, level: classifyLevel(raw), source, message, raw: trimmed };
  }

  return { ts, level: classifyLevel(raw), source, message, raw: trimmed };
}

/** Read last N lines from a file. */
function tailFile(filePath: string, n: number): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/** Try pm2 log files directly as fallback. */
function getPm2LogFiles(appName: string, lines: number): SyslogLine[] {
  const pm2Home = process.env.PM2_HOME ?? path.join(os.homedir(), '.pm2');
  const outLog = path.join(pm2Home, 'logs', `${appName}-out.log`);
  const errLog = path.join(pm2Home, 'logs', `${appName}-error.log`);

  const outLines = tailFile(outLog, lines).map((l) => parsePm2Line(l)).filter(Boolean) as SyslogLine[];
  const errLines = tailFile(errLog, lines).map((l) => {
    const parsed = parsePm2Line(l);
    if (parsed && parsed.level === 'info') parsed.level = 'error';
    return parsed;
  }).filter(Boolean) as SyslogLine[];

  const combined = [...outLines, ...errLines];
  combined.sort((a, b) => a.ts.localeCompare(b.ts));
  return combined.slice(-lines);
}

async function getPm2Logs(lines: number): Promise<SyslogLine[]> {
  const appName = process.env.PM2_APP_NAME ?? 'melosong-backend';

  try {
    const { stdout, stderr } = await execAsync(
      `pm2 logs ${appName} --lines ${lines} --nostream 2>&1`,
      { timeout: 12000 }
    );
    const combined = (stdout + '\n' + stderr)
      .split('\n')
      .map((l) => parsePm2Line(l))
      .filter(Boolean) as SyslogLine[];

    if (combined.length > 0) return combined;
    // If output was empty, try reading files directly
    return getPm2LogFiles(appName, lines);
  } catch {
    // Fallback: read log files directly
    const fromFiles = getPm2LogFiles(appName, lines);
    if (fromFiles.length > 0) return fromFiles;

    return [{
      ts: new Date().toISOString(),
      level: 'warn',
      source: 'pm2',
      message: `PM2 non disponible. Fichiers logs introuvables pour "${appName}".`,
      raw: '',
    }];
  }
}

async function getSystemLogs(lines: number): Promise<SyslogLine[]> {
  // Try journalctl first
  try {
    const { stdout } = await execAsync(
      `journalctl -n ${lines} --no-pager -o short-iso 2>/dev/null`,
      { timeout: 10000 }
    );
    const parsed = stdout
      .split('\n')
      .map(parseSystemLine)
      .filter(Boolean) as SyslogLine[];
    if (parsed.length > 0) return parsed;
  } catch { /* fallthrough */ }

  // Fallback: /var/log/syslog
  const syslogPath = '/var/log/syslog';
  if (fs.existsSync(syslogPath)) {
    const raw = tailFile(syslogPath, lines);
    return raw.map(parseSystemLine).filter(Boolean) as SyslogLine[];
  }

  // Fallback: /var/log/messages
  const messagesPath = '/var/log/messages';
  if (fs.existsSync(messagesPath)) {
    const raw = tailFile(messagesPath, lines);
    return raw.map(parseSystemLine).filter(Boolean) as SyslogLine[];
  }

  return [{
    ts: new Date().toISOString(),
    level: 'warn',
    source: 'system',
    message: 'Journaux système non accessibles (journalctl, /var/log/syslog et /var/log/messages indisponibles).',
    raw: '',
  }];
}

/**
 * GET /api/admin/vps/syslog
 * Query params:
 *   lines: number (10–500, défaut 100)
 *   type:  "pm2" | "system" (défaut "pm2")
 */
adminSyslogRouter.get('/syslog', authenticateJWT, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const lines = Math.min(500, Math.max(10, parseInt(String(req.query.lines ?? '100'), 10) || 100));
  const rawType = String(req.query.type ?? 'pm2');
  const type: 'pm2' | 'system' = rawType === 'system' ? 'system' : 'pm2';

  try {
    const data = type === 'system'
      ? await getSystemLogs(lines)
      : await getPm2Logs(lines);

    res.json({
      lines: data,
      count: data.length,
      type,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({
      error: e instanceof Error ? e.message : 'Erreur lecture syslog',
    });
  }
});
