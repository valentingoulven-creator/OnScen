/**
 * Copie le build apptel (backend/public/tel) vers ../Smartphone/www/
 * Usage : node scripts/sync-smartphone-export.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'backend', 'public', 'tel');
const dest = path.join(root, '..', 'Smartphone', 'www');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

if (!fs.existsSync(src)) {
  console.error('[smartphone-export] Build manquant. Lancez : npm run apptel:build');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
copyDir(src, dest);

const bytes = dirSizeBytes(dest);
const mb = (bytes / (1024 * 1024)).toFixed(2);
const kb = (bytes / 1024).toFixed(1);
console.log(`[smartphone-export] OK → Smartphone/www/ (${mb} Mo / ${kb} Ko, ${bytes} octets)`);
