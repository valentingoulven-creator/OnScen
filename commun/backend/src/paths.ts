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

/** Monorepo root (Soundy/) in dev; exe directory when packaged. */
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
