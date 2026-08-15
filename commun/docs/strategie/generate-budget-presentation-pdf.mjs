/**
 * PDF présentation — Budget emprunt bancaire OnScen (slides + graphiques).
 * Usage: node generate-budget-presentation-pdf.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '_pdf-cache', 'BUDGET-EMPRIUNT-BANCAIRE-PRESENTATION.html');
const PDF_PATH = join(__dirname, 'BUDGET-EMPRIUNT-BANCAIRE-PRESENTATION.pdf');

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const TODAY = new Date().toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const ALLOC = [
  { label: 'Produit & dev', short: 'Produit', v: 32000, pct: 24, c: '#7c3aed' },
  { label: 'Communication', short: 'Com', v: 29000, pct: 21, c: '#a78bfa' },
  { label: 'Commercial B2B', short: 'B2B', v: 22000, pct: 16, c: '#4c1d95' },
  { label: 'Juridique & admin', short: 'Juridique', v: 16500, pct: 12, c: '#22d3ee' },
  { label: 'Trésorerie', short: 'Tréso', v: 13000, pct: 10, c: '#64748b' },
  { label: 'Infra & modération', short: 'Infra', v: 12000, pct: 9, c: '#0ea5e9' },
  { label: 'Marge sécurité', short: 'Marge', v: 10500, pct: 8, c: '#f59e0b' },
];

function eur(n) {
  return n.toLocaleString('fr-FR') + ' €';
}

function polar(cx, cy, r, a) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function donutSvg() {
  const cx = 120;
  const cy = 120;
  const r = 88;
  const ri = 54;
  const total = ALLOC.reduce((s, a) => s + a.v, 0);
  let acc = -Math.PI / 2;
  const slices = ALLOC.map((a) => {
    const sweep = (a.v / total) * Math.PI * 2;
    const a0 = acc;
    const a1 = acc + sweep;
    acc = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    const [ix0, iy0] = polar(cx, cy, ri, a0);
    const [ix1, iy1] = polar(cx, cy, ri, a1);
    const d = [
      `M ${x0} ${y0}`,
      `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      `L ${ix1} ${iy1}`,
      `A ${ri} ${ri} 0 ${large} 0 ${ix0} ${iy0}`,
      'Z',
    ].join(' ');
    return `<path d="${d}" fill="${a.c}" />`;
  }).join('');
  return `<svg viewBox="0 0 240 240" width="220" height="220" aria-label="Répartition 135 000 euros">
    ${slices}
    <text x="120" y="114" text-anchor="middle" font-size="13" fill="#6b6580" font-family="Segoe UI, sans-serif">Total</text>
    <text x="120" y="136" text-anchor="middle" font-size="20" font-weight="700" fill="#1a1625" font-family="Segoe UI, sans-serif">135 k€</text>
  </svg>`;
}

function hBarsSvg() {
  const max = 32000;
  const rowH = 28;
  const w = 420;
  const h = ALLOC.length * rowH + 8;
  const rows = ALLOC.map((a, i) => {
    const bw = Math.round((a.v / max) * 260);
    const y = i * rowH + 4;
    return `<g>
      <text x="0" y="${y + 14}" font-size="11" fill="#1a1625" font-family="Segoe UI, sans-serif">${a.short}</text>
      <rect x="88" y="${y + 2}" width="${bw}" height="16" rx="3" fill="${a.c}" />
      <text x="${96 + bw}" y="${y + 14}" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">${eur(a.v)} · ${a.pct}%</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="Montants par poste">${rows}</svg>`;
}

function scenarioBarsSvg() {
  const cats = [
    { n: 'A Finalisation', lo: 60, hi: 80 },
    { n: 'B Lancement', lo: 120, hi: 150 },
    { n: 'C Seed interne', lo: 190, hi: 280 },
  ];
  const max = 280;
  const barW = 36;
  const gap = 70;
  const baseX = 70;
  const chartH = 160;
  const bars = cats
    .map((c, i) => {
      const x = baseX + i * gap;
      const hLo = (c.lo / max) * chartH;
      const hHi = (c.hi / max) * chartH;
      return `<g>
        <rect x="${x}" y="${180 - hLo}" width="${barW}" height="${hLo}" fill="#c4b5fd" />
        <rect x="${x + barW + 4}" y="${180 - hHi}" width="${barW}" height="${hHi}" fill="#7c3aed" />
        <text x="${x + barW}" y="198" text-anchor="middle" font-size="11" fill="#1a1625" font-family="Segoe UI, sans-serif">${c.n}</text>
      </g>`;
    })
    .join('');
  return `<svg viewBox="0 0 320 210" width="320" height="210" aria-label="Trois scénarios en k€">
    <text x="8" y="16" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">k€</text>
    ${bars}
    <rect x="12" y="8" width="10" height="10" fill="#c4b5fd" />
    <text x="26" y="17" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">Basse</text>
    <rect x="78" y="8" width="10" height="10" fill="#7c3aed" />
    <text x="92" y="17" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">Haute</text>
  </svg>`;
}

function cashflowSvg() {
  const w = 480;
  const h = 200;
  const padL = 44;
  const padB = 28;
  const padT = 16;
  const plotW = w - padL - 16;
  const plotH = h - padT - padB;
  const xs = [0, 0.5, 1];
  const spend = [55, 115, 135];
  const rev = [10, 40, 62];
  const yMin = 0;
  const yMax = 150;
  const xAt = (t) => padL + t * plotW;
  const yAt = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const line = (arr) =>
    arr
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(xs[i]).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(' ');
  const labels = ['M1–M6', 'M7–M12', 'M13–M15'];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-label="Trésorerie cumulée k€">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#e8e4f4" />
    <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#e8e4f4" />
    <path d="${line(spend)}" fill="none" stroke="#64748b" stroke-width="2.2" />
    <path d="${line(rev)}" fill="none" stroke="#16a34a" stroke-width="2.2" />
    ${spend.map((v, i) => `<circle cx="${xAt(xs[i])}" cy="${yAt(v)}" r="3.5" fill="#64748b" />`).join('')}
    ${rev.map((v, i) => `<circle cx="${xAt(xs[i])}" cy="${yAt(v)}" r="3.5" fill="#16a34a" />`).join('')}
    ${labels.map((l, i) => `<text x="${xAt(xs[i])}" y="${h - 6}" text-anchor="middle" font-size="11" fill="#6b6580" font-family="Segoe UI, sans-serif">${l}</text>`).join('')}
    <text x="${padL - 6}" y="${yAt(0) + 4}" text-anchor="end" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">0</text>
    <text x="${padL - 6}" y="${yAt(150) + 4}" text-anchor="end" font-size="10" fill="#6b6580" font-family="Segoe UI, sans-serif">150</text>
    <text x="${padL + 12}" y="14" font-size="10" fill="#64748b" font-family="Segoe UI, sans-serif">Dépenses cumulées</text>
    <text x="${padL + 160}" y="14" font-size="10" fill="#16a34a" font-family="Segoe UI, sans-serif">Revenus (milieu)</text>
  </svg>`;
}

function trancheBarsSvg() {
  const vals = [40.5, 33.75, 33.75, 27];
  const labels = ['T1 30%', 'T2 25%', 'T3 25%', 'T4 20%'];
  const max = 45;
  const chartH = 140;
  const bars = vals
    .map((v, i) => {
      const x = 50 + i * 90;
      const bh = (v / max) * chartH;
      return `<g>
        <rect x="${x}" y="${160 - bh}" width="48" height="${bh}" rx="4" fill="#7c3aed" />
        <text x="${x + 24}" y="${154 - bh}" text-anchor="middle" font-size="11" fill="#1a1625" font-family="Segoe UI, sans-serif">${v} k€</text>
        <text x="${x + 24}" y="178" text-anchor="middle" font-size="11" fill="#6b6580" font-family="Segoe UI, sans-serif">${labels[i]}</text>
      </g>`;
    })
    .join('');
  return `<svg viewBox="0 0 420 190" width="420" height="190" aria-label="Jalons de décaissement">${bars}</svg>`;
}

function legend() {
  return `<ul class="legend">${ALLOC.map((a) => `<li><i style="background:${a.c}"></i>${a.label} · ${eur(a.v)} · ${a.pct}%</li>`).join('')}</ul>`;
}

function slide(n, title, inner, extraClass = '') {
  return `<section class="slide ${extraClass}">
    <header class="slide-top">
      <span>OnScen · Budget emprunt bancaire</span>
      <span>${n} / 9</span>
    </header>
    <h2>${title}</h2>
    ${inner}
    <footer class="slide-foot">onscen.com · ${TODAY} · Hypothèses à valider · Non-conseil financier</footer>
  </section>`;
}

function html() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>OnScen — Présentation budget emprunt bancaire</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #1a1625;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slide {
      width: 297mm;
      height: 210mm;
      padding: 12mm 14mm 14mm;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fff;
    }
    .slide:last-child { page-break-after: auto; }
    .slide-top, .slide-foot {
      font-size: 9pt;
      color: #6b6580;
      display: flex;
      justify-content: space-between;
    }
    .slide-foot { margin-top: auto; padding-top: 8px; border-top: 1px solid #e8e4f4; }
    h1 { font-size: 28pt; margin: 0 0 8px; letter-spacing: -0.03em; }
    h2 { font-size: 18pt; margin: 8px 0 12px; color: #4c1d95; }
    p, li { font-size: 11pt; line-height: 1.45; margin: 0 0 8px; }
    .muted { color: #6b6580; font-size: 10pt; }
    .cover {
      background: linear-gradient(155deg, #07070b 0%, #12101c 42%, #1a1030 100%);
      color: #fff;
    }
    .cover h1 { color: #fff; font-size: 32pt; }
    .cover h2 { color: #c4b5fd; font-size: 14pt; font-weight: 500; }
    .cover .slide-top, .cover .slide-foot { color: #c4b5fd; border-color: rgba(255,255,255,0.12); }
    .kicker { font-size: 11pt; letter-spacing: 0.12em; text-transform: uppercase; color: #a78bfa; margin-bottom: 16px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
    .stat {
      border: 1px solid #e8e4f4;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f8f7fc;
    }
    .stat b { display: block; font-size: 16pt; color: #4c1d95; }
    .stat span { font-size: 9pt; color: #6b6580; }
    .cover .stat { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
    .cover .stat b { color: #fff; }
    .cover .stat span { color: #c4b5fd; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    .legend { list-style: none; padding: 0; margin: 0; font-size: 10pt; }
    .legend li { display: flex; align-items: center; gap: 8px; margin: 0 0 5px; }
    .legend i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; flex: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid #e8e4f4; vertical-align: top; }
    th { color: #6b6580; font-weight: 600; font-size: 9pt; }
    .hl { background: #ede9fe; }
    .note {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 10pt;
      margin-top: 8px;
    }
    .info {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 10pt;
    }
    ul.tight { margin: 0; padding-left: 18px; }
    ul.tight li { margin: 0 0 4px; }
  </style>
</head>
<body>
  <section class="slide cover">
    <header class="slide-top"><span>onscen.com</span><span>1 / 9</span></header>
    <div class="kicker">Dossier prêt professionnel / BPI</div>
    <h1>Budget prévisionnel<br/>&amp; besoin de financement</h1>
    <h2>Présentation graphique — scénario B recommandé</h2>
    <div class="stats">
      <div class="stat"><b>135 000 €</b><span>Demande · 15 mois</span></div>
      <div class="stat"><b>~1 950 €</b><span>Mensualité 7 ans · 5,5 %</span></div>
      <div class="stat"><b>T1–T4</b><span>Décaissement par jalons</span></div>
      <div class="stat"><b>An 2</b><span>Break-even visé (hyp. interne)</span></div>
    </div>
    <p class="muted" style="color:#c4b5fd">Document interne · ${TODAY} · Hypothèses à valider avec l’expert-comptable et l’établissement prêteur. Ne constitue pas un conseil financier réglementé.</p>
    <footer class="slide-foot"><span>OnScen — réseau social musique &amp; nightlife</span><span>Source : BUDGET-EMPRIUNT-BANCAIRE-ONSCEN.md</span></footer>
  </section>

  ${slide(
    2,
    'Objet du financement',
    `<p>Financer <strong>12 à 18 mois</strong> de mise en conformité, finalisation produit (web + mobile iOS/Android), lancement commercial et communication — <strong>sans attendre une levée equity</strong>.</p>
    <div class="cols">
      <div>
        <ul class="tight">
          <li>App <strong>publiable</strong> App Store / Play Store</li>
          <li><strong>Stripe live</strong> (pas de clé test en production)</li>
          <li><strong>3 à 5 contrats sponsors</strong> payants</li>
          <li>Traction <strong>5 000 → 15 000 MAU</strong> (phase 0)</li>
          <li>Dossier <strong>juridique validé</strong></li>
        </ul>
      </div>
      <div class="info">
        <strong>Phrase executive (courrier banquier)</strong><br/>
        OnScen — carte, lives, sponsors natifs. Demande : <strong>135 000 €</strong> sur 15 mois, remboursable 5–7 ans. Apport fondateur <strong>15 k€</strong> et garantie BPI envisagés.
      </div>
    </div>`,
  )}

  ${slide(
    3,
    'Trois scénarios — une recommandation',
    `<div class="cols">
      ${scenarioBarsSvg()}
      <table>
        <tr><th>Scénario</th><th>Montant</th><th>Horizon</th></tr>
        <tr><td>A — Ciblé finalisation</td><td>60–80 k€</td><td>12 mois</td></tr>
        <tr class="hl"><td>B — Lancement complet (reco)</td><td>120–150 k€ · base 135 k€</td><td>15 mois</td></tr>
        <tr><td>C — Aligné seed interne</td><td>190–280 k€</td><td>18 mois</td></tr>
      </table>
    </div>
    <p>Recommandation : <strong>B à 135 k€</strong>, ou <strong>80 k€</strong> si la communication reste en bootstrap. Option dirigeant +18 k€ → ~153 k€.</p>`,
  )}

  ${slide(
    4,
    'Emploi des fonds — 135 000 € HT',
    `<div class="cols">
      <div style="text-align:center">${donutSvg()}</div>
      ${legend()}
    </div>
    <p class="muted">Sous-total postes 124 500 € + marge non affectée 10 500 € = 135 000 €. Hors rémunération dirigeant.</p>`,
  )}

  ${slide(
    5,
    'Montants par poste (base B)',
    `<div class="cols">
      ${hBarsSvg()}
      <table>
        <tr><th>Poste</th><th>Lignes clés</th></tr>
        <tr><td>Produit 32 k€</td><td>Mobile 12 · UX 5 · audit 4 · Stripe 2,5 · contingence 5,5</td></tr>
        <tr><td>Juridique 16,5 k€</td><td>Avocat 8 · contrats 3 · EC 3,6 · assurances 1,2</td></tr>
        <tr><td>Com 29 k€</td><td>Ads 8 · community 9 · événements 6 · identité 4</td></tr>
        <tr><td>B2B 22 k€</td><td>AE freelance 12 · salons 4,5 · terrain 4</td></tr>
        <tr><td>Infra 12 k€</td><td>LiveKit/CF 4,5 · cloud 2,5 · modo 3</td></tr>
        <tr><td>Tréso + marge 23,5 k€</td><td>BFR 10 · imprévus 3 · IAP / mobile en priorité</td></tr>
      </table>
    </div>`,
  )}

  ${slide(
    6,
    'Trésorerie — le prêt couvre le gap',
    `${cashflowSvg()}
    <table>
      <tr><th>Période</th><th>Dépenses cumul.</th><th>Sponsors</th><th>Abos / tips</th><th>Solde net</th></tr>
      <tr><td>M1–M6</td><td>~55 k€</td><td>5–15 k€</td><td>faible</td><td>−45 à −50 k€</td></tr>
      <tr><td>M7–M12</td><td>~115 k€</td><td>20–40 k€</td><td>5–15 k€</td><td>−70 à −85 k€</td></tr>
      <tr><td>M13–M15</td><td>~135 k€</td><td>35–55 k€ cumul</td><td>10–25 k€ cumul</td><td>−60 à −90 k€</td></tr>
    </table>
    <div class="note"><strong>Ne pas sur-promettre à la banque.</strong> An 1 conservateur : 15–25 k€ sponsors. Pitch interne An 1 : ~65 k€ revenus / 100 k€ charges. Break-even visé ~An 2.</div>`,
  )}

  ${slide(
    7,
    'Jalons de décaissement (sur 135 k€)',
    `<div class="cols">
      ${trancheBarsSvg()}
      <table>
        <tr><th>Tranche</th><th>Montant</th><th>Condition</th></tr>
        <tr><td>T1 · 30 %</td><td>40 500 €</td><td>Signature + plan de trésorerie</td></tr>
        <tr><td>T2 · 25 %</td><td>33 750 €</td><td>Audit dev + Stripe live</td></tr>
        <tr><td>T3 · 25 %</td><td>33 750 €</td><td>Avis juriste + TestFlight / Play</td></tr>
        <tr><td>T4 · 20 %</td><td>27 000 €</td><td>3 sponsors ou 5 000 MAU</td></tr>
      </table>
    </div>`,
  )}

  ${slide(
    8,
    'Remboursement & garanties',
    `<div class="stats">
      <div class="stat"><b>5–7 ans</b><span>Durée</span></div>
      <div class="stat"><b>4,5–6,5 %</b><span>Taux (hyp.)</span></div>
      <div class="stat"><b>~1 950 €</b><span>7 ans · 5,5 %</span></div>
      <div class="stat"><b>~2 570 €</b><span>5 ans · 5,5 %</span></div>
    </div>
    <p>Seuil de marge pour la mensualité seule : <strong>2 500–3 500 €/mois</strong> — 2–4 contrats Pro Ville (2 400 €/mois HT) + sponsors, hyp. M10+.</p>
    <ul class="tight">
      <li><strong>BPI</strong> : 50–70 % du risque souvent demandé par les banques</li>
      <li><strong>CIR / JEI</strong> si éligible (crédibilité R&amp;D, pas un remboursement)</li>
      <li>Actifs immatériels (code, marque, users, contrats) — pas de garantie matérielle lourde</li>
      <li>Apport fondateur <strong>10–15 %</strong> (15 k€ envisagés) améliore le dossier</li>
    </ul>`,
  )}

  ${slide(
    9,
    'Dossier banque & vigilances',
    `<div class="cols">
      <div>
        <p><strong>Checklist</strong></p>
        <ul class="tight">
          <li>Kbis / statuts / RIB</li>
          <li>Prévisionnel 3 ans (expert-comptable)</li>
          <li>Ce budget + business plan premium</li>
          <li>Pitch deck 12 slides</li>
          <li>Traction : health prod, captures, pipeline sponsors</li>
          <li>Devis / LOI freelance + avocat</li>
          <li>Tableau BPI / subventions</li>
        </ul>
        <p class="muted">Le prêt ne finance pas : dividendes, rachat de parts, dette fiscale, ads sans KPI, doublon equity sans tableau de sources.</p>
      </div>
      <div class="note">
        <strong>Point bloquant avant dépôt — IAP natif.</strong><br/>
        La ligne mobile (8–20 k€) doit aussi couvrir StoreKit2 / Play Billing si retenu. L’IAP seul = 4–8 semaines (~9–20 k€). Trancher IAP vs web-only : cela change le montant. Marge 10 500 € prévue en priorité pour ce risque.<br/><br/>
        Infra actuelle = mono-VPS, dimensionnée 5–15 k MAU. Un pic viral = investissement complémentaire, hors cet emprunt. DPA Scaleway / Cloudflare / Stripe / Resend à inclure dans le mandat avocat.
      </div>
    </div>`,
  )}
</body>
</html>`;
}

function findEdge() {
  for (const p of EDGE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error('Microsoft Edge introuvable. Définir EDGE_PATH.');
}

function printPdf(htmlPath, pdfPath) {
  const edge = findEdge();
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
  const result = spawnSync(edge, args, { encoding: 'utf8', timeout: 180000 });
  if (result.error) throw new Error(`Edge: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`Edge exit ${result.status}: ${result.stderr || result.stdout}`);
  }
}

mkdirSync(dirname(HTML_PATH), { recursive: true });
writeFileSync(HTML_PATH, html(), 'utf8');
printPdf(HTML_PATH, PDF_PATH);
console.log('PDF:', PDF_PATH);
