/**
 * Génère ONSCEN-PREMIUM-DECK.pptx — deck marketing premium.
 * Layout strict 16:9 — tout le contenu reste dans la zone safe (marges fixes).
 *
 * Usage: npm run deck  (depuis commun/docs/strategie)
 */
import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(__dirname, 'ONSCEN-PREMIUM-DECK.pptx');
const SHOTS = path.join(DOCS_DIR, 'presentation-screenshots', 'mobile');
const LOGO = path.join(DOCS_DIR, '..', 'backend', 'public', 'onscen-logo.png');

const C = {
  bg: 'FFFFFF',
  bgAlt: 'F8FAFC',
  card: 'FFFFFF',
  border: 'E2E8F0',
  ink: '0F172A',
  inkSoft: '334155',
  muted: '64748B',
  primary: '6D28D9',
  primaryLight: 'EDE9FE',
  primaryGhost: 'F5F3FF',
  accent: 'FB7185',
  accentLight: 'FFF1F2',
  white: 'FFFFFF',
};

// Polices système — rendu identique PowerPoint / Google Slides / LibreOffice
const FONT_HEAD = 'Calibri Light';
const FONT_BODY = 'Calibri';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'OnScen';
pptx.company = 'OnScen · getsoundy.com';
pptx.subject = 'Présentation premium — produit, marché, roadmap';
pptx.title = 'OnScen — Deck premium';

// ── Grille stricte (pouces, slide 13.333 × 7.5) ──
const W = 13.333;
const H = 7.5;
const MX = 0.55; // marge horizontale
const MY = 0.45; // marge verticale haute
const CW = W - MX * 2; // 12.233 — largeur utile
const FOOT_Y = 6.95; // début footer
const BODY_MAX_Y = 6.55; // rien en dessous

const COL_L = { x: MX, w: 7.0 };
const COL_R = { x: 7.85, w: W - 7.85 - MX }; // ~4.93

const PHONE = { x: 8.05, y: 0.95, w: 1.88, h: 4.05 };

function shot(name) {
  const p = path.join(SHOTS, name);
  return fs.existsSync(p) ? p : null;
}

function bg(slide, color = C.bg) {
  slide.background = { color };
}

function slideFrame(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: W,
    h: 0.04,
    fill: { color: C.primary },
    line: { type: 'none' },
  });
}

function brandMark(slide, dark = false) {
  const tc = dark ? C.white : C.ink;
  const sc = dark ? 'CBD5E1' : C.muted;
  const y = MY;
  if (fs.existsSync(LOGO)) {
    slide.addImage({ path: LOGO, x: MX, y, w: 0.32, h: 0.32 });
  }
  slide.addText('OnScen', {
    x: MX + 0.4,
    y: y - 0.01,
    w: 1.5,
    h: 0.22,
    fontSize: 10,
    bold: true,
    fontFace: FONT_BODY,
    color: tc,
    margin: 0,
  });
}

function footer(slide, n, total, dark = false) {
  const lc = dark ? '475569' : C.border;
  const tc = dark ? '94A3B8' : C.muted;
  slide.addShape(pptx.ShapeType.line, {
    x: MX,
    y: FOOT_Y,
    w: CW,
    h: 0,
    line: { color: lc, width: 0.5 },
  });
  slide.addText('OnScen · getsoundy.com', {
    x: MX,
    y: FOOT_Y + 0.08,
    w: 4,
    h: 0.22,
    fontSize: 7,
    fontFace: FONT_BODY,
    color: tc,
    margin: 0,
  });
  slide.addText(`${String(n).padStart(2, '0')} / ${total}`, {
    x: W - MX - 0.7,
    y: FOOT_Y + 0.08,
    w: 0.7,
    h: 0.22,
    fontSize: 7,
    fontFace: FONT_BODY,
    color: tc,
    align: 'right',
    margin: 0,
  });
}

function sectionLabel(slide, text, y = 0.88) {
  slide.addText(text.toUpperCase(), {
    x: MX,
    y,
    w: COL_L.w,
    h: 0.24,
    fontSize: 9,
    bold: true,
    fontFace: FONT_BODY,
    color: C.primary,
    charSpacing: 2,
    margin: 0,
  });
}

function heading(slide, text, y, w = COL_L.w, size = 24) {
  slide.addText(text, {
    x: MX,
    y,
    w,
    h: 0.95,
    fontSize: size,
    bold: true,
    fontFace: FONT_HEAD,
    color: C.ink,
    margin: 0,
    fit: 'shrink',
  });
}

function lede(slide, text, y, w = COL_L.w) {
  slide.addText(text, {
    x: MX,
    y,
    w,
    h: 0.45,
    fontSize: 11,
    fontFace: FONT_BODY,
    color: C.muted,
    margin: 0,
    fit: 'shrink',
  });
}

function bulletList(slide, items, y, w = COL_L.w, h = 2.8, size = 11, color = C.inkSoft) {
  const rows = items.map((t) => ({ text: t, options: { bullet: { code: '2022' }, breakLine: true } }));
  slide.addText(rows, {
    x: MX,
    y,
    w,
    h,
    fontSize: size,
    fontFace: FONT_BODY,
    color,
    valign: 'top',
    paraSpaceAfter: 6,
    bullet: { code: '2022', indent: 14 },
    margin: 0,
    fit: 'shrink',
  });
}

function cardBox(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    fill: { color: opts.fill ?? C.card },
    line: { color: opts.border ?? C.border, width: 0.75 },
    rectRadius: 0.1,
  });
  if (opts.accent) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: y + 0.1,
      w: 0.05,
      h: h - 0.2,
      fill: { color: C.primary },
      line: { type: 'none' },
    });
  }
}

function iconCircle(slide, letter, x, y, size = 0.38) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color: C.primaryLight },
    line: { type: 'none' },
  });
  slide.addText(letter, {
    x,
    y: y + 0.04,
    w: size,
    h: size - 0.06,
    fontSize: size * 28,
    bold: true,
    fontFace: FONT_BODY,
    color: C.primary,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
}

function phoneShot(slide, file, label) {
  if (!file) return;
  const { x, y, w, h } = PHONE;
  const pad = 0.06;

  slide.addShape(pptx.ShapeType.roundRect, {
    x: x - pad,
    y: y - pad,
    w: w + pad * 2,
    h: h + pad * 2,
    fill: { color: C.ink },
    line: { type: 'none' },
    rectRadius: 0.2,
  });
  slide.addImage({ path: file, x, y, w, h, rounding: true });

  if (label) {
    slide.addText(label, {
      x: x - pad,
      y: y + h + pad + 0.06,
      w: w + pad * 2,
      h: 0.22,
      fontSize: 8,
      fontFace: FONT_BODY,
      color: C.muted,
      align: 'center',
      margin: 0,
    });
  }
}

function calloutBox(slide, text, x, y, w, h) {
  cardBox(slide, x, y, w, h, { fill: C.primaryGhost, border: C.primaryLight, accent: true });
  slide.addText(text, {
    x: x + 0.2,
    y: y + 0.1,
    w: w - 0.3,
    h: h - 0.2,
    fontSize: 11,
    bold: true,
    fontFace: FONT_BODY,
    color: C.primary,
    valign: 'middle',
    margin: 0,
    fit: 'shrink',
  });
}

function pillTag(slide, text, x, y, w) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.28,
    fill: { color: C.primaryLight },
    line: { type: 'none' },
    rectRadius: 0.14,
  });
  slide.addText(text, {
    x: x + 0.08,
    y,
    w: w - 0.16,
    h: 0.28,
    fontSize: 8,
    bold: true,
    fontFace: FONT_BODY,
    color: C.primary,
    align: 'center',
    valign: 'middle',
    margin: 0,
    fit: 'shrink',
  });
}

function ctaBtn(slide, text, x, y, w, fill = C.primary, fg = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.42,
    fill: { color: fill },
    line: { type: 'none' },
    rectRadius: 0.21,
  });
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.42,
    fontSize: 10,
    bold: true,
    fontFace: FONT_BODY,
    color: fg,
    align: 'center',
    valign: 'middle',
    margin: 0,
  });
}

function headerCell(text) {
  return {
    text,
    options: { fill: { color: C.primaryGhost }, color: C.primary, bold: true, fontSize: 9.5, fontFace: FONT_BODY, margin: [4, 6, 4, 6] },
  };
}
function cellBefore(text) {
  return { text, options: { fill: { color: C.bgAlt }, color: C.inkSoft, fontSize: 9.5, fontFace: FONT_BODY, margin: [4, 6, 4, 6] } };
}
function cellAfter(text) {
  return { text, options: { fill: { color: C.white }, color: C.primary, bold: true, fontSize: 9.5, fontFace: FONT_BODY, margin: [4, 6, 4, 6] } };
}

const TOTAL = 16;
let n = 0;

function newSlide(fn, opts = {}) {
  n += 1;
  const s = pptx.addSlide();
  bg(s, opts.bg ?? C.bg);
  if (!opts.noBar) slideFrame(s);
  fn(s, n);
  footer(s, n, TOTAL, opts.dark);
  if (opts.notes) s.addNotes(opts.notes);
}

// ── 1 · Couverture ──
newSlide((s) => {
  bg(s, C.bgAlt);
  brandMark(s);

  pillTag(s, 'Réseau social · Musique live · Sorties', MX, 1.0, 3.6);
  s.addText('OnScen', {
    x: MX,
    y: 1.45,
    w: 7,
    h: 0.9,
    fontSize: 44,
    bold: true,
    fontFace: FONT_HEAD,
    color: C.ink,
    margin: 0,
  });
  s.addText('Écouter ensemble. Sortir. Vivre la musique.', {
    x: MX,
    y: 2.35,
    w: 6.8,
    h: 0.5,
    fontSize: 14,
    fontFace: FONT_BODY,
    color: C.muted,
    margin: 0,
  });

  const stats = [
    ['5', 'espaces'],
    ['1', 'application'],
    ['FR', 'hébergement'],
  ];
  stats.forEach(([v, l], i) => {
    const x = MX + i * 1.75;
    cardBox(s, x, 3.15, 1.55, 0.72);
    s.addText(v, {
      x: x + 0.12,
      y: 3.22,
      w: 1.3,
      h: 0.35,
      fontSize: 18,
      bold: true,
      fontFace: FONT_HEAD,
      color: C.primary,
      margin: 0,
    });
    s.addText(l, {
      x: x + 0.12,
      y: 3.55,
      w: 1.3,
      h: 0.22,
      fontSize: 8,
      fontFace: FONT_BODY,
      color: C.muted,
      margin: 0,
    });
  });

  ctaBtn(s, 'getsoundy.com', MX, 4.15, 2.0);
  phoneShot(s, shot('02-carte.png'), 'Carte · événements');
}, {
  notes: 'Accroche : OnScen réunit découverte, écoute, live et sorties dans une seule app.',
});

// ── 2 · Problème (grille 2×2 — tient dans la page) ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Le contexte');
  heading(s, 'La musique et les sorties sont fragmentées', 1.15, CW, 22);
  lede(s, 'Quatre apps différentes pour vivre une seule soirée musicale', 1.95, CW);

  const items = [
    ['D', 'Découverte', 'TikTok, Instagram, YouTube — éparpillé'],
    ['E', 'Écoute', 'Solitaire, jamais synchronisée'],
    ['S', 'Sorties', 'Agendas non sociaux'],
    ['V', 'Visibilité', 'Bars et salles peu visibles entre deux dates'],
  ];
  const cw = (CW - 0.2) / 2;
  const ch = 1.35;
  items.forEach(([letter, t, d], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MX + col * (cw + 0.2);
    const y = 2.55 + row * (ch + 0.18);
    cardBox(s, x, y, cw, ch, { accent: true });
    iconCircle(s, letter, x + 0.18, y + 0.18, 0.34);
    s.addText(t, {
      x: x + 0.62,
      y: y + 0.16,
      w: cw - 0.75,
      h: 0.28,
      fontSize: 11,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      margin: 0,
    });
    s.addText(d, {
      x: x + 0.18,
      y: y + 0.55,
      w: cw - 0.36,
      h: 0.65,
      fontSize: 9.5,
      fontFace: FONT_BODY,
      color: C.muted,
      margin: 0,
      fit: 'shrink',
    });
  });

  calloutBox(s, 'Résultat : les fans jonglent entre plusieurs apps — pas de hub commun pour créateurs et lieux.', MX, 5.55, CW, 0.65);
}, { notes: 'Personnaliser avec un persona (Léa, 24 ans, fan électro).' });

// ── 3 · Solution ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'La solution');
  heading(s, 'Un seul endroit pour tout vivre', 1.15);
  calloutBox(
    s,
    "OnScen synchronise l'écoute, la carte géolocalisée, les salons et les lives vidéo.",
    MX,
    2.05,
    COL_L.w,
    0.75,
  );
  bulletList(
    s,
    [
      'Découverte, écoute, live et sortie IRL — un seul parcours',
      '5 espaces : Actualités · Carte · Direct · Messages · Reels',
      'En production sur getsoundy.com',
      "Salons d'écoute synchronisés + carte + live",
    ],
    3.0,
    COL_L.w,
    2.4,
  );
  phoneShot(s, shot('01-actualite.png'), "Fil d'actualité");
}, { notes: "Montrer l'app en direct si possible." });

// ── 4-8 · Fonctionnalités ──
function featureSlide({ num, label, titleText, desc, benefits, letter, shotFile, caption }) {
  newSlide((s) => {
    brandMark(s);
    sectionLabel(s, label);
    s.addText(String(num).padStart(2, '0'), {
      x: W - MX - 0.55,
      y: MY,
      w: 0.55,
      h: 0.4,
      fontSize: 20,
      bold: true,
      fontFace: FONT_HEAD,
      color: C.primaryLight,
      align: 'right',
      margin: 0,
    });

    iconCircle(s, letter, MX, 1.12, 0.4);
    heading(s, titleText, 1.1, COL_L.w - 0.5, 20);
    lede(s, desc, 1.85, COL_L.w);
    s.addShape(pptx.ShapeType.line, {
      x: MX,
      y: 2.35,
      w: COL_L.w - 0.2,
      h: 0,
      line: { color: C.border, width: 0.5 },
    });
    s.addText('BÉNÉFICES', {
      x: MX,
      y: 2.48,
      w: 3,
      h: 0.2,
      fontSize: 8,
      bold: true,
      fontFace: FONT_BODY,
      color: C.primary,
      charSpacing: 1.5,
      margin: 0,
    });
    bulletList(s, benefits, 2.72, COL_L.w - 0.1, 3.5, 10.5);
    phoneShot(s, shot(shotFile), caption);
  }, { notes: `Fonctionnalité : ${titleText}. Insister sur le bénéfice.` });
}

featureSlide({
  num: 1,
  label: 'Fonctionnalité',
  titleText: 'Carte & événements',
  desc: "Ce qui se passe autour de toi, ce soir et cette semaine.",
  benefits: [
    'Carte géolocalisée en temps réel',
    'Salons et lives repérables sans chercher',
    'Vue globe 3D au-delà de sa ville',
    'Contrôle de sa position et visibilité',
  ],
  letter: 'C',
  shotFile: '02-carte.png',
  caption: 'Carte interactive',
});

featureSlide({
  num: 2,
  label: 'Fonctionnalité',
  titleText: "Salons d'écoute",
  desc: 'La même musique, au même moment, avec ta communauté.',
  benefits: [
    'Lecture synchronisée entre participants',
    "Chat et file d'attente en direct",
    'Salons publics ou privés sur la carte',
    'Rejoindre un salon en un tap',
  ],
  letter: 'S',
  shotFile: '04-salon.png',
  caption: "Salon d'écoute",
});

featureSlide({
  num: 3,
  label: 'Fonctionnalité',
  titleText: 'Lives musicaux',
  desc: 'Diffuse ou suis une performance en direct.',
  benefits: [
    'Vidéo fluide, chat temps réel',
    'Réactions et soutien pendant le live',
    'Grille de découverte des lives en cours',
    'Mode théâtre ou PiP',
  ],
  letter: 'L',
  shotFile: '06-live.png',
  caption: 'Live · chat',
});

featureSlide({
  num: 4,
  label: 'Fonctionnalité',
  titleText: 'Réseau social musical',
  desc: 'Fil, reels et profils pensés pour la musique.',
  benefits: [
    "Fil : posts, stories, événements",
    'Reels pour découvrir des artistes',
    'Profil créateur : reels, abonnés, dates',
    'Messagerie pour organiser une sortie',
  ],
  letter: 'R',
  shotFile: '12-reels.png',
  caption: 'Reels & découverte',
});

featureSlide({
  num: 5,
  label: 'Fonctionnalité',
  titleText: 'Visibilité pour les lieux',
  desc: 'Bars et salles visibles auprès du public musique.',
  benefits: [
    'Emplacements sur carte, fil et stories',
    'Badge « Sponsorisé » conforme DSA',
    'Ciblage par ville ou zone carte',
    "Estimation d'audience avant campagne",
  ],
  letter: 'V',
  shotFile: '15-evenements-dates.png',
  caption: 'Agenda événements',
});

// ── 9 · Parcours ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Expérience');
  heading(s, 'Parcours utilisateur', 1.15, CW, 22);
  lede(s, 'De la découverte à la sortie, en quatre étapes', 1.85, CW);

  const steps = [
    ['1', 'Inscription', 'Profil, goûts, ville'],
    ['2', 'Découverte', 'Carte, salons, lives'],
    ['3', 'Utilisation', 'Salon, live, échanges'],
    ['4', 'Résultat', 'Sortie IRL ou moment partagé'],
  ];
  const sw = (CW - 0.36) / 4;
  steps.forEach(([num, t, d], i) => {
    const x = MX + i * (sw + 0.12);
    const y = 2.55;
    cardBox(s, x, y, sw, 2.15);
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + sw / 2 - 0.16,
      y: y - 0.16,
      w: 0.32,
      h: 0.32,
      fill: { color: C.primary },
      line: { type: 'none' },
    });
    s.addText(num, {
      x: x + sw / 2 - 0.16,
      y: y - 0.14,
      w: 0.32,
      h: 0.28,
      fontSize: 10,
      bold: true,
      color: C.white,
      align: 'center',
      valign: 'middle',
      fontFace: FONT_BODY,
      margin: 0,
    });
    s.addText(t, {
      x: x + 0.12,
      y: y + 0.35,
      w: sw - 0.24,
      h: 0.28,
      fontSize: 11,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      align: 'center',
      margin: 0,
    });
    s.addText(d, {
      x: x + 0.12,
      y: y + 0.72,
      w: sw - 0.24,
      h: 1.2,
      fontSize: 9,
      fontFace: FONT_BODY,
      color: C.muted,
      align: 'center',
      margin: 0,
      fit: 'shrink',
    });
  });
}, { notes: 'Histoire : Léa s\'inscrit, découvre un salon, le rejoint, sort en vrai.' });

// ── 10 · Avant / Après ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Impact');
  heading(s, 'Avant OnScen · Après OnScen', 1.15, CW, 22);
  s.addTable(
    [
      [headerCell('Situation'), headerCell('Avant'), headerCell('Avec OnScen')],
      [cellBefore('Découverte'), cellBefore('3-4 apps'), cellAfter('Un fil, une carte')],
      [cellBefore('Écoute'), cellBefore('Solitaire'), cellAfter("Salons synchronisés")],
      [cellBefore('Sorties'), cellBefore('Agenda non social'), cellAfter('Carte filtrée par date')],
      [cellBefore('Lives'), cellBefore('Plateformes génériques'), cellAfter('Live natif + chat')],
      [cellBefore('Visibilité'), cellBefore('Lieux invisibles'), cellAfter('Emplacements carte & fil')],
    ],
    {
      x: MX,
      y: 2.2,
      w: CW,
      colW: [2.8, 4.0, 4.0],
      fontFace: FONT_BODY,
      border: { type: 'solid', color: C.border, pt: 0.5 },
      autoPage: false,
    },
  );
}, { notes: 'Insister sur la colonne « Avec OnScen ».' });

// ── 11 · Cas d'usage ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Cas concrets');
  heading(s, "Cas d'usage", 1.15, CW, 22);
  lede(s, 'Trois profils, trois façons d\'utiliser OnScen', 1.85, CW);

  const cases = [
    ['L', 'Léa, 24 ans', 'Fan électro', 'Salons et lives du soir, rejoint ses amis en un tap.'],
    ['K', 'Karim, 29 ans', 'DJ / créateur', 'Live, soutien communauté, profil public.'],
    ['S', 'Sophie', 'Gérante de bar', 'Soirées sur la carte et le fil.'],
  ];
  const cw = (CW - 0.24) / 3;
  cases.forEach(([letter, name, role, d], i) => {
    const x = MX + i * (cw + 0.12);
    const y = 2.55;
    cardBox(s, x, y, cw, 2.45, { accent: true });
    iconCircle(s, letter, x + 0.18, y + 0.18, 0.34);
    s.addText(name, {
      x: x + 0.18,
      y: y + 0.65,
      w: cw - 0.36,
      h: 0.28,
      fontSize: 12,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      margin: 0,
    });
    pillTag(s, role, x + 0.18, y + 0.98, cw - 0.36);
    s.addText(d, {
      x: x + 0.18,
      y: y + 1.38,
      w: cw - 0.36,
      h: 0.9,
      fontSize: 9.5,
      fontFace: FONT_BODY,
      color: C.muted,
      margin: 0,
      fit: 'shrink',
    });
  });
}, { notes: 'Adapter le persona à l\'auditoire.' });

// ── 12 · Public cible ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Marché');
  heading(s, 'Public cible', 1.15);
  lede(s, 'France d\'abord — puis diaspora francophone', 1.85);
  bulletList(
    s,
    [
      'Fans musique et sorties — 16 à 35 ans',
      'Créateurs : DJs, artistes, collectifs',
      'Lieux : bars, clubs, salles 50–500 places',
      'Festivals, labels, marques lifestyle',
      'Métropoles françaises en priorité',
    ],
    2.4,
    COL_L.w,
    3.5,
  );
  phoneShot(s, shot('08-profil.png'), 'Profil créateur');
}, { notes: 'Rester qualitatif.' });

// ── 13 · Technologie ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Sous le capot');
  heading(s, 'Plateforme robuste et conforme', 1.15, CW, 22);
  lede(s, 'Simple à expliquer, solide en production', 1.85, CW);

  const items = [
    ['A', 'Application', 'PWA + iOS / Android'],
    ['T', 'Temps réel', 'Chat et salons synchronisés'],
    ['V', 'Vidéo live', 'Diffusion fiable'],
    ['P', 'Paiements', 'Pourboires et abonnements'],
    ['H', 'Hébergement', 'France · RGPD'],
    ['S', 'Sécurité', 'Modération et signalement'],
  ];
  const cw = (CW - 0.24) / 3;
  const ch = 1.15;
  items.forEach(([letter, t, d], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MX + col * (cw + 0.12);
    const y = 2.45 + row * (ch + 0.14);
    cardBox(s, x, y, cw, ch);
    iconCircle(s, letter, x + 0.14, y + 0.14, 0.32);
    s.addText(t, {
      x: x + 0.55,
      y: y + 0.12,
      w: cw - 0.65,
      h: 0.25,
      fontSize: 10.5,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      margin: 0,
    });
    s.addText(d, {
      x: x + 0.55,
      y: y + 0.4,
      w: cw - 0.65,
      h: 0.6,
      fontSize: 9,
      fontFace: FONT_BODY,
      color: C.muted,
      margin: 0,
      fit: 'shrink',
    });
  });
}, { notes: 'Vulgariser — rassurer.' });

// ── 14 · Modèle économique ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Modèle économique');
  heading(s, 'Revenus alignés avec l\'usage', 1.15, CW, 22);
  lede(s, 'Grille tarifaire sur devis — pas de chiffres engageants ici', 1.85, CW);

  const rows = [
    ['€', 'Sponsoring natif', 'Visibilité locale bars, festivals, marques'],
    ['+', 'Pourboires créateurs', 'Soutien direct pendant les lives'],
    ['★', 'Abonnements créateurs', 'Supporter / Super fan'],
    ['B', 'Offres lieux (à venir)', 'Formule établissements partenaires'],
  ];
  rows.forEach(([letter, t, d], i) => {
    const y = 2.45 + i * 0.82;
    cardBox(s, MX, y, CW, 0.68, { accent: true });
    iconCircle(s, letter, MX + 0.16, y + 0.15, 0.32);
    s.addText(t, {
      x: MX + 0.58,
      y: y + 0.1,
      w: 3.2,
      h: 0.48,
      fontSize: 11,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      valign: 'middle',
      margin: 0,
    });
    s.addText(d, {
      x: MX + 3.9,
      y: y + 0.1,
      w: CW - 4.1,
      h: 0.48,
      fontSize: 10,
      fontFace: FONT_BODY,
      color: C.muted,
      valign: 'middle',
      margin: 0,
      fit: 'shrink',
    });
  });
}, { notes: 'Pas de montants en public mixte.' });

// ── 15 · Roadmap ──
newSlide((s) => {
  brandMark(s);
  sectionLabel(s, 'Roadmap');
  heading(s, 'Où va OnScen', 1.15, CW, 22);
  lede(s, 'Trajectoire produit par paliers', 1.85, CW);

  const phases = [
    ['Now', 'Fondations', 'Carte, salons, lives, réseau social'],
    ['Next', 'Live premium', 'Replays, engagement communautaire'],
    ['Then', 'Croissance', 'Salons, découverte enrichie'],
    ['Vision', 'Expansion', 'Nouveaux marchés'],
  ];
  const pw = (CW - 0.24) / 4;
  const y = 2.65;
  const lineY = y + 0.55;

  s.addShape(pptx.ShapeType.line, {
    x: MX + 0.15,
    y: lineY,
    w: CW - 0.3,
    h: 0,
    line: { color: C.primaryLight, width: 2 },
  });

  phases.forEach(([tag, t, d], i) => {
    const x = MX + i * (pw + 0.08);
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + pw / 2 - 0.1,
      y: lineY - 0.1,
      w: 0.2,
      h: 0.2,
      fill: { color: C.primary },
      line: { type: 'none' },
    });
    pillTag(s, tag, x, y, pw);
    s.addText(t, {
      x,
      y: lineY + 0.35,
      w: pw,
      h: 0.28,
      fontSize: 11,
      bold: true,
      fontFace: FONT_BODY,
      color: C.ink,
      align: 'center',
      margin: 0,
    });
    s.addText(d, {
      x,
      y: lineY + 0.65,
      w: pw,
      h: 0.95,
      fontSize: 9,
      fontFace: FONT_BODY,
      color: C.muted,
      align: 'center',
      margin: 0,
      fit: 'shrink',
    });
  });
}, { notes: 'Jalons produit, pas de dates fermes.' });

// ── 16 · Conclusion ──
newSlide(
  (s) => {
    bg(s, C.ink);
    brandMark(s, true);

    s.addText('MERCI', {
      x: MX,
      y: 1.0,
      w: 3,
      h: 0.28,
      fontSize: 9,
      bold: true,
      fontFace: FONT_BODY,
      color: C.accent,
      charSpacing: 3,
      margin: 0,
    });
    s.addText('Écoutons, sortons, vivons\nla musique ensemble.', {
      x: MX,
      y: 1.35,
      w: COL_L.w,
      h: 1.1,
      fontSize: 26,
      bold: true,
      fontFace: FONT_HEAD,
      color: C.white,
      margin: 0,
      fit: 'shrink',
    });

    bulletList(
      s,
      [
        'Tester : getsoundy.com',
        'Partenaire : admin@getsoundy.com',
        'Créateur : lance ton salon ou live',
      ],
      2.65,
      COL_L.w,
      1.6,
      11,
      'E2E8F0',
    );
    ctaBtn(s, 'getsoundy.com', MX, 4.35, 2.1, C.accent, C.ink);
    phoneShot(s, shot('05-lives-tab.png'), 'Onglet Direct');
  },
  { dark: true, noBar: true, notes: 'CTA adapté à la salle.' },
);

await pptx.writeFile({ fileName: OUT_FILE });
console.log(`✅ Deck premium généré : ${OUT_FILE}`);
console.log(`   ${TOTAL} slides · layout safe ${W}×${H} · zone corps ≤ y ${BODY_MAX_Y}`);
