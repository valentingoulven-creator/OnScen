/**
 * Génère les PDF stratégie Soundy via Edge headless.
 * Usage: node generate-pdfs.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, 'pdf-style.css');
const ICON_PATH = join(__dirname, '..', '..', '..', 'web', 'app', 'public', 'icon.svg');
const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const LOGO_SVG = readFileSync(ICON_PATH, 'utf8');

const DOCS = [
  {
    kind: 'study',
    md: 'ETUDE-MARCHE-BUSINESS-PLAN-PARTENAIRES.md',
    pdf: 'ETUDE-MARCHE-BUSINESS-PLAN-PARTENAIRES.pdf',
    title: 'Soundy — Étude de marché & business plan',
    coverTitle: 'Étude de marché,\nbusiness plan\n& partenaires',
    coverSub:
      'Analyse stratégique du réseau social musique live — opportunités sponsors, projections et plan commercial.',
  },
  {
    kind: 'onepager',
    md: 'ONE-PAGER-SPONSOR-COMMERCIAL.md',
    pdf: 'ONE-PAGER-SPONSOR-COMMERCIAL.pdf',
    title: 'Soundy Sponsors — One-pager commercial',
    heroTitle: 'Sponsoring\nnatif musique',
    heroLead:
      'Visibilité sur la carte, le fil, les stories et les Reels — audience qualifiée, tarifs transparents.',
  },
];

function wrapStudy(body) {
  return `
<div class="cover">
  <div class="cover-mark">
    ${LOGO_SVG}
    <span class="cover-brand">Soundy</span>
  </div>
  <h1>Étude de marché,<br>business plan<br>&amp; partenaires</h1>
  <p class="cover-sub">Analyse stratégique du réseau social musique live — opportunités sponsors, projections et plan commercial.</p>
  <div class="cover-meta">
    <span><strong>Site</strong> getsoundy.com</span>
    <span><strong>Date</strong> Juillet 2026</span>
    <span><strong>Statut</strong> Confidentiel</span>
  </div>
  <div class="cover-badge">Document stratégique · Soundy</div>
</div>
<div class="running-head">
  <span class="brand">Soundy</span>
  <span>Étude de marché &amp; business plan · getsoundy.com</span>
</div>
<div class="content">${body}</div>`;
}

function wrapOnePager(body, heroTitle, heroLead) {
  return `
<div class="onepager-hero">
  <div class="onepager-hero-top">
    <div style="display:flex;align-items:center;gap:12px;">
      ${LOGO_SVG}
      <span class="onepager-hero-brand">Soundy</span>
    </div>
    <span class="onepager-hero-url">getsoundy.com</span>
  </div>
  <h1>${heroTitle.replace(/\n/g, '<br>')}</h1>
  <p class="onepager-hero-lead">${heroLead}</p>
</div>
<div class="content">${body}</div>`;
}

async function generateOne(doc) {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  const mdPath = join(__dirname, doc.md);
  const htmlPath = join(__dirname, doc.pdf.replace('.pdf', '.html'));
  const pdfPath = join(__dirname, doc.pdf);

  const mdContent = readFileSync(mdPath, 'utf8');
  const css = readFileSync(CSS_PATH, 'utf8');
  const parsed = marked.parse(mdContent);

  const bodyClass = doc.kind === 'study' ? 'doc-study' : 'doc-onepager';
  const inner =
    doc.kind === 'study'
      ? wrapStudy(parsed)
      : wrapOnePager(parsed, doc.heroTitle, doc.heroLead);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${doc.title}</title>
  <style>${css}</style>
</head>
<body class="${bodyClass}">${inner}</body>
</html>`;

  writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML:', htmlPath);

  const url = 'file:///' + htmlPath.replace(/\\/g, '/');
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000',
    `--print-to-pdf=${pdfPath}`,
    url,
  ];

  const result = spawnSync(EDGE, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error) {
    throw new Error(`Edge: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Edge exit ${result.status}: ${result.stderr || result.stdout}`);
  }

  console.log('PDF:', pdfPath);
}

async function main() {
  for (const doc of DOCS) {
    await generateOne(doc);
  }

  // Nettoyage ancien one-pager (nom legacy)
  for (const legacy of [
    'ONE-PAGER-SPONSOR-CEO-IA.md',
    'ONE-PAGER-SPONSOR-CEO-IA.html',
    'ONE-PAGER-SPONSOR-CEO-IA.pdf',
  ]) {
    try {
      unlinkSync(join(__dirname, legacy));
      console.log('Removed legacy:', legacy);
    } catch {
      /* absent */
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
