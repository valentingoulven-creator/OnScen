/**
 * Surveille commun/docs et docs/ ; sync Google Drive après debounce.
 * Usage: npm run docs:gdrive:watch
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SYNC_PS1 = path.join(__dirname, 'sync-docs-gdrive.ps1');
const PID_FILE = path.join(ROOT, '.cursor/docs-gdrive-watch.pid');
const DEBOUNCE_MS = 3000;

const WATCH_ROOTS = ['commun/docs', 'docs'];

let debounceTimer = null;
let syncing = false;

function shouldIgnore(relativePath) {
  const p = relativePath.replace(/\\/g, '/');
  if (p.includes('node_modules/')) return true;
  if (p.endsWith('youtube-audit-demo-credentials.local.txt')) return true;
  return false;
}

function runSync() {
  if (syncing) return;
  syncing = true;
  const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${ts}] docs:gdrive — sync…`);
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SYNC_PS1, '-Quiet'],
    { cwd: ROOT, stdio: 'inherit', windowsHide: true },
  );
  child.on('close', (code) => {
    syncing = false;
    if (code === 0) {
      console.log(`[${ts}] docs:gdrive — OK`);
    } else {
      console.warn(`[${ts}] docs:gdrive — échec (code ${code})`);
    }
  });
}

function scheduleSync(relativePath) {
  if (relativePath && shouldIgnore(relativePath)) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runSync();
  }, DEBOUNCE_MS);
}

for (const rel of WATCH_ROOTS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`[docs:gdrive] Dossier absent: ${rel}`);
    continue;
  }
  fs.watch(abs, { recursive: true }, (_event, filename) => {
    scheduleSync(filename ? path.join(rel, filename.toString()) : rel);
  });
  console.log(`[docs:gdrive] watch ${rel}/`);
}

console.log('');
console.log(' docs:gdrive — surveillance active (Ctrl+C pour arrêter)');
console.log(` debounce ${DEBOUNCE_MS} ms`);
console.log('');

try {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
} catch {
  // non bloquant
}

function cleanup() {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', cleanup);

// Alignement Drive au démarrage du watcher
setTimeout(() => runSync(), 1500);
