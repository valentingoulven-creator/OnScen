/**
 * PDF — justification tarifs sponsor (complet + synthèse BIC).
 * Style aligné dossier avocat (commun/docs/juridique/pdf-style.css).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMERCIAL = __dirname;
const JURIDIQUE = join(COMMERCIAL, '..', '..', 'juridique');
const CSS_PATH = join(JURIDIQUE, 'pdf-style.css');
const PDF_OUT = join(COMMERCIAL, 'pdf');
const HTML_CACHE = join(COMMERCIAL, '_pdf-cache');

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const css = readFileSync(CSS_PATH, 'utf8');

const TODAY = new Date().toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const DOCS = [
  {
    md: join(COMMERCIAL, 'JUSTIFICATION-TARIFS-SPONSOR-ONSCEN.md'),
    pdf: join(PDF_OUT, 'JUSTIFICATION-TARIFS-SPONSOR-ONSCEN.pdf'),
    category: 'Stratégie · Tarifs sponsor',
  },
  {
    md: join(COMMERCIAL, 'JUSTIFICATION-TARIFS-SPONSOR-SYNTHESE-BIC.md'),
    pdf: join(PDF_OUT, 'JUSTIFICATION-TARIFS-SPONSOR-SYNTHESE-BIC.pdf'),
    category: 'Synthèse BIC · Tarifs sponsor',
  },
];

function extractTitle(md, fallback) {
  const match = md.match(/^#\s+(.+?)\s*\n/);
  if (!match) return { title: fallback, body: md };
  return { title: match[1].trim(), body: md.slice(match[0].length) };
}

function wrapHtml(mdContent, title, category) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <header class="doc-header">
    <span class="doc-header__brand">OnScen <span>· stratégie commerciale</span></span>
    <span class="doc-header__category">${category}</span>
    <h1 class="doc-header__title" style="border:none;margin-top:10px;padding-bottom:0;">${title}</h1>
    <p class="doc-meta"><strong>onscen.com</strong> · Document interne · Généré le ${TODAY}</p>
  </header>
  <div class="doc-warning">
    <strong>⚠ Chiffres indicatifs.</strong> Recaler trimestriellement avec factures infra et expert-comptable. Ne constitue pas un audit financier.
  </div>
  ${mdContent}
  <footer class="doc-footer">OnScen · ${category} · onscen.com · ${TODAY}</footer>
</body>
</html>`;
}

function printPdf(htmlPath, pdfPath) {
  mkdirSync(dirname(pdfPath), { recursive: true });
  const url = `file:///${htmlPath.replace(/\\/g, '/')}`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=25000',
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

async function mdToPdf(mdPath, pdfPath, fallbackTitle, category) {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });
  const raw = readFileSync(mdPath, 'utf8');
  const { title, body } = extractTitle(raw, fallbackTitle);
  const htmlBody = marked.parse(body);
  const base = mdPath.replace(/\.md$/i, '.html').split(/[/\\]/).pop();
  const htmlPath = join(HTML_CACHE, base);
  mkdirSync(HTML_CACHE, { recursive: true });
  writeFileSync(htmlPath, wrapHtml(htmlBody, title, category), 'utf8');
  printPdf(htmlPath, pdfPath);
}

async function main() {
  mkdirSync(PDF_OUT, { recursive: true });
  for (const doc of DOCS) {
    await mdToPdf(doc.md, doc.pdf, doc.pdf, doc.category);
    console.log('PDF', doc.pdf);
  }
  console.log(`\n${DOCS.length} PDF dans commercial/pdf/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
