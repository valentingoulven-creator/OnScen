/**
 * Copie le build apptel (backend/public/tel) vers android/OnScen-Mobile/www/
 * Usage : node commun/scripts/sync-mobile-export.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'commun', 'backend', 'public', 'tel');
const dest = path.join(root, 'android', 'OnScen-Mobile', 'www');

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
  console.error('[mobile-export] Build manquant. Lancez : npm run apptel:build');
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
copyDir(src, dest);

const bytes = dirSizeBytes(dest);
const kb = (bytes / 1024).toFixed(1);
console.log(`[mobile-export] OK → android/OnScen-Mobile/www/ (${kb} Ko, ${bytes} octets)`);
