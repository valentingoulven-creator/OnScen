/**
 * Build PWA apptel prod → backend/public/tel (même origine onscen.com/tel/).
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const apptelRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.VITE_APP_ENV = 'production';

console.log('[apptel-build-prod] VITE_APP_ENV =', process.env.VITE_APP_ENV);
console.log('[apptel-build-prod] API        = /api (relative, same origin prod)');

const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const tsc = spawnSync(npx, ['tsc', '-b'], { cwd: apptelRoot, stdio: 'inherit', shell: isWin });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const vite = spawnSync(npx, ['vite', 'build'], {
  cwd: apptelRoot,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
});
process.exit(vite.status ?? 1);
