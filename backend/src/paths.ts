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

export function getMsdevEnvPath(): string {
  const candidates = [
    path.join(getAppRoot(), '.env'),
    path.join(getAppRoot(), 'msdev.env'),
    path.resolve(__dirname, '../../msdev/.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[0];
}

export function getMsdevConfigPath(): string {
  const candidates = [
    path.join(getAppRoot(), 'config.json'),
    path.resolve(__dirname, '../../msdev/config.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[0];
}
