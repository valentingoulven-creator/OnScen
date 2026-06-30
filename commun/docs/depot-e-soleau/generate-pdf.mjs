/**
 * Génère DOSSIER-E-SOLEAU-SOUNDY.pdf via Edge headless.
 * Usage: node generate-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const MD_PATH = join(__dirname, 'DOSSIER-E-SOLEAU-SOUNDY.md');
const CSS_PATH = join(__dirname, 'pdf-style.css');
const HTML_PATH = join(__dirname, 'DOSSIER-E-SOLEAU-SOUNDY.html');
const PDF_PATH = join(__dirname, 'DOSSIER-E-SOLEAU-SOUNDY.pdf');

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  const md = readFileSync(MD_PATH, 'utf8');
  const css = readFileSync(CSS_PATH, 'utf8');
  const body = marked.parse(md);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dossier e-Soleau — Soundy</title>
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`;

  writeFileSync(HTML_PATH, html, 'utf8');
  console.log('HTML généré:', HTML_PATH);

  const url = 'file:///' + HTML_PATH.replace(/\\/g, '/');
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=10000',
    `--print-to-pdf=${PDF_PATH}`,
    url,
  ];

  const result = spawnSync(EDGE, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error) {
    console.error('Erreur Edge:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('Edge stderr:', result.stderr);
    console.error('Edge stdout:', result.stdout);
    process.exit(result.status ?? 1);
  }

  console.log('PDF généré:', PDF_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
