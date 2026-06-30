/**
 * Build Capacitor prod → ios/apptel/dist (API getsoundy.com, pas de msdev LAN).
 * Applique capacitor.config.prod.json (HTTPS strict, pas de cleartext).
 * Usage : node commun/scripts/capacitor-build-prod.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const apptelRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prodConfig = path.join(apptelRoot, 'capacitor.config.prod.json');
const activeConfig = path.join(apptelRoot, 'capacitor.config.json');
const devConfigBackup = path.join(apptelRoot, 'capacitor.config.dev.json');

if (fs.existsSync(prodConfig)) {
  if (fs.existsSync(activeConfig) && !fs.existsSync(devConfigBackup)) {
    fs.copyFileSync(activeConfig, devConfigBackup);
  }
  fs.copyFileSync(prodConfig, activeConfig);
  console.log('[capacitor-build-prod] capacitor.config.json ← prod (cleartext=false)');
}

process.env.CAPACITOR_BUILD = '1';
process.env.VITE_APP_ENV = 'production';
process.env.VITE_API_URL = 'https://getsoundy.com/api';
process.env.VITE_SOCKET_URL = 'https://getsoundy.com';

console.log('[capacitor-build-prod] VITE_APP_ENV     =', process.env.VITE_APP_ENV);
console.log('[capacitor-build-prod] VITE_API_URL     =', process.env.VITE_API_URL);
console.log('[capacitor-build-prod] VITE_SOCKET_URL  =', process.env.VITE_SOCKET_URL);

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
