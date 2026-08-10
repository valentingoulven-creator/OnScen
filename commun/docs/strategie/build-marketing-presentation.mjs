/**
 * Génère ONSCEN-MARKETING-PRESENTATION.pptx — deck marketing OnScen (FR).
 * Usage: npm run pptx  (depuis commun/docs/strategie)
 */
import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(__dirname, 'ONSCEN-MARKETING-PRESENTATION.pptx');
const SHOTS = path.join(DOCS_DIR, 'presentation-screenshots', 'mobile');
const LOGO = path.join(DOCS_DIR, '..', 'backend', 'public', 'onscen-logo.png');

const C = {
  bg: '07070B',
  bgCard: '141422',
  purple: '7C3AED',
  purpleLight: 'A78BFA',
  pink: 'F472B6',
  cyan: '22D3EE',
  text: 'F4F4F8',
  muted: 'A8A8B8',
  white: 'FFFFFF',
};

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'OnScen';
pptx.company = 'OnScen · getsoundy.com';
pptx.subject = 'Présentation marketing — réseau social musique live & sorties';
pptx.title = 'OnScen — Présentation marketing';

function shot(name) {
  const p = path.join(SHOTS, name);
  return fs.existsSync(p) ? p : null;
}

function addBg(slide) {
  slide.background = { color: C.bg };
}

function addFooter(slide, n, total) {
  slide.addText('OnScen · getsoundy.com · Juillet 2026', {
    x: 0.4,
    y: 5.25,
    w: 6,
    h: 0.25,
    fontSize: 8,
    color: C.muted,
    margin: 0,
  });
  slide.addText(`${n} / ${total}`, {
    x: 11.8,
    y: 5.25,
    w: 1.2,
    h: 0.25,
    fontSize: 8,
    color: C.muted,
    align: 'right',
    margin: 0,
  });
}

function addTitle(slide, eyebrow, title, subtitle) {
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: 0.55,
      y: 0.35,
      w: 12,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: C.purpleLight,
      charSpacing: 3,
      margin: 0,
    });
  }
  slide.addText(title, {
    x: 0.55,
    y: eyebrow ? 0.72 : 0.4,
    w: 12,
    h: 0.75,
    fontSize: 32,
    bold: true,
    color: C.white,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.55,
      y: eyebrow ? 1.45 : 1.15,
      w: 11,
      h: 0.55,
      fontSize: 14,
      color: C.muted,
      margin: 0,
    });
  }
}

function addBullets(slide, items, opts = {}) {
  const rows = items.map((t) => ({
    text: t,
    options: { bullet: true, breakLine: true },
  }));
  slide.addText(rows, {
    x: opts.x ?? 0.55,
    y: opts.y ?? 1.95,
    w: opts.w ?? 6.2,
    h: opts.h ?? 3.2,
    fontSize: opts.fontSize ?? 13,
    color: C.text,
    valign: 'top',
    paraSpaceAfter: 8,
    margin: 0,
  });
}

function addImageRight(slide, file, caption) {
  if (!file) return;
  slide.addImage({
    path: file,
    x: 7.05,
    y: 0.85,
    w: 2.35,
    h: 5.05,
    rounding: true,
  });
  if (caption) {
    slide.addText(caption, {
      x: 7.05,
      y: 5.95,
      w: 2.35,
      h: 0.3,
      fontSize: 8,
      color: C.muted,
      align: 'center',
      margin: 0,
    });
  }
}

function addHighlight(slide, text, y = 1.85) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y,
    w: 6.1,
    h: 1.05,
    fill: { color: C.bgCard },
    line: { color: C.purple, width: 1 },
    rectRadius: 0.08,
  });
  slide.addText(text, {
    x: 0.7,
    y: y + 0.12,
    w: 5.8,
    h: 0.85,
    fontSize: 12,
    bold: true,
    color: C.purpleLight,
    valign: 'mid',
    margin: 0,
  });
}

function addKpiRow(slide, kpis, y = 4.55) {
  const w = 2.6;
  kpis.forEach((k, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55 + i * (w + 0.15),
      y,
      w,
      h: 0.55,
      fill: { color: C.bgCard },
      line: { color: C.purple, width: 0.5 },
      rectRadius: 0.06,
    });
    slide.addText(k, {
      x: 0.55 + i * (w + 0.15),
      y: y + 0.1,
      w,
      h: 0.4,
      fontSize: 10,
      bold: true,
      color: C.text,
      align: 'center',
      margin: 0,
    });
  });
}

const TOTAL = 16;
let n = 0;

function slide(fn) {
  n += 1;
  const s = pptx.addSlide();
  addBg(s);
  fn(s, n);
  addFooter(s, n, TOTAL);
}

// ── 1 · Couverture ──
slide((s) => {
  if (fs.existsSync(LOGO)) {
    s.addImage({ path: LOGO, x: 0.55, y: 0.45, w: 0.65, h: 0.65 });
  }
  s.addText('RÉSEAU SOCIAL · MUSIQUE LIVE · SORTIES', {
    x: 1.35,
    y: 0.55,
    w: 10,
    h: 0.35,
    fontSize: 11,
    bold: true,
    color: C.purpleLight,
    charSpacing: 4,
    margin: 0,
  });
  s.addText('OnScen', {
    x: 0.55,
    y: 1.35,
    w: 12,
    h: 1.1,
    fontSize: 54,
    bold: true,
    color: C.white,
    margin: 0,
  });
  s.addText('Écouter ensemble. Sortir. Vivre la musique.', {
    x: 0.55,
    y: 2.45,
    w: 11,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: C.purpleLight,
    margin: 0,
  });
  s.addText(
    'Découvrir artistes & événements — carte géolocalisée, salons d\'écoute, lives vidéo, réseau social musique.',
    { x: 0.55, y: 3.05, w: 7.5, h: 0.7, fontSize: 13, color: C.muted, margin: 0 },
  );
  addKpiRow(s, ['5 onglets', 'Prod France', 'RGPD · Scaleway', 'PWA + mobile'], 4.35);
  s.addText('getsoundy.com  ·  admin@getsoundy.com', {
    x: 0.55,
    y: 5.05,
    w: 8,
    h: 0.3,
    fontSize: 11,
    color: C.cyan,
    margin: 0,
  });
  addImageRight(s, shot('02-carte.png'), 'Carte · événements & salons');
});

// ── 2 · Pitch ──
slide((s) => {
  addTitle(s, 'EXECUTIF', 'En une minute', 'La plateforme qui fait connaître artistes & événements');
  addHighlight(
    s,
    'OnScen = réseau social musique + carte + salons synchronisés + lives — où la communauté écoute et sort.',
  );
  addBullets(s, [
    'Audience ciblée : musique live, sorties, événements — pas du scroll généraliste',
    'Carte : pins événements (3 jours), salons, lives · vue globe 3D',
    'Monétisation : sponsors natifs (7 emplacements) + Stripe Connect créateurs',
    'Production opérationnelle · hébergement France · conformité RGPD / DSA',
  ], { y: 3.05 });
});

// ── 3 · Problème ──
slide((s) => {
  addTitle(s, 'MARCHÉ', 'Le problème', 'Musique, sorties et visibilité locale sont fragmentés');
  addBullets(s, [
    'TikTok, Spotify, Instagram, Shotgun — aucun parcours unifié écoute + sortie',
    'Difficile de voir qui joue où ce soir, près de chez soi',
    'Bars & salles 50–500 places : visibilité faible entre deux dates',
    'Créateurs mid-tier : pas de hub simple entre live, communauté et revenus',
    'Promoteurs locaux : budgets pub généralistes, CPM élevés, ciblage imprécis',
  ]);
  s.addText('→ OnScen reconnecte écoute sociale, carte et événements.', {
    x: 0.55,
    y: 4.85,
    w: 11,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: C.pink,
    margin: 0,
  });
});

// ── 4 · Solution ──
slide((s) => {
  addTitle(s, 'PRODUIT', 'La solution OnScen', 'Un seul endroit pour découvrir, écouter et sortir');
  addHighlight(
    s,
    'Écouter la même musique au même moment — sur une carte, en salon ou en live vidéo.',
  );
  addBullets(s, [
    '5 espaces : Actualités · Carte · Direct · Messages · Reels',
    'Agenda événements 3 prochains jours · filtres Lives / Salon / Événement',
    'Salons YouTube synchronisés · chat · file d\'attente',
    'Lives caméra + HLS · pourboires Stripe Connect',
  ], { y: 3.05 });
  addImageRight(s, shot('01-actualite.png'), 'Fil d\'actualité');
});

// ── 5 · Parcours utilisateur ──
slide((s) => {
  addTitle(s, 'UX', 'Comment ça marche ?', '4 étapes — de la découverte à la sortie');
  const steps = [
    ['1', 'Profil & affinités', 'Goûts musicaux, ville, abonnements créateurs'],
    ['2', 'Carte & agenda', 'Événements, salons et lives à proximité'],
    ['3', 'Rejoindre ou lancer', 'Salon YouTube sync ou live caméra + chat'],
    ['4', 'Partager & soutenir', 'Stories, reels, pourboires Stripe Connect'],
  ];
  steps.forEach(([num, title, desc], i) => {
    const y = 1.85 + i * 0.95;
    s.addShape(pptx.ShapeType.ellipse, {
      x: 0.55,
      y,
      w: 0.45,
      h: 0.45,
      fill: { color: C.purple },
    });
    s.addText(num, {
      x: 0.55,
      y: y + 0.05,
      w: 0.45,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: C.white,
      align: 'center',
      margin: 0,
    });
    s.addText(title, {
      x: 1.15,
      y,
      w: 5,
      h: 0.3,
      fontSize: 14,
      bold: true,
      color: C.white,
      margin: 0,
    });
    s.addText(desc, {
      x: 1.15,
      y: y + 0.32,
      w: 5.5,
      h: 0.35,
      fontSize: 11,
      color: C.muted,
      margin: 0,
    });
  });
  addImageRight(s, shot('07-messages.png'), 'Messages & communauté');
});

// ── 6 · Carte ──
slide((s) => {
  addTitle(s, 'CŒUR PRODUIT', 'Carte & événements', 'La visibilité locale, en un coup d\'œil');
  addBullets(s, [
    'Pins événements : fenêtre 3 prochains jours (filtre Événement)',
    'Section ✨ Sponso : carrousel partenaires en tête de sidebar',
    'Salons d\'écoute et lives géolocalisés · vue globe 3D',
    'Onglets Autour (proximité) et Pays (agenda national)',
    'Position floutée · contrôle de visibilité utilisateur',
  ]);
  addImageRight(s, shot('02-carte.png'), 'Carte interactive');
});

// ── 7 · Salons ──
slide((s) => {
  addTitle(s, 'DIFFÉRENCIATION', 'Salons d\'écoute', 'Watch party musicale — différenciateur clé vs concurrence EU');
  addBullets(s, [
    'Lecture YouTube synchronisée entre participants',
    'Chat, file d\'attente, modération hôte',
    'Petit salon : rejoindre depuis la carte en 1 tap',
    'Salons publics ou privés · ancrés géographiquement',
    'Soirées entre amis ou communautés locales',
  ]);
  addImageRight(s, shot('04-salon.png'), 'Grand salon');
});

// ── 8 · Lives ──
slide((s) => {
  addTitle(s, 'DIRECT', 'Lives musicaux', 'Performance live + monétisation intégrée');
  addBullets(s, [
    'Caméra + musique en direct (LiveKit / Cloudflare HLS)',
    'Chat temps réel, réactions et pourboires visuels',
    'Stripe Connect en production',
    'Grille découverte · théâtre / PiP',
    '16+ performer · 18+ monétisation',
  ]);
  addImageRight(s, shot('06-live.png'), 'Live · chat & pourboires');
});

// ── 9 · Social ──
slide((s) => {
  addTitle(s, 'SOCIAL', 'Actualités, Reels & profils', 'Rétention et découverte au-delà de la carte');
  addBullets(s, [
    'Fil d\'actualité : posts, stories, événements partagés',
    'Reels 9:16 · découverte créateurs locaux',
    'Profil public : reels, abonnés, favoris, dates à venir',
    'Messages, matchs musicaux, groupes',
    'Effet réseau : partage → visibilité → sorties (effet boule de neige)',
  ]);
  addImageRight(s, shot('12-reels.png'), 'Reels & créateurs');
});

function headerCell(text) {
  return { text, options: { fill: { color: C.purple }, color: C.white, bold: true, fontSize: 10 } };
}

function bodyCell(text, bold = false) {
  return {
    text,
    options: {
      fill: { color: C.bgCard },
      color: bold ? C.purpleLight : C.text,
      bold,
      fontSize: 10,
    },
  };
}

// ── 10 · Différenciation ──
slide((s) => {
  addTitle(s, 'POSITIONNEMENT', 'Pourquoi OnScen ?', 'Vs réseaux généralistes et apps events seules');
  s.addTable(
    [
      [
        headerCell('Critère'),
        headerCell('Instagram / TikTok'),
        headerCell('Apps events'),
        headerCell('OnScen'),
      ],
      [
        bodyCell('Audience'),
        bodyCell('Généraliste'),
        bodyCell('Billets / soirées'),
        bodyCell('Musique live & sorties', true),
      ],
      [
        bodyCell('Carte + social'),
        bodyCell('Non'),
        bodyCell('Partiel'),
        bodyCell('Oui · cœur produit', true),
      ],
      [
        bodyCell('Salons d\'écoute'),
        bodyCell('Non'),
        bodyCell('Non'),
        bodyCell('Oui · synchronisés', true),
      ],
      [
        bodyCell('Lives + tips'),
        bodyCell('Partiel'),
        bodyCell('Non'),
        bodyCell('Oui · Stripe Connect', true),
      ],
      [
        bodyCell('CPM sponsors FR'),
        bodyCell('6–18 €'),
        bodyCell('Variable'),
        bodyCell('Dès 3 € (lancement)', true),
      ],
      [
        bodyCell('Géo'),
        bodyCell('Approximative'),
        bodyCell('Ville'),
        bodyCell('Viewport carte · Autour / Pays', true),
      ],
    ],
    {
      x: 0.45,
      y: 1.75,
      w: 12.2,
      colW: [2.2, 3.2, 3.2, 3.6],
      border: { type: 'solid', color: C.purple, pt: 0.5 },
    },
  );
});

// ── 11 · Sponsors ──
slide((s) => {
  addTitle(s, 'MONÉTISATION', '7 emplacements sponsors', 'Formats natifs · badge « Sponsorisé » · DSA / RGPD');
  s.addTable(
    [
      [
        headerCell('Emplacement'),
        headerCell('Surface'),
        headerCell('Idéal pour'),
        headerCell('Dès 7 j · HT'),
      ],
      [
        bodyCell('Sidebar carte · Sponso'),
        bodyCell('Pin ✨ + carrousel'),
        bodyCell('Soirées bar, concerts'),
        bodyCell('~150 €', true),
      ],
      [
        bodyCell('Bandeau carte'),
        bodyCell('Carrousel tête carte'),
        bodyCell('Notoriété locale'),
        bodyCell('~250 €', true),
      ],
      [
        bodyCell('Fil d\'actualité'),
        bodyCell('Carte native'),
        bodyCell('Annonces, line-up'),
        bodyCell('~525 €', true),
      ],
      [
        bodyCell('Story / Reel sponsorisé'),
        bodyCell('Plein écran'),
        bodyCell('Affiche, teaser DJ'),
        bodyCell('~150–280 €', true),
      ],
      [
        bodyCell('Théâtre salon'),
        bodyCell('Placement immersif'),
        bodyCell('Activation premium'),
        bodyCell('~85 €', true),
      ],
    ],
    {
      x: 0.45,
      y: 1.72,
      w: 12.2,
      colW: [3.2, 2.8, 3.8, 2.4],
      border: { type: 'solid', color: C.purple, pt: 0.5 },
    },
  );
  s.addText('Estimation d\'audience avant lancement · planification dates · ciblage ville / région / France', {
    x: 0.55,
    y: 4.95,
    w: 12,
    h: 0.35,
    fontSize: 10,
    color: C.muted,
    margin: 0,
  });
});

// ── 12 · Offre pilote ──
slide((s) => {
  addTitle(s, 'OFFRE FONDATEUR', 'Lieux pilotes · Occitanie, Paris, Lyon', '10 places · lancement sous 72 h');
  addHighlight(s, 'Sidebar carte · Sponso — 7 jours à 99 € HT (au lieu de ~150 €)', 2.0);
  addBullets(s, [
    'Créez votre événement (date, lieu, affiche) — ou nous le paramétrons',
    'Pin visible sur la carte + section ✨ en tête sidebar Autour / Pays',
    'Fans à proximité voient votre soirée dans la fenêtre 3 prochains jours',
    'Option Reel : teaser 15–60 s pour amplifier avant le jour J',
    'Pack Starter : Sponso + 1 Reel · 199 € HT · packages sur devis',
  ], { y: 3.15, w: 6.4 });
  addImageRight(s, shot('15-evenements-dates.png'), 'Agenda événements');
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y: 4.75,
    w: 6.1,
    h: 0.65,
    fill: { color: C.purple },
    line: { color: C.purpleLight, width: 0 },
    rectRadius: 0.08,
  });
  s.addText('admin@getsoundy.com  ·  Devis : emplacement · dates · ville · billetterie', {
    x: 0.7,
    y: 4.88,
    w: 5.8,
    h: 0.45,
    fontSize: 11,
    bold: true,
    color: C.white,
    align: 'center',
    margin: 0,
  });
});

// ── 13 · Créateurs ──
slide((s) => {
  addTitle(s, 'CRÉATEURS', 'Monétisation & communauté', 'Plateforme sociale musicale — pas un service de rencontre');
  addBullets(s, [
    'Profil public : reels, abonnés, favoris, événements à venir',
    'Live + pourboires + abonnements Supporter / Super fan',
    'Stripe Connect · OnScen+ en production',
    '13+ compte · 16+ live · 18+ monétisation',
    'Visibilité : carte, fil, reels — effet réseau local',
  ]);
  addImageRight(s, shot('08-profil.png'), 'Profil créateur');
});

// ── 14 · Tech & conformité ──
slide((s) => {
  addTitle(s, 'CONFIANCE', 'Plateforme & conformité', 'Production juillet 2026 · hébergement France');
  addBullets(s, [
    'Web PWA + apps natives iOS / Android (Capacitor)',
    'Hébergement Scaleway · données France · RGPD',
    'Paiements Stripe — aucune carte stockée chez OnScen',
    'Modération : signalement, bannissement, CGU · transparence DSA',
    'Âge minimum 13 ans · autorisation parentale 13–18',
  ], { w: 6.0 });
  addImageRight(s, shot('11-globe-3d.png'), 'Vue globe 3D');
});

// ── 15 · Vision ──
slide((s) => {
  addTitle(s, 'VISION', '2026 et au-delà', 'Faire connaître artistes & événements — ville par ville');
  addBullets(s, [
    'Densifier la communauté musique en France (Occitanie → métropoles)',
    'Accélérer partenariats bars, salles, festivals fondateurs',
    'Renforcer découverte locale : carte, événements, reels, salons',
    'Où la musique devient un moment partagé — en ligne et sur place',
    'Mission : visibilité qui grandit — comme une boule de neige',
  ]);
  addImageRight(s, shot('03-petit-salon.png'), 'Petit salon sur la carte');
});

// ── 16 · Contact ──
slide((s) => {
  addTitle(s, 'PROCHAINE ÉTAPE', 'Contact & démo', 'Prêts à écouter — et sortir — ensemble ?');
  addBullets(s, [
    'Tester l\'app : getsoundy.com (web, PWA, mobile)',
    'Bar / salle / festival : devis Sponso · admin@getsoundy.com',
    'Créateur : lancer un salon ou un live près de chez vous',
    'One-pager commercial & estimation audience sur demande',
    'Échange 15 min → estimation audience → devis → campagne live',
  ], { y: 1.95, w: 6.5 });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.55,
    y: 4.55,
    w: 5.5,
    h: 0.75,
    fill: { color: C.purple },
    rectRadius: 0.1,
  });
  s.addText('getsoundy.com', {
    x: 0.55,
    y: 4.68,
    w: 5.5,
    h: 0.5,
    fontSize: 20,
    bold: true,
    color: C.white,
    align: 'center',
    margin: 0,
  });
  addImageRight(s, shot('05-lives-tab.png'), 'Rejoignez un live ce soir');
});

await pptx.writeFile({ fileName: OUT_FILE });
console.log(`✅ Présentation générée : ${OUT_FILE}`);
console.log(`   ${TOTAL} slides · captures ${SHOTS}`);
