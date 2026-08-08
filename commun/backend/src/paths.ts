import fs from 'fs';
import path from 'path';

export const isPackaged =
  typeof (process as NodeJS.Process & { pkg?: unknown }).pkg !== 'undefined';

/** Directory containing msdev.exe when packaged, or backend/ in dev */
export function getAppRoot(): string {
  if (isPackaged) {
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, '..');
}

export function getPublicDir(): string {
  const candidates = [
    path.join(getAppRoot(), 'public'),
    path.join(__dirname, '../public'),
    path.join(__dirname, 'public'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return path.join(__dirname, '../public');
}

/** Monorepo root (OnScen/) in dev; exe directory when packaged. */
export function getRepoRoot(): string {
  if (isPackaged) {
    return path.dirname(process.execPath);
  }
  return path.resolve(getAppRoot(), '../..');
}

/** Local msdev config directory (commun/msdev/). */
export function getMsdevDir(): string {
  if (isPackaged) {
    return getAppRoot();
  }
  return path.join(getRepoRoot(), 'commun', 'msdev');
}

export function getMsdevEnvPath(): string {
  const candidates = [
    path.join(getAppRoot(), '.env'),
    path.join(getAppRoot(), 'msdev.env'),
    path.join(getMsdevDir(), '.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[0];
}

/**
 * Fichier .env réellement chargé au démarrage du process (dotenv.config()).
 * En prod/preprod, PM2 fixe cwd=ROOT et env_file=ROOT/.env (voir
 * commun/deploy/ecosystem.config.cjs) — getAppRoot() résout donc bien ROOT/.env.
 * Même résolution que getMsdevEnvPath() (candidats identiques), exposée sous
 * un nom neutre pour les usages hors msdev (ex. mise à jour clé Stripe live
 * depuis l'admin, sans redéploiement).
 */
export function getActiveEnvFilePath(): string {
  return getMsdevEnvPath();
}

export function getMsdevConfigPath(): string {
  const candidates = [
    path.join(getAppRoot(), 'config.json'),
    path.join(getMsdevDir(), 'config.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[0];
}

/**
 * Répertoire de données privées de l'application — jamais servi par le serveur
 * web statique (hors `public/`). Utilisé pour des artefacts sensibles qui ne
 * doivent pas être accessibles par URL directe (ex. snapshots de compte).
 */
export function getDataDir(): string {
  const dir = path.join(getAppRoot(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
