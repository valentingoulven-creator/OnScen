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
const PREMIUM_CSS_PATH = join(__dirname, 'business-plan-premium.css');
const LOGO_PNG_PATH = join(__dirname, '..', '..', '..', 'web', 'app', 'public', 'soundy-logo.png');
const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const LOGO_DATA_URL = `data:image/png;base64,${readFileSync(LOGO_PNG_PATH).toString('base64')}`;

function soundyLogoHtml(variant = 'cover') {
  return `<span class="soundy-logo soundy-logo--${variant}" role="img" aria-label="Soundy">
  <img src="${LOGO_DATA_URL}" alt="" class="soundy-logo__sizer" aria-hidden="true" />
  <span class="soundy-logo__wave" aria-hidden="true"></span>
</span>`;
}

const DOCS = [
  {
    kind: 'study',
    md: 'ETUDE-MARCHE-BUSINESS-PLAN-PARTENAIRES.md',
    pdf: 'ETUDE-MARCHE-BUSINESS-PLAN-PARTENAIRES.pdf',
    title: 'Soundy — Étude de marché & business plan',
  },
  {
    kind: 'premium',
    md: 'BUSINESS-PLAN-PREMIUM.md',
    pdf: 'BUSINESS-PLAN-PREMIUM.pdf',
    title: 'Soundy — Business Plan Premium',
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

const STUDY_TOC_SECTIONS = [
  { label: 'Résumé exécutif', desc: 'Positionnement, opportunité et objectifs à 12 mois.' },
  { label: 'Étude de marché', desc: 'Taille de marché, segments, concurrence, grille tarifaire.' },
  { label: 'Business plan (36 mois)', desc: 'Revenus, phases de croissance, coûts, financement.' },
  { label: 'Partenaires à démarcher', desc: 'Cibles prioritaires par horizon et budget.' },
  { label: 'Plan commercial 90 jours', desc: 'Préparation, prospection, conversion.' },
  { label: 'Priorités immédiates', desc: 'Actions P0 / P1 / P2.' },
  { label: 'Glossaire', desc: 'Termes métier, produit Soundy et acronymes.' },
];

const PREMIUM_TOC_SECTIONS = [
  { label: 'Executive Summary', desc: 'Synthèse investisseur · opportunité · objectifs 12 mois.' },
  { label: 'Présentation de l\'entreprise', desc: 'Concept, problème, statut produit.' },
  { label: 'Vision, mission et valeurs', desc: 'Ambition et principes directeurs.' },
  { label: 'Analyse du marché', desc: 'TAM / SAM / SOM, concurrence, tendances.' },
  { label: 'Positionnement', desc: 'Proposition de valeur et différenciation.' },
  { label: 'Produits et services', desc: 'Plateforme, sponsors, grille tarifaire.' },
  { label: 'Business Model', desc: 'Sources de revenus et partenaires tech.' },
  { label: 'Stratégie commerciale', desc: 'Segments, partenaires, plan 90 jours.' },
  { label: 'Organisation et équipe', desc: 'Structure et recrutements prévus.' },
  { label: 'Plan opérationnel', desc: 'Phases, infrastructure, priorités P0–P2.' },
  { label: 'Analyse SWOT', desc: 'Forces, faiblesses, opportunités, menaces.' },
  { label: 'Prévisions financières', desc: 'Revenus, coûts, rentabilité.' },
  { label: 'Besoins de financement', desc: 'Scénarios bootstrap, BPI, seed.' },
  { label: 'Plan de développement', desc: 'Trajectoire 3 à 5 ans.' },
  { label: 'Analyse des risques', desc: 'Matrice risques et parades.' },
  { label: 'Conclusion', desc: 'Synthèse et prochaines étapes.' },
  { label: 'Glossaire', desc: 'Termes métier, produit Soundy et acronymes.' },
];

function wrapStudy(body) {
  const tocItems = STUDY_TOC_SECTIONS.map(
    (s, i) => `<li><span class="toc-num">${String(i + 1).padStart(2, '0')}</span><span class="toc-label"><strong>${s.label}</strong><span>${s.desc}</span></span></li>`
  ).join('');

  return `
<div class="cover">
  <div class="cover-mark">
    ${soundyLogoHtml('cover')}
    <span class="cover-brand">Soundy</span>
  </div>
  <p class="cover-tagline">Promoteur d'artistes &amp; d'événements</p>
  <h1>Étude de marché,<br>business plan<br>&amp; partenaires</h1>
  <p class="cover-sub">Analyse stratégique du réseau social musique live — opportunités sponsors, projections financières et plan commercial.</p>
  <div class="cover-meta">
    <div class="cover-meta-item"><strong>Site</strong><span>getsoundy.com</span></div>
    <div class="cover-meta-item"><strong>Date</strong><span>Juillet 2026</span></div>
    <div class="cover-meta-item"><strong>Statut</strong><span>Confidentiel</span></div>
  </div>
  <div class="cover-badge">Document stratégique · Soundy</div>
</div>
<div class="toc-page">
  <div class="toc-header">
    <div>
      <p class="toc-eyebrow">Sommaire</p>
      <h2 class="toc-title">Plan du document</h2>
    </div>
    <span class="toc-count">${STUDY_TOC_SECTIONS.length} sections</span>
  </div>
  <ul class="toc-list">${tocItems}</ul>
</div>
<div class="running-head">
  <span class="brand">Soundy</span>
  <span>Étude de marché &amp; business plan · getsoundy.com</span>
</div>
<div class="content">${body}</div>`;
}

function wrapPremium(body) {
  const tocItems = PREMIUM_TOC_SECTIONS.map(
    (s, i) => `<li><span class="bp-toc-num">${String(i + 3).padStart(2, '0')}</span><span class="bp-toc-label"><strong>${s.label}</strong><span>${s.desc}</span></span></li>`
  ).join('');

  return `
<div class="bp-cover">
  <div class="bp-cover-top">
    <div class="bp-cover-logo-row">
      ${soundyLogoHtml('cover')}
      <span class="bp-cover-brand">Soundy</span>
    </div>
    <span class="bp-cover-doc-type">Confidentiel</span>
  </div>
  <div class="bp-cover-body">
    <p class="bp-cover-eyebrow">Business Plan · Investisseurs &amp; partenaires</p>
    <h1>Soundy</h1>
    <p class="bp-cover-sub">Réseau social musique live et promoteur d'artistes &amp; d'événements — modèle sponsor natif géolocalisé, projections 36 mois.</p>
    <div class="bp-cover-meta">
      <div><strong>Site</strong><span>getsoundy.com</span></div>
      <div><strong>Date</strong><span>Juillet 2026</span></div>
      <div><strong>Version</strong><span>Premium v1</span></div>
    </div>
  </div>
</div>
<div class="bp-toc">
  <div class="bp-toc-header">
    <div>
      <p class="bp-toc-count">01 · Couverture · 02 · Sommaire</p>
      <h2>Sommaire</h2>
    </div>
    <span class="bp-toc-count">${PREMIUM_TOC_SECTIONS.length} sections · 03–${String(PREMIUM_TOC_SECTIONS.length + 2).padStart(2, '0')}</span>
  </div>
  <ul class="bp-toc-list">${tocItems}</ul>
</div>
<div class="bp-running-head">
  <span class="brand">${soundyLogoHtml('header')} Soundy</span>
  <span>Business Plan Premium · getsoundy.com · Juillet 2026</span>
</div>
<div class="bp-content">${body}</div>`;
}

function wrapOnePager(body, heroTitle, heroLead) {
  return `
<div class="onepager-hero">
  <div class="onepager-hero-top">
    <div class="hero-brand-row">
      ${soundyLogoHtml('hero')}
      <span class="onepager-hero-brand">Soundy</span>
    </div>
    <span class="onepager-hero-url">getsoundy.com</span>
  </div>
  <h1>${heroTitle.replace(/\n/g, '<br>')}</h1>
  <p class="onepager-hero-lead">${heroLead}</p>
</div>
<div class="content">${body}</div>`;
}

function injectLogoCss(css) {
  const maskUrl = `url('${LOGO_DATA_URL}')`;
  return css.replaceAll('__SOUNDY_LOGO_MASK__', maskUrl);
}

function addPremiumSectionNumbers(html) {
  let n = 3;
  return html.replace(/<h2>/g, () => {
    const num = String(n++).padStart(2, '0');
    return `<h2 data-section="Section ${num}">`;
  });
}

async function generateOne(doc) {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  const mdPath = join(__dirname, doc.md);
  const htmlPath = join(__dirname, doc.pdf.replace('.pdf', '.html'));
  const pdfPath = join(__dirname, doc.pdf);

  const mdContent = readFileSync(mdPath, 'utf8');
  const cssFile = doc.kind === 'premium' ? PREMIUM_CSS_PATH : CSS_PATH;
  const css = injectLogoCss(readFileSync(cssFile, 'utf8'));
  let parsed = marked.parse(mdContent);
  if (doc.kind === 'premium') {
    parsed = addPremiumSectionNumbers(parsed);
  }

  let bodyClass;
  let inner;
  if (doc.kind === 'study') {
    bodyClass = 'doc-study';
    inner = wrapStudy(parsed);
  } else if (doc.kind === 'premium') {
    bodyClass = 'doc-premium';
    inner = wrapPremium(parsed);
  } else {
    bodyClass = 'doc-onepager';
    inner = wrapOnePager(parsed, doc.heroTitle, doc.heroLead);
  }

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
    '--virtual-time-budget=20000',
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
