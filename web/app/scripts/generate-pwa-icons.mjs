/**
 * Regenerates PNG PWA icons from the concert + wave brand mark.
 * Usage: node commun/scripts/apply-app-icon.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = path.join(root, 'commun/scripts/apply-app-icon.mjs');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
process.exit(result.status ?? 1);
