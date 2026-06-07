import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const WINDOWS_ICLOUD_DEFAULT =
  'C:\\Users\\valen\\iCloudDrive\\Application\\MeloSong\\backup';

/** @returns {string | null} */
export function resolveBackupDir() {
  const candidates = [
    process.env.MELOSONG_BACKUP_PATH,
    path.join(rootDir, 'backup'),
    path.join(rootDir, '..', 'backup'),
    path.join(rootDir, '..', '..', 'backup'),
    process.platform === 'win32' ? WINDOWS_ICLOUD_DEFAULT : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return path.resolve(candidate);
    }
  }
  return null;
}

/** @returns {{ dir: string; source: string } | null} */
export function resolveBackupWebRoot() {
  const backupDir = resolveBackupDir();
  if (!backupDir) return null;

  const nested = [
    backupDir,
    path.join(backupDir, 'public'),
    path.join(backupDir, 'dist'),
    path.join(backupDir, 'MeloSongv2', 'backend', 'public'),
    path.join(backupDir, 'backend', 'public'),
  ];

  for (const dir of nested) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      const source =
        dir === backupDir
          ? 'backup/'
          : path.relative(backupDir, dir).replace(/\\/g, '/') || 'backup/';
      return { dir, source, backupDir };
    }
  }

  return null;
}

export { rootDir, WINDOWS_ICLOUD_DEFAULT };
