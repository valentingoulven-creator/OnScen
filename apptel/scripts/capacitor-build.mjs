/**
 * Build Vite optimisé Capacitor (webDir dist/, base relative, API LAN).
 * Usage : node scripts/capacitor-build.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const apptelRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.CAPACITOR_BUILD = '1';
await import('./read-msdev-mobile-env.mjs');

const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const tsc = spawnSync(npx, ['tsc', '-b'], { cwd: apptelRoot, stdio: 'inherit', shell: isWin });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const vite = spawnSync(npx, ['vite', 'build'], { cwd: apptelRoot, stdio: 'inherit', shell: isWin, env: process.env });
process.exit(vite.status ?? 1);
