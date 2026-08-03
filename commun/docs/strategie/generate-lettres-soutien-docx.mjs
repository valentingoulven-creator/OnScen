/**
 * Génère les 10 lettres de soutien Soundy en .docx
 * Usage: npm run lettres-soutien --prefix commun/docs/strategie
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'lettres-soutien');

/** @param {string} line */
function paragraphFromLine(line) {
  if (!line.trim()) {
    return new Paragraph({ text: '', spacing: { after: 80 } });
  }
  /** @type {import('docx').TextRun[]} */
  const children = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      children.push(new TextRun(line.slice(last, m.index)));
    }
    children.push(new TextRun({ text: m[1], bold: true }));
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    children.push(new TextRun(line.slice(last)));
  }
  if (children.length === 0) {
    children.push(new TextRun(line));
  }
  return new Paragraph({
    children,
    spacing: { after: line.startsWith('- ') ? 80 : 160 },
  });
}

/**
 * @param {{ slug: string, title: string, subtitle: string, lines: string[] }} letter
 */
async function writeLetter(letter) {
  const header = [
    new Paragraph({
      text: letter.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: letter.subtitle,
          italics: true,
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Modèle indicatif — Soundy · getsoundy.com · Remplacer les […] avant envoi.',
          size: 18,
          color: '888888',
        }),
      ],
      spacing: { after: 320 },
    }),
  ];

  const body = letter.lines.map((line) => paragraphFromLine(line));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [...header, ...body],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const path = join(OUT_DIR, `${letter.slug}.docx`);
  writeFileSync(path, buf);
  console.log('OK', path);
}

const LETTERS = [
  {
    slug: '01-registre-institutionnel',
    title: 'Lettre de soutien — Registre institutionnel',
    subtitle: 'Collectivité / structure culturelle',
    lines: [
      '**Objet :** Lettre de soutien au projet Soundy',
      '',
      'Madame, Monsieur,',
      '',
      'Par la présente, j’exprime mon soutien au développement de **Soundy**, application dédiée à la visibilité des artistes et à la dynamisation de la vie musicale sur un territoire.',
      '',
      'En tant qu’artiste exerçant à [ville / région], je constate chaque jour la difficulté de **faire connaître un projet musical en dehors des circuits établis**. Les réseaux généralistes ne répondent pas aux besoins spécifiques de la scène : géolocalisation des publics, mise en relation avec les lieux, valorisation des lives et des sorties.',
      '',
      'Soundy propose une approche **centrée sur la musique et le terrain**, sans se substituer aux institutions culturelles, mais en complétant l’action des salles, des festivals et des médias locaux. Cette orientation correspond aux enjeux de **démocratisation de l’accès à la scène** que nous défendons.',
      '',
      'Je recommande l’examen favorable de ce projet et reste disponible pour tout complément d’information.',
      '',
      'Fait à [lieu], le [date]',
      '',
      '[Signature]',
      '[Nom, prénom]',
      '[Statut : artiste / auteur-compositeur-interprète / …]',
    ],
  },
  {
    slug: '02-registre-convivial',
    title: 'Lettre de soutien — Registre convivial',
    subtitle: 'Artiste à artiste',
    lines: [
      'Salut,',
      '',
      'Je voulais te (vous) écrire deux mots pour **Soundy** — l’app dont on parle pour rapprocher les artistes et le public sur une carte, avec les lives, les salons d’écoute et tout le reste.',
      '',
      'Moi, je suis [type d’artiste : chanteur·se, producteur·rice, groupe…] et franchement, **on passe trop de temps à poster partout sans jamais toucher les bonnes personnes près de chez nous**. Soundy, c’est l’idée qu’on arrête de crier dans le vide : tu vois qui écoute quoi, tu peux monter sur scène en live, tu peux te faire repérer sans avoir déjà 50 000 abonnés.',
      '',
      'Je **soutiens le projet** parce qu’il parle aux artistes comme moi — pas qu’aux gros noms. Si tu hésites encore, viens voir getsoundy.com ; tu comprendras vite.',
      '',
      'Bonne continuation à toute l’équipe,',
      '',
      '[Prénom Nom]',
      'Artiste · [ville]',
    ],
  },
  {
    slug: '03-registre-professionnel-anglais',
    title: 'Letter of support — Professional register',
    subtitle: 'Manager / booker / industry (English)',
    lines: [
      '**Re :** Letter of support — Soundy platform',
      '',
      'To whom it may concern,',
      '',
      'I am writing in my capacity as **[manager / booking agent / independent artist with self-managed career]** to endorse **Soundy**, a music-focused social platform designed to improve **discoverability, local audience building, and live promotion**.',
      '',
      'The current digital landscape forces artists to spread efforts across generic social networks that **do not optimize for music discovery or event attendance**. Soundy addresses a clear gap: **geo-aware visibility**, integrated live experiences, and community features aligned with how fans actually engage with music today.',
      '',
      'From a professional standpoint, tools that **reduce friction between creation, promotion, and live performance** directly support sustainable careers — especially for emerging and mid-level acts. I consider Soundy a relevant innovation in that space and **support its development and deployment**.',
      '',
      'Please feel free to contact me for further details.',
      '',
      'Sincerely,',
      '',
      '[Name]',
      '[Role] · [City, country]',
      '[Date]',
    ],
  },
  {
    slug: '04-registre-poetique',
    title: 'Lettre de soutien — Registre poétique',
    subtitle: 'Artistique',
    lines: [
      'Il y a des voix qui cherchent une place où retentir — pas un algorithme, **une présence**.',
      '',
      '**Soundy** m’apparaît comme cette place : une carte où la musique devient chemin, où un live n’est pas un fichier perdu dans un fil d’actualité, où l’on peut **se trouver** avant de remplir une salle. Je suis artiste ; je compose, j’interprète, je partage. Je sais que la beauté d’un morceau ne suffit pas : il faut **un témoin, un voisin, une salle, une nuit**.',
      '',
      'Je soutiens cette application parce qu’elle **honore le geste musical** — le salon d’écoute, la scène, le reel, la rencontre — sans réduire l’artiste à une statistique. Pour tout créateur qui cherche à **habiter le monde** avec sa musique, Soundy ouvre une porte de plus.',
      '',
      'Avec ma considération,',
      '',
      '[Signature]',
      '[Artiste]',
    ],
  },
  {
    slug: '05-registre-entrepreneurial',
    title: 'Lettre de soutien — Registre entrepreneurial',
    subtitle: 'Direct / pragmatique',
    lines: [
      '**Soutien à Soundy — une phrase :** les artistes ont besoin d’un outil **musique-first** pour être vus, bookés et écoutés ; Soundy le construit.',
      '',
      'Je suis **[artiste / DJ / producteur / groupe]** basé à **[ville]**. Mon constat est simple :',
      '',
      '1. **Instagram/TikTok** = portée, mais peu de conversion vers les dates et les fans locaux.',
      '2. **Spotify** = écoute, mais peu de lien humain et de scène.',
      '3. **Soundy** = carte + communauté + lives + contenus → **boucle complète** pour un indépendant.',
      '',
      'Je soutiens le projet parce qu’il vise un **marché réel** (millions d’artistes non signés) avec un produit déjà avancé (getsoundy.com). Ce n’est pas une idée sur papier : c’est une **infrastructure de promotion** dont j’ai besoin en tant qu’artiste.',
      '',
      '[Nom]',
      '[Contact optionnel]',
      '[Date]',
    ],
  },
  {
    slug: '06-registre-academique',
    title: 'Lettre de soutien — Registre académique',
    subtitle: 'Politique culturelle / filière musicale',
    lines: [
      '**Objet :** Soutien au projet numérique Soundy — enjeux de filière musicale',
      '',
      'Madame, Monsieur,',
      '',
      'La filière musicale contemporaine se caractérise par une **abondance de créations** et une **fragmentation des canaux de médiation**. Les artistes — qu’ils soient émergents ou confirmés sur le plan local — peinent à **articuler visibilité numérique et ancrage territorial**.',
      '',
      'Le projet **Soundy** s’inscrit dans une logique de **plateforme sectorielle** : fonctionnalités de géolocalisation, de diffusion live, de partage de contenus musicaux et de mise en relation entre publics et créateurs. Une telle approche répond à un **besoin documenté** de diversification des outils de promotion, en complément des dispositifs publics (DRAC, SACEM, collectivités) et des acteurs privés.',
      '',
      'En ma qualité d’**artiste et acteur de la filière**, j’appuie l’initiative Soundy et considère qu’elle contribue, à terme, à **renforcer l’employabilité artistique** et la visibilité des scènes de proximité.',
      '',
      'Respectueusement,',
      '',
      '[Nom, prénom]',
      '[Date] · [Ville]',
    ],
  },
  {
    slug: '07-registre-court-reseaux',
    title: 'Lettre de soutien — Registre court',
    subtitle: 'Réseaux sociaux (extensible)',
    lines: [
      '**Je soutiens Soundy.**',
      '',
      'Artiste [genre / ville], j’en ai marre des apps où ma musique noie dans le bruit. **Soundy = musique + carte + live + communauté.** C’est exactement ce qu’il manque pour **passer du studio à la scène** sans budget pub.',
      '',
      'getsoundy.com',
      '',
      '[Pseudo / nom] · [Date]',
      '',
      '—',
      '',
      '*(Version longue : ajouter un paragraphe sur votre parcours et un exemple concret — live, salon, date locale.)*',
    ],
  },
  {
    slug: '08-registre-emotionnel',
    title: 'Lettre de soutien — Registre émotionnel',
    subtitle: 'Communauté',
    lines: [
      'Chers membres du jury, chère équipe Soundy,',
      '',
      'Quand on fait de la musique, on ne demande pas la charité : on demande **une chance d’être entendu**. J’ai connu les messages sans réponse, les posts vus par trois personnes, les soirées où la salle reste vide malgré des mois de travail.',
      '',
      '**Soundy** me redonne de l’espoir — pas parce que c’est magique, mais parce que **tout est pensé pour nous**, les artistes de tous horizons. Peu importe que vous fassiez du rap, de la chanson, de l’électro ou du jazz : **vous avez une place sur la carte**, vous pouvez **montrer un live**, **rejoindre un salon**, **toucher des gens qui aiment déjà ce que vous aimez**.',
      '',
      'Je signe cette lettre avec conviction : **je soutiens Soundy** pour moi et pour tous ceux qui n’ont pas encore eu leur soirée.',
      '',
      'Avec gratitude,',
      '',
      '[Votre nom]',
      'Artiste',
    ],
  },
  {
    slug: '09-registre-associatif',
    title: 'Lettre de soutien — Registre associatif',
    subtitle: 'Président·e d’association / collectif',
    lines: [
      '**Objet :** Soutien de [Nom de l’association / collectif] au projet Soundy',
      '',
      'L’association **[nom]**, qui fédère des artistes et des acteurs culturels autour de **[musique live / scène locale / …]**, se prononce favorablement en faveur du projet **Soundy**.',
      '',
      'Nos adhérents — **artistes de genres et de niveaux variés** — partagent un besoin commun : **outils numériques adaptés à la promotion musicale** et à la mise en relation avec le public. Soundy répond à cette attente par une plateforme intégrant carte, contenus, lives et espaces d’échange, accessible via getsoundy.com.',
      '',
      'Nous considérons ce projet comme **compatible avec notre mission** de soutien à la création et à la diffusion. Nous apporterons notre **soutien moral** et, le cas échéant, notre **volonté de co-animation** (événements, tests, retours utilisateurs).',
      '',
      'Pour l’association,',
      '',
      '[Prénom Nom], [fonction]',
      '[Date] · [Ville]',
    ],
  },
  {
    slug: '10-registre-journalistique',
    title: 'Lettre de soutien — Registre journalistique',
    subtitle: 'Critique / regard sur la scène',
    lines: [
      '**Soundy mérite qu’on s’y arrête** — rarement une app française a aussi clairement choisi son camp : **la musique live et les artistes**, pas la viralité vide.',
      '',
      'En tant qu’**artiste et observateur de la scène**, je vois trois forces dans le projet :',
      '',
      '- **La géolocalisation intelligente**, qui réconcilie « être sur internet » et « exister dans une ville ».',
      '- **Les formats live et salon**, proches de l’usage réel des fans (écouter ensemble, réagir, suivre).',
      '- **Une promesse inclusive** : l’outil s’adresse à **n’importe quel profil artistique**, pas seulement aux influenceurs.',
      '',
      'Les défis restent ceux de toute jeune plateforme (adoption, modération, monétisation équitable), mais **la direction est la bonne**. Je soutiens Soundy et recommande aux décideurs de **l’accompagner** dans une phase où la scène indépendante a besoin d’alternatives crédibles aux géants généralistes.',
      '',
      '[Nom]',
      'Artiste · [ville] · [date]',
    ],
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const letter of LETTERS) {
  await writeLetter(letter);
}

console.log(`\n${LETTERS.length} fichiers .docx dans ${OUT_DIR}`);
