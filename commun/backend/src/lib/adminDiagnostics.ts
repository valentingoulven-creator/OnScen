import fs from 'fs';
import path from 'path';

import { checkPoolHealth, getPool, isPostgresEnabled } from '../db/pool';
import { canPersistDiagnosticLogs } from './appDiagnosticLogs';
import { getDbContentHealthReport, type DbContentHealthReport } from './dbContentHealth';
import { isSentryActive } from './errorMonitoring';
import { isProductionEnv, isPreproductionEnv } from './jwtSecret';
import { isMsdevRuntime } from './msdevGuard';
import { getPostGisAdminReport, type PostGisAdminReport } from './postgisConfig';
import { resolveBackendSentryRelease } from './sentryRelease';

export interface BackupFileInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  ageHours: number;
}

export interface AdminBackupsReport {
  scanAvailable: boolean;
  backupDir: string;
  maxBackupAgeHours: number;
  dbBackups: BackupFileInfo[];
  uploadBackups: BackupFileInfo[];
  offsiteConfigured: boolean;
  offsiteDir: string | null;
  offsiteLatest: BackupFileInfo | null;
  warnings: string[];
}

export interface AdminDiagnosticLogStats {
  persisted: boolean;
  total: number;
  byLevel: Record<string, number>;
  recentErrors24h: number;
  lastErrorAt: string | null;
}

export interface AdminSentryReport {
  configured: boolean;
  active: boolean;
  release: string;
  environment: string;
  tracesSampleRate: number;
  dashboardUrl: string;
}

export interface AdminDiagnosticsReport {
  fetchedAt: string;
  environment: string;
  health: {
    status: 'OK' | 'degraded';
    db: 'ok' | 'error' | 'disabled';
    poolOk: boolean;
  };
  sentry: AdminSentryReport;
  postgis: PostGisAdminReport;
  database: DbContentHealthReport;
  diagnosticLogs: AdminDiagnosticLogStats;
  backups: AdminBackupsReport;
  links: {
    healthPath: string;
    healthDbPath: string;
    sentryOrg: string;
  };
}

const MAX_BACKUP_AGE_HOURS = 36;
const BACKUP_LIST_LIMIT = 8;

function resolveEnvironmentLabel(): string {
  if (isProductionEnv()) return 'production';
  if (isPreproductionEnv()) return 'preproduction';
  if (isMsdevRuntime()) return 'msdev';
  return process.env.APP_ENV?.trim() || 'development';
}

function resolveBackupDir(): string {
  const explicit = process.env.BACKUP_DIR?.trim();
  if (explicit) return explicit;
  const candidates = [
    '/opt/soundy/backups',
    path.join(process.cwd(), 'backups'),
    path.join(process.cwd(), '..', 'backups'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function resolveOffsiteDir(): string | null {
  const explicit = process.env.BACKUP_OFFSITE_DIR?.trim();
  if (explicit) return explicit;
  const candidate = '/opt/soundy/backups-offsite';
  return fs.existsSync(candidate) ? candidate : null;
}

function fileToBackupInfo(filePath: string): BackupFileInfo {
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return {
    name: path.basename(filePath),
    path: filePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    ageHours: Math.round(ageMs / (3600 * 1000)),
  };
}

function listBackupFiles(dir: string, pattern: RegExp, limit = BACKUP_LIST_LIMIT): BackupFileInfo[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => path.join(dir, name))
      .filter((p) => {
        try {
          return fs.statSync(p).isFile();
        } catch {
          return false;
        }
      })
      .map(fileToBackupInfo)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

function scanBackups(): AdminBackupsReport {
  const backupDir = resolveBackupDir();
  const offsiteDir = resolveOffsiteDir();
  const offsiteConfigured = Boolean(
    process.env.SCW_BUCKET?.trim() &&
      process.env.SCW_ACCESS_KEY?.trim() &&
      process.env.SCW_SECRET_KEY?.trim()
  );

  const scanAvailable = fs.existsSync(backupDir);
  const dbBackups = listBackupFiles(backupDir, /^soundy-.*\.sql\.gz$/i);
  const uploadBackups = listBackupFiles(path.join(backupDir, 'uploads'), /^uploads-.*\.(tar\.gz|tgz)$/i);

  let offsiteLatest: BackupFileInfo | null = null;
  if (offsiteDir) {
    const offsiteFiles = listBackupFiles(offsiteDir, /.*/, 1);
    offsiteLatest = offsiteFiles[0] ?? null;
  }

  const warnings: string[] = [];
  if (!scanAvailable) {
    warnings.push(`Répertoire backup introuvable (${backupDir}) — scan local indisponible depuis ce process.`);
  } else if (dbBackups.length === 0) {
    warnings.push('Aucune sauvegarde soundy-*.sql.gz trouvée.');
  } else if (dbBackups[0].ageHours > MAX_BACKUP_AGE_HOURS) {
    warnings.push(
      `Dernière sauvegarde DB datée de ${dbBackups[0].ageHours} h (> ${MAX_BACKUP_AGE_HOURS} h).`
    );
  }

  if (offsiteConfigured && !offsiteLatest) {
    warnings.push('SCW_BUCKET configuré mais aucune copie off-site récente détectée localement.');
  }

  return {
    scanAvailable,
    backupDir,
    maxBackupAgeHours: MAX_BACKUP_AGE_HOURS,
    dbBackups,
    uploadBackups,
    offsiteConfigured,
    offsiteDir,
    offsiteLatest,
    warnings,
  };
}

async function getDiagnosticLogStats(): Promise<AdminDiagnosticLogStats> {
  if (!canPersistDiagnosticLogs()) {
    return {
      persisted: false,
      total: 0,
      byLevel: {},
      recentErrors24h: 0,
      lastErrorAt: null,
    };
  }

  try {
    const pool = getPool();
    const [levelsRes, recentRes, lastRes, totalRes] = await Promise.all([
      pool.query<{ level: string; count: number }>(
        `SELECT level, COUNT(*)::int AS count FROM app_diagnostic_logs GROUP BY level`
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM app_diagnostic_logs
         WHERE level = 'error' AND created_at > NOW() - INTERVAL '24 hours'`
      ),
      pool.query<{ created_at: Date }>(
        `SELECT created_at FROM app_diagnostic_logs WHERE level = 'error'
         ORDER BY created_at DESC LIMIT 1`
      ),
      pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM app_diagnostic_logs`),
    ]);

    const byLevel: Record<string, number> = {};
    for (const row of levelsRes.rows) {
      byLevel[row.level] = row.count;
    }

    return {
      persisted: true,
      total: totalRes.rows[0]?.count ?? 0,
      byLevel,
      recentErrors24h: recentRes.rows[0]?.count ?? 0,
      lastErrorAt: lastRes.rows[0]?.created_at?.toISOString() ?? null,
    };
  } catch (err) {
    console.warn('[admin-diagnostics] log stats failed:', err);
    return {
      persisted: canPersistDiagnosticLogs(),
      total: 0,
      byLevel: {},
      recentErrors24h: 0,
      lastErrorAt: null,
    };
  }
}

function buildSentryReport(): AdminSentryReport {
  const configured = Boolean(process.env.SENTRY_DSN?.trim());
  const active = isSentryActive();
  return {
    configured,
    active,
    release: resolveBackendSentryRelease(),
    environment: process.env.APP_ENV?.trim() || 'production',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),
    dashboardUrl: 'https://bewware.sentry.io',
  };
}

/** Rapport diagnostic admin (Sentry, PostGIS, DB, backups, stats logs). */
export async function getAdminDiagnosticsReport(): Promise<AdminDiagnosticsReport> {
  const [database, postgis, diagnosticLogs, poolOk] = await Promise.all([
    getDbContentHealthReport(),
    getPostGisAdminReport(),
    getDiagnosticLogStats(),
    isPostgresEnabled() ? checkPoolHealth().catch(() => false) : Promise.resolve(false),
  ]);

  const backups = scanBackups();
  const dbStatus = !database.postgresEnabled
    ? 'disabled'
    : database.connected && poolOk
      ? 'ok'
      : 'error';

  const healthOk =
    dbStatus !== 'error' &&
    database.ok &&
    backups.warnings.filter((w) => w.includes('Aucune sauvegarde') || w.includes('> ')).length === 0;

  return {
    fetchedAt: new Date().toISOString(),
    environment: resolveEnvironmentLabel(),
    health: {
      status: healthOk ? 'OK' : 'degraded',
      db: dbStatus,
      poolOk,
    },
    sentry: buildSentryReport(),
    postgis,
    database,
    diagnosticLogs,
    backups,
    links: {
      healthPath: '/health',
      healthDbPath: '/health/db',
      sentryOrg: 'bewware',
    },
  };
}
