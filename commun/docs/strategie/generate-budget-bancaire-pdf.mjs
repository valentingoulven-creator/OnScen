/**
 * PDF — Budget prévisionnel & besoin de financement bancaire.
 * Usage: node generate-budget-bancaire-pdf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', 'juridique', 'pdf-style.css');
const MD_PATH = join(__dirname, 'BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.md');
const PDF_PATH = join(__dirname, 'BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.pdf');
const HTML_CACHE = join(__dirname, '_pdf-cache', 'BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.html');

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const css = readFileSync(CSS_PATH, 'utf8');

const TODAY = new Date().toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function extractTitle(md, fallback) {
  const match = md.match(/^#\s+(.+?)\s*\n/);
  if (!match) return { title: fallback, body: md };
  return { title: match[1].trim(), body: md.slice(match[0].length) };
}

function wrapHtml(htmlBody, title) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <header class="doc-header">
    <span class="doc-header__brand">OnScen <span>· dossier financement</span></span>
    <span class="doc-header__category">Budget prévisionnel · emprunt bancaire / BPI</span>
    <h1 class="doc-header__title" style="border:none;margin-top:10px;padding-bottom:0;">${title}</h1>
    <p class="doc-meta"><strong>getsoundy.com</strong> · Document interne · Généré le ${TODAY}</p>
  </header>
  <div class="doc-warning">
    <strong>⚠ Hypothèses indicatives.</strong> À valider avec l'expert-comptable et l'établissement prêteur avant dépôt du dossier.
  </div>
  ${htmlBody}
  <footer class="doc-footer">OnScen · Budget emprunt bancaire · getsoundy.com · ${TODAY}</footer>
</body>
</html>`;
}

function printPdf(htmlPath, pdfPath) {
  mkdirSync(dirname(htmlPath), { recursive: true });
  const url = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=30000',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    url,
  ];
  const result = spawnSync(EDGE, args, { encoding: 'utf8', timeout: 180000 });
  if (result.error) throw new Error(`Edge: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`Edge exit ${result.status}: ${result.stderr || result.stdout}`);
  }
}

async function main() {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });
  const raw = readFileSync(MD_PATH, 'utf8');
  const { title, body } = extractTitle(raw, 'Budget emprunt bancaire OnScen');
  const htmlBody = marked.parse(body);
  mkdirSync(dirname(HTML_CACHE), { recursive: true });
  writeFileSync(HTML_CACHE, wrapHtml(htmlBody, title), 'utf8');
  printPdf(HTML_CACHE, PDF_PATH);
  console.log('PDF:', PDF_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
