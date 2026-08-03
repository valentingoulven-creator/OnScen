/**
 * Build complet : export Markdown intermédiaire + PDF dans dossier-avocat-a-valider/.
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scripts = (name) => join(__dirname, name);

function run(script) {
  const r = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(scripts('export-dossier-avocat.mjs'));
run(scripts('generate-dossier-avocat-pdfs.mjs'));
