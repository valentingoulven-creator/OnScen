/**
 * Génère ONSCEN-PRESENTATION-PRODUIT.pdf via Edge headless (deck → pages print).
 * Usage: node generate-produit-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_HTML = join(__dirname, 'ONSCEN-PRESENTATION-PRODUIT.html');
const PRINT_HTML = join(__dirname, 'ONSCEN-PRESENTATION-PRODUIT.print.html');
const PDF_PATH = join(__dirname, 'ONSCEN-PRESENTATION-PRODUIT.pdf');

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/** 16:9 slide — aligné build-produit-presentation.mjs (10 × 5.625 in) */
const SLIDE_W = '254mm';
const SLIDE_H = '142.875mm';

const PRINT_CSS = `
@page {
  size: ${SLIDE_W} ${SLIDE_H};
  margin: 0;
}

@media print {
  :root {
    --slide-pad: 1.35rem;
  }

  .slide-counter, .progress, .slide-dots, nav, .help-hint { display: none !important; }

  .slide.slide-toc {
    justify-content: center !important;
    align-items: stretch !important;
    padding: 0.4rem 1.1rem 0.4rem !important;
    overflow: hidden !important;
  }

  .slide-toc-inner {
    max-height: 100% !important;
    width: min(100%, 50rem) !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
  }

  .slide-toc .toc-list {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(4, minmax(0, auto)) !important;
    gap: 0.38rem 0.5rem !important;
    align-content: center !important;
    margin: 0 !important;
  }

  .slide-toc .toc-link {
    padding: 0.48rem 0.65rem !important;
    font-size: 0.85rem !important;
    line-height: 1.2 !important;
    gap: 0.48rem !important;
    border-radius: 10px !important;
  }

  .slide-toc .toc-num {
    width: 1.45rem !important;
    height: 1.45rem !important;
    font-size: 0.65rem !important;
  }

  .slide-toc h2 {
    font-size: 1.32rem !important;
    margin-bottom: 0 !important;
  }

  .slide-toc h2::after {
    margin: 0.24rem 0 0.38rem !important;
    width: 2.5rem !important;
    height: 3px !important;
  }

  html, body {
    width: ${SLIDE_W} !important;
    max-width: ${SLIDE_W} !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    height: auto !important;
    min-height: auto !important;
    background: #0d0d14 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .deck {
    width: ${SLIDE_W} !important;
    height: auto !important;
    min-height: auto !important;
    display: block !important;
  }

  .slides-viewport {
    position: static !important;
    overflow: visible !important;
    width: ${SLIDE_W} !important;
    height: auto !important;
    min-height: auto !important;
  }

  .slide {
    position: relative !important;
    inset: auto !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
    box-sizing: border-box !important;
    width: ${SLIDE_W} !important;
    height: ${SLIDE_H} !important;
    min-height: ${SLIDE_H} !important;
    max-height: ${SLIDE_H} !important;
    overflow: hidden !important;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .slide:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* Grilles desktop forcées — évite le layout mobile (vw/dvh) en print */
  .slide-grid.has-media {
    grid-template-columns: minmax(0, 1fr) minmax(0, 300px) !important;
    gap: 1.25rem !important;
  }

  .revenue-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .media-duo {
    flex-direction: row !important;
    gap: 0.65rem !important;
  }

  /* Captures : remplacer dvh par hauteur fixe (sinon écrasement vertical) */
  .app-screenshot .shot-inner {
    --shot-max-h: 380px !important;
  }

  .slide-cover h1 {
    font-size: 2.35rem !important;
  }

  .cover-logo-mark {
    width: 4rem !important;
    height: 4rem !important;
  }
}
`;

function main() {
  let html = readFileSync(SRC_HTML, 'utf8');
  html = html.replace('</head>', `<style id="print-deck">${PRINT_CSS}</style></head>`);
  writeFileSync(PRINT_HTML, html, 'utf8');
  console.log('Print HTML:', PRINT_HTML);

  const url = 'file:///' + PRINT_HTML.replace(/\\/g, '/');
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--force-device-scale-factor=1',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=30000',
    `--print-to-pdf=${PDF_PATH}`,
    url,
  ];

  const result = spawnSync(EDGE, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error) {
    throw new Error(`Edge: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Edge exit ${result.status}: ${result.stderr || result.stdout}`);
  }

  console.log('PDF:', PDF_PATH);
}

main();
