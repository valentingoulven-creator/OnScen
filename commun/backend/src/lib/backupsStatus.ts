/**
 * Statut des sauvegardes prod (DB + uploads + off-site) pour l'onglet admin
 * (Analytics → VPS). Lit directement le système de fichiers du process
 * backend — en prod celui-ci tourne sur le VPS avec cwd = racine OnScen
 * (cf. ecosystem.config.cjs), donc pas besoin de SSH.
 *
 * Miroir des vérifications de commun/deploy/verify-prod.sh (mêmes chemins,
 * mêmes seuils de fraîcheur) pour rester cohérent avec le diagnostic CLI.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackupBucketStatus {
  dir: string;
  exists: boolean;
  count: number;
  latestFile: string | null;
  latestAt: string | null;
  ageHours: number | null;
  totalBytes: number;
  stale: boolean;
  staleThresholdHours: number;
}

export interface BackupsStatusReport {
  fetchedAt: string;
  source: 'filesystem' | 'unavailable';
  root: string;
  retentionDays: {
    db: number;
    uploads: number;
    offsite: number;
  };
  db: BackupBucketStatus;
  uploads: BackupBucketStatus;
  offsiteDb: { dir: string; exists: boolean; count: number };
  offsiteUploads: { dir: string; exists: boolean; count: number };
  cron: {
    source: 'crontab' | 'unavailable';
    db: boolean;
    uploads: boolean;
    offsite: boolean;
  };
  warnings: string[];
}

function onscenRoot(): string {
  if (process.env.ONSCEN_ROOT) return process.env.ONSCEN_ROOT;
  if (process.platform === 'win32') return process.cwd();
  return process.cwd();
}

async function statBucket(
  dir: string,
  pattern: RegExp,
  staleThresholdHours: number,
): Promise<BackupBucketStatus> {
  const base: Omit<BackupBucketStatus, 'exists'> = {
    dir,
    count: 0,
    latestFile: null,
    latestAt: null,
    ageHours: null,
    totalBytes: 0,
    stale: true,
    staleThresholdHours,
  };
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { ...base, exists: false };
  }
  const files = entries.filter((f) => pattern.test(f));
  let latestMtimeMs = 0;
  let latestFile: string | null = null;
  let totalBytes = 0;
  for (const f of files) {
    try {
      const st = await fs.stat(path.join(dir, f));
      totalBytes += st.size;
      if (st.mtimeMs > latestMtimeMs) {
        latestMtimeMs = st.mtimeMs;
        latestFile = f;
      }
    } catch {
      // fichier supprimé entre readdir et stat — ignorer
    }
  }
  const ageHours = latestMtimeMs > 0 ? (Date.now() - latestMtimeMs) / 3_600_000 : null;
  return {
    ...base,
    exists: true,
    count: files.length,
    latestFile,
    latestAt: latestMtimeMs > 0 ? new Date(latestMtimeMs).toISOString() : null,
    ageHours: ageHours != null ? Math.round(ageHours * 10) / 10 : null,
    totalBytes,
    stale: ageHours == null || ageHours > staleThresholdHours,
  };
}

async function countDir(dir: string): Promise<{ dir: string; exists: boolean; count: number }> {
  try {
    const entries = await fs.readdir(dir);
    return { dir, exists: true, count: entries.length };
  } catch {
    return { dir, exists: false, count: 0 };
  }
}

async function getCronStatus(): Promise<BackupsStatusReport['cron']> {
  if (process.platform === 'win32') {
    return { source: 'unavailable', db: false, uploads: false, offsite: false };
  }
  try {
    const { stdout } = await execAsync('crontab -l 2>/dev/null', { timeout: 5000 });
    return {
      source: 'crontab',
      db: /backup-db\.sh/.test(stdout),
      uploads: /backup-uploads\.sh/.test(stdout),
      offsite: /backup-offsite\.sh/.test(stdout),
    };
  } catch {
    return { source: 'unavailable', db: false, uploads: false, offsite: false };
  }
}

export async function getBackupsStatusReport(): Promise<BackupsStatusReport> {
  const root = onscenRoot();
  const backupDir = process.env.BACKUP_DIR || path.join(root, 'backups');
  const uploadsBackupDir = process.env.UPLOADS_BACKUP_DIR || path.join(root, 'backups', 'uploads');
  const offsiteDir = process.env.BACKUP_OFFSITE_DIR || path.join(root, 'backups-offsite');

  const [db, uploads, offsiteDb, offsiteUploads, cron] = await Promise.all([
    statBucket(backupDir, /^onscen-.*\.sql\.gz$/, 26),
    statBucket(uploadsBackupDir, /^uploads-.*\.tar\.gz$/, 48),
    countDir(path.join(offsiteDir, 'db')),
    countDir(path.join(offsiteDir, 'uploads')),
    getCronStatus(),
  ]);

  const warnings: string[] = [];
  if (!db.exists) warnings.push(`Répertoire backups DB introuvable : ${backupDir}`);
  if (!uploads.exists) warnings.push(`Répertoire backups uploads introuvable : ${uploadsBackupDir}`);
  if (db.exists && db.stale) warnings.push(`Dernier dump DB vieux de ${db.ageHours ?? '?'}h (> ${db.staleThresholdHours}h)`);
  if (uploads.exists && uploads.stale) warnings.push(`Dernière archive uploads vieille de ${uploads.ageHours ?? '?'}h (> ${uploads.staleThresholdHours}h)`);
  if (cron.source === 'unavailable') warnings.push('Statut cron non disponible sur cette plateforme (crontab absent).');

  const source: BackupsStatusReport['source'] = db.exists || uploads.exists ? 'filesystem' : 'unavailable';

  return {
    fetchedAt: new Date().toISOString(),
    source,
    root,
    retentionDays: {
      db: Number(process.env.RETENTION_DAYS || 14),
      uploads: Number(process.env.UPLOADS_RETENTION_DAYS || 14),
      offsite: Number(process.env.OFFSITE_RETENTION_DAYS || 14),
    },
    db,
    uploads,
    offsiteDb,
    offsiteUploads,
    cron,
    warnings,
  };
}
