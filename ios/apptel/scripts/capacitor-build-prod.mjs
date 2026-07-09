/**
 * Build Capacitor prod → ios/apptel/dist (API getsoundy.com, pas de msdev LAN).
 * Applique capacitor.config.prod.json (HTTPS strict, pas de cleartext).
 *
 * `server.hostname: "getsoundy.com"` (capacitor.config.prod.json) fait en sorte que la
 * WebView native présente https://getsoundy.com comme origine réelle (au lieu du défaut
 * https://localhost) — Capacitor sert alors les fichiers locaux du bundle comme s'ils
 * venaient de ce domaine. Sans ça, WebAuthn/biométrie (rp.id=getsoundy.com côté backend,
 * cf. webauthn.ts) échoue systématiquement : le WebView refuse tout navigator.credentials
 * dont le rp.id ne correspond pas au domaine effectif de la page appelante — ce n'est pas
 * configurable côté serveur (WEBAUTHN_ORIGIN), c'est une invariante WebAuthn imposée par
 * le WebView lui-même. Cohérent avec les entitlements iOS déjà présents
 * (webcredentials:getsoundy.com, applinks:getsoundy.com) qui anticipaient ce besoin.
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
