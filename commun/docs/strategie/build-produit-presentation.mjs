/**
 * Génère SOUNDY-PRESENTATION-PRODUIT.pptx — 10 slides produit Soundy.
 * Dimensions LAYOUT_16x9 réelles : 10 × 5.625 pouces (compatible Google Slides).
 *
 * Usage: npm run produit  (depuis commun/docs/strategie)
 */
import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'SOUNDY-PRESENTATION-PRODUIT.pptx');
const SHOTS = path.join(DOCS, 'presentation-screenshots', 'mobile');
const SHOTS_DESKTOP = path.join(DOCS, 'presentation-screenshots');
const LOGO = path.join(DOCS, '..', 'backend', 'public', 'soundy-logo.png');

const C = {
  bg: '0D0D14',
  bgAlt: '141422',
  border: '2D2D44',
  ink: 'F4F4F8',
  muted: 'A8A8B8',
  purple: '7C3AED',
  purpleLight: 'A78BFA',
  pink: 'F472B6',
  cyan: '22D3EE',
  white: 'FFFFFF',
};

const FONT = 'Calibri';

// ── Slide 16:9 réel (pptxgenjs LAYOUT_16x9) ──
const W = 10;
const H = 5.625;
const MX = 0.5;
const MY = 0.35;
const CW = W - MX * 2;
const FOOT = 5.35;
const LEFT_W = 5.85;
const PHONE = { x: 6.55, y: 0.85, w: 1.55, h: 3.35 };

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Soundy';
pptx.company = 'Soundy · getsoundy.com';
pptx.title = 'Soundy — Présentation produit';

function shot(name) {
  const p = path.join(SHOTS, name);
  return fs.existsSync(p) ? p : null;
}

function shotDesktop(name) {
  const p = path.join(SHOTS_DESKTOP, name);
  return fs.existsSync(p) ? p : null;
}

function bg(slide) {
  slide.background = { color: C.bg };
}

function bar(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.04,
    fill: { color: C.purple }, line: { type: 'none' },
  });
}

function footer(slide, n, total) {
  slide.addText('Soundy · getsoundy.com', {
    x: MX, y: FOOT, w: 4, h: 0.2,
    fontSize: 7, fontFace: FONT, color: C.muted, margin: 0,
  });
  slide.addText(`${n} / ${total}`, {
    x: W - MX - 0.5, y: FOOT, w: 0.5, h: 0.2,
    fontSize: 7, fontFace: FONT, color: C.muted, align: 'right', margin: 0,
  });
}

function label(slide, text, y = 0.55) {
  slide.addText(text.toUpperCase(), {
    x: MX, y, w: LEFT_W, h: 0.2,
    fontSize: 8, bold: true, fontFace: FONT, color: C.purpleLight, margin: 0,
  });
}

function title(slide, text, y, w = LEFT_W, size = 20) {
  slide.addText(text, {
    x: MX, y, w, h: 0.55,
    fontSize: size, bold: true, fontFace: FONT, color: C.ink, margin: 0,
  });
}

function lede(slide, text, y, w = LEFT_W) {
  slide.addText(text, {
    x: MX, y, w, h: 0.35,
    fontSize: 9, fontFace: FONT, color: C.muted, margin: 0,
  });
}

function bullets(slide, items, y, w = LEFT_W, h = 2.2, size = 9) {
  const rows = items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } }));
  slide.addText(rows, {
    x: MX, y, w, h,
    fontSize: size, fontFace: FONT, color: C.ink,
    valign: 'top', paraSpaceAfter: 4, margin: 0,
  });
}

function highlight(slide, text, y, w = LEFT_W) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: MX, y, w, h: 0.42,
    fill: { color: C.bgAlt }, line: { color: C.purple, width: 0.75 },
    rectRadius: 0.06,
  });
  slide.addText(text, {
    x: MX + 0.12, y: y + 0.06, w: w - 0.24, h: 0.3,
    fontSize: 8.5, bold: true, fontFace: FONT, color: C.purpleLight, margin: 0,
  });
}

function phone(slide, file, cap) {
  if (!file) return;
  const { x, y, w, h } = PHONE;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x - 0.05, y: y - 0.05, w: w + 0.1, h: h + 0.1,
    fill: { color: '07070B' }, line: { color: C.border, width: 0.75 },
    rectRadius: 0.12,
  });
  slide.addImage({ path: file, x, y, w, h, rounding: true, sizing: { type: 'contain', w, h } });
  if (cap) {
    slide.addText(cap, {
      x: x - 0.05, y: y + h + 0.08, w: w + 0.1, h: 0.18,
      fontSize: 7, fontFace: FONT, color: C.muted, align: 'center', margin: 0,
    });
  }
}

/** Capture paysage (salon, live desktop) — cadre large, ratio ~1024×769 */
function wideShot(slide, file, cap) {
  if (!file) return;
  const frame = { x: 5.55, y: 1.05, w: 4.0, h: 2.05 };
  const img = { x: 5.62, y: 1.12, w: 3.86, h: 1.9 };
  slide.addShape(pptx.ShapeType.roundRect, {
    ...frame,
    fill: { color: '07070B' }, line: { color: C.border, width: 0.75 },
    rectRadius: 0.08,
  });
  slide.addImage({
    path: file, ...img, rounding: true,
    sizing: { type: 'contain', w: img.w, h: img.h },
  });
  if (cap) {
    slide.addText(cap, {
      x: frame.x, y: frame.y + frame.h + 0.08, w: frame.w, h: 0.18,
      fontSize: 7, fontFace: FONT, color: C.muted, align: 'center', margin: 0,
    });
  }
}

function dualPhone(slide, f1, f2, c1, c2) {
  const pw = 1.35;
  const ph = 2.85;
  const y = 0.95;
  [[MX + LEFT_W + 0.15, f1, c1], [MX + LEFT_W + 0.15 + pw + 0.12, f2, c2]].forEach(([x, f, c]) => {
    if (!f) return;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: pw, h: ph,
      fill: { color: '07070B' }, line: { color: C.border, width: 0.75 },
      rectRadius: 0.1,
    });
    slide.addImage({ path: f, x: x + 0.04, y: y + 0.04, w: pw - 0.08, h: ph - 0.22, rounding: true, sizing: { type: 'contain', w: pw - 0.08, h: ph - 0.22 } });
    if (c) {
      slide.addText(c, {
        x, y: y + ph - 0.16, w: pw, h: 0.14,
        fontSize: 6.5, fontFace: FONT, color: C.muted, align: 'center', margin: 0,
      });
    }
  });
}

const TOTAL = 10;
let n = 0;

function slide(fn, notes) {
  n += 1;
  const s = pptx.addSlide();
  bg(s);
  bar(s);
  fn(s);
  footer(s, n, TOTAL);
  if (notes) s.addNotes(notes);
}

// 1 · Accueil
slide((s) => {
  if (fs.existsSync(LOGO)) s.addImage({ path: LOGO, x: MX, y: 0.75, w: 0.45, h: 0.45 });
  label(s, 'getsoundy.com', 0.55);
  s.addText('Soundy', {
    x: MX, y: 1.15, w: 8, h: 0.75,
    fontSize: 36, bold: true, fontFace: FONT, color: C.ink, margin: 0,
  });
  s.addText("Promoteur d'artistes et d'événements", {
    x: MX, y: 1.95, w: 8, h: 0.45,
    fontSize: 16, bold: true, fontFace: FONT, color: C.pink, margin: 0,
  });
  s.addText('Réseau social · musique live · sorties', {
    x: MX, y: 2.5, w: 7, h: 0.35,
    fontSize: 11, fontFace: FONT, color: C.muted, margin: 0,
  });
  phone(s, shot('02-carte.png'), 'Carte · événements');
}, 'Accroche : Soundy promeut artistes et événements dans une app unifiée.');

// 2 · Sommaire — grille 2×4 agrandie (alignée HTML deck)
slide((s) => {
  title(s, 'Sommaire', 0.42, CW, 22);
  const items = [
    'Présentation de l\'application',
    'Carte & globe',
    'Événements, sponsoring & filtres',
    'Salons d\'écoute synchronisés',
    'Lives artistiques',
    'Onglet Musique — découverte',
    'Modèle économique',
    'Reels artistiques',
  ];
  const COL_GAP = 0.2;
  const COL_W = (CW - COL_GAP) / 2;
  const ROW_H = 0.52;
  const ROW_GAP = 0.1;
  const START_Y = 0.95;
  const BADGE = 0.28;
  items.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MX + col * (COL_W + COL_GAP);
    const y = START_Y + row * (ROW_H + ROW_GAP);
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: COL_W, h: ROW_H,
      fill: { color: C.bgAlt }, line: { color: C.border, width: 0.5 },
      rectRadius: 0.06,
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.12, y: y + (ROW_H - BADGE) / 2, w: BADGE, h: BADGE,
      fill: { color: C.purple }, line: { type: 'none' },
    });
    s.addText(String(i + 1), {
      x: x + 0.12, y: y + (ROW_H - BADGE) / 2, w: BADGE, h: BADGE,
      fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: FONT, margin: 0,
    });
    s.addText(t, {
      x: x + 0.5, y, w: COL_W - 0.58, h: ROW_H,
      fontSize: 11, fontFace: FONT, color: C.ink, margin: 0, valign: 'middle',
    });
  });
});

// 3 · Application
slide((s) => {
  label(s, 'Produit');
  title(s, "L'application Soundy", 0.75);
  lede(s, 'Social, carte et expériences musicales live — en production.', 1.35);
  bullets(s, [
    '6 espaces : Actualités · Carte · Direct · Messages · Reels · Musique',
    'PWA + apps natives iOS & Android',
    'Profils créateurs, fans et lieux partenaires',
    'Hébergement France · RGPD',
  ], 1.75, LEFT_W, 1.8);
  highlight(s, "Promoteur d'artistes et d'événements — pas un réseau généraliste.", 3.65);
  phone(s, shot('01-actualite.png'), 'Écran de connexion');
});

// 4 · Globe & carte
slide((s) => {
  label(s, 'Carte');
  title(s, 'Globe & carte sombre', 0.75);
  lede(s, 'Pins salon · live · événement — vue locale ou globe 3D.', 1.35);
  bullets(s, [
    'Carte géolocalisée thème sombre',
    'Vue globe 3D pour explorer d\'autres villes',
    'Pins distincts : salon, live en cours, événement',
    'Contrôle position et visibilité',
  ], 1.75, LEFT_W, 1.7);
  dualPhone(s, shot('11-globe-3d.png'), shot('10-carte-grise.png'), 'Globe 3D', 'Carte · pins');
});

// 5 · Événements
slide((s) => {
  label(s, 'Événements');
  title(s, 'Événements & sponsoring', 0.75);
  lede(s, 'Dates, lieux et campagnes sponsorisées sur la carte.', 1.35);
  bullets(s, [
    'Fenêtre 3 prochains jours sur la carte',
    'Fiche événement : date, lieu, affiche, billetterie',
    'Filtres : Lives · Salon · Événement',
    'Sponsoring natif — badge « Sponsorisé » (DSA)',
    'Ciblage ville, région ou zone carte',
  ], 1.75, LEFT_W, 2.0, 8.5);
  phone(s, shot('15-evenements-dates.png'), 'Agenda · dates');
});

// 6 · Salons
slide((s) => {
  label(s, 'Salons');
  title(s, "Salons d'écoute", 0.75);
  lede(s, 'Écoute synchronisée à distance — avant une sortie.', 1.35);
  bullets(s, [
    'Sync via API YouTube — même piste, même moment',
    'Picture-in-Picture (PiP)',
    'Chat temps réel',
    'File d\'attente collaborative',
    'Salons publics ou privés sur la carte',
  ], 1.75, LEFT_W, 2.0, 8.5);
  wideShot(s, shot('04-salon.png'), 'Salon · sync · chat · file d\'attente');
});

// 7 · Live
slide((s) => {
  label(s, 'Direct');
  title(s, 'Lives artistiques', 0.75);
  lede(s, 'Performance en direct — musique, danse, spectacle.', 1.35);
  bullets(s, [
    'Diffusion vidéo fluide (LiveKit / Cloudflare)',
    'Chat communautaire',
    'Dons & pourboires créateurs (Stripe Connect)',
    'Grille découverte · mode théâtre',
  ], 1.75, LEFT_W, 1.7);
  highlight(s, 'DJ sets, showcases, sessions — pas de contenu généraliste.', 3.55);
  wideShot(s, shotDesktop('06-live.png') || shot('06-live.png'), 'Live · chat · récompenses · HLS');
});

// 8 · Musique
slide((s) => {
  label(s, 'Musique');
  title(s, 'Onglet Musique', 0.75);
  lede(s, 'Découverte artistique — discographies, tendances et top performeurs.', 1.35);
  bullets(s, [
    'Tendances de la semaine — top créateurs (live & sessions, par pays)',
    'Spotlight Tendance #1 · classement albums, morceaux & reels',
    'Découvrir — nouveaux morceaux & playlists communautaires',
    'Populaire — top performeurs : morceaux les plus écoutés',
    'Créateurs à suivre · recherche · Abonnements & bibliothèque',
  ], 1.75, LEFT_W, 2.0, 8.5);
  highlight(s, '100 % discographie Soundy — pas de catalogue streaming externe.', 3.75);
  phone(s, shot('13-musique.png'), 'Musique · tendances');
});

// 9 · Rémunération
slide((s) => {
  label(s, 'Business');
  title(s, 'Comment Soundy est rémunéré', 0.75);
  lede(s, 'Leviers alignés avec l\'usage — sans pub intrusive.', 1.35);
  bullets(s, [
    'Sponsoring natif — bars, festivals, marques (sur devis)',
    'Pourboires créateurs pendant les lives',
    'Abonnements Supporter / Super fan',
    'Offres lieux partenaires (à venir)',
  ], 1.75, LEFT_W, 1.7);
  highlight(s, 'Grille sur devis · estimation d\'audience avant campagne.', 3.55);
  phone(s, shot('08-profil.png'), 'Créateurs & lieux');
});

// 10 · Reels
slide((s) => {
  label(s, 'Reels');
  title(s, 'Reels artistiques', 0.75);
  lede(s, 'Format 9:16 — promotion musicale uniquement.', 1.35);
  bullets(s, [
    'Teasers DJ set, aftermovies, extraits live',
    'Présentation album, single ou EP',
    'Annonce événement ou date de tournée',
    'Reels sponsorisés lieux & labels',
  ], 1.75, LEFT_W, 1.7);
  highlight(s, 'Chaque Reel sert la visibilité d\'un artiste ou d\'un événement.', 3.55);
  phone(s, shot('12-reels.png'), 'Reels · artistique');
});

await pptx.writeFile({ fileName: OUT });
console.log(`✅ Présentation produit : ${OUT}`);
console.log(`   ${TOTAL} slides · ${W}×${H}" · Google Slides compatible`);
