/**
 * Exporte les LegalDocument (web/app/src/content/legal/*.ts) en Markdown
 * dans commun/docs/juridique/_build-dossier-avocat/ (intermédiaire → PDF).
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');
const LEGAL_SRC = join(REPO, 'web', 'app', 'src', 'content', 'legal');
const BUILD = join(REPO, 'commun', 'docs', 'juridique', '_build-dossier-avocat');
const OUT_USER = join(BUILD, '02-documents-utilisateurs');
const OUT_RGPD = join(BUILD, '04-rgpd-entreprise');

/** @param {string} raw */
function decodeJsString(raw) {
  if (raw == null) return '';
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * @param {string} content
 * @param {string} exportConst
 */
function parseLegalDocument(content, exportConst) {
  const marker = `export const ${exportConst}`;
  const start = content.indexOf(marker);
  if (start === -1) return null;

  const slice = content.slice(start);
  const titleMatch =
    slice.match(/title:\s*'((?:\\'|[^'])*)'/) ?? slice.match(/title:\s*"((?:\\"|[^"])*)"/);
  const updatedMatch =
    slice.match(/updated:\s*'((?:\\'|[^'])*)'/) ??
    slice.match(/updated:\s*"((?:\\"|[^"])*)"/);
  if (!titleMatch || !updatedMatch) return null;

  const title = decodeJsString(titleMatch[1]);
  const updated = decodeJsString(updatedMatch[1]);

  const sectionsStart = slice.indexOf('sections:');
  const sectionsSlice = sectionsStart >= 0 ? slice.slice(sectionsStart) : slice;

  /** @type {{ heading: string, body: string }[]} */
  const sections = [];

  const backtickRe =
    /heading:\s*'((?:\\'|[^'])*)'\s*,\s*body:\s*`([\s\S]*?)`\s*,/g;
  let m;
  while ((m = backtickRe.exec(sectionsSlice)) !== null) {
    sections.push({
      heading: decodeJsString(m[1]),
      body: decodeJsString(m[2]),
    });
  }

  if (sections.length === 0) {
    const singleQuoteRe =
      /heading:\s*'((?:\\'|[^'])*)'\s*,\s*body:\s*'((?:\\'|[^'])*)'/g;
    while ((m = singleQuoteRe.exec(sectionsSlice)) !== null) {
      sections.push({
        heading: decodeJsString(m[1]),
        body: decodeJsString(m[2]),
      });
    }
  }

  if (sections.length === 0) return null;
  return { title, updated, sections };
}

/**
 * @param {{ title: string, updated: string, sections: { heading: string, body: string }[] }} doc
 * @param {string} sourcePath
 */
function toMarkdown(doc, sourcePath) {
  const rel = relative(REPO, sourcePath).replace(/\\/g, '/');
  let md = `# ${doc.title}\n\n`;
  md += `> **Export pour revue avocat** — version app : *${doc.updated}*  \n`;
  md += `> Source dépôt : \`${rel}\`\n\n`;
  md += `---\n\n`;
  for (const s of doc.sections) {
    md += `## ${s.heading}\n\n${s.body.trim()}\n\n`;
  }
  return md;
}

const exports = [
  { file: 'mentions.ts', const: 'mentionsLegales', out: join(OUT_USER, 'mentions-legales.md') },
  { file: 'terms.ts', const: 'cgu', out: join(OUT_USER, 'cgu.md') },
  {
    file: 'privacy.ts',
    const: 'politiqueConfidentialite',
    out: join(OUT_USER, 'politique-confidentialite.md'),
  },
  { file: 'cookies.ts', const: 'politiqueCookies', out: join(OUT_USER, 'polite-cookies.md') },
  { file: 'cookies.ts', const: 'politiqueCookies', out: join(OUT_USER, 'politique-cookies.md') },
  { file: 'rgpd.ts', const: 'conformiteRgpd', out: join(OUT_USER, 'conformite-rgpd.md') },
  {
    file: 'apiPlatforms.ts',
    const: 'conditionsApiPlateformes',
    out: join(OUT_USER, 'conditions-api-plateformes.md'),
  },
  { file: 'licenses.ts', const: 'licences', out: join(OUT_USER, 'licences-contenus.md') },
  {
    file: 'creatorMonetization.ts',
    const: 'conditionsCreatorMonetization',
    out: join(OUT_USER, 'monetisation-createurs.md'),
  },
  {
    file: 'communityGuidelines.ts',
    const: 'reglesCommunaute',
    out: join(OUT_USER, 'regles-communaute.md'),
  },
  {
    file: 'brandedContent.ts',
    const: 'contenusSponsorisesPartenariats',
    out: join(OUT_USER, 'contenus-sponsorises-partenariats.md'),
  },
  {
    file: 'advertisingPolicy.ts',
    const: 'politiquePublicitaire',
    out: join(OUT_USER, 'politique-publicitaire.md'),
  },
  {
    file: 'moderationAppeals.ts',
    const: 'moderationEtRecours',
    out: join(OUT_USER, 'moderation-et-recours.md'),
  },
  {
    file: 'copyrightNotice.ts',
    const: 'politiqueDroitsAuteur',
    out: join(OUT_USER, 'politique-droits-auteur.md'),
  },
  {
    file: 'dpa.ts',
    const: 'dpaTemplate',
    out: join(OUT_RGPD, 'dpa-sous-traitants.md'),
  },
  {
    file: 'dpia.ts',
    const: 'dpiaTemplate',
    out: join(OUT_RGPD, 'aipd-dpia-geolocalisation.md'),
  },
];

// fix duplicate cookies entry - I made a typo polite-cookies - remove duplicate
const uniqueExports = exports.filter((e, i, arr) => {
  if (e.out.endsWith('polite-cookies.md')) return false;
  return arr.findIndex((x) => x.out === e.out) === i;
});

mkdirSync(OUT_USER, { recursive: true });
mkdirSync(OUT_RGPD, { recursive: true });

for (const { file, const: exportConst, out } of uniqueExports) {
  const path = join(LEGAL_SRC, file);
  const content = readFileSync(path, 'utf8');
  const doc = parseLegalDocument(content, exportConst);
  if (!doc) {
    console.error(`Échec parse: ${file} (${exportConst})`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(out, toMarkdown(doc, path), 'utf8');
  console.log('OK', out.replace(REPO, ''));
}

/** Copies statiques vers build intermédiaire */
const staticCopies = [
  [
    join(REPO, 'commun', 'docs', 'strategie', 'commercial', 'MODELE-DEVIS-SPONSOR.md'),
    join(BUILD, '01-commercial-sponsors', 'MODELE-DEVIS-SPONSOR.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'strategie', 'commercial', 'CONTRAT-TYPE-SPONSOR.md'),
    join(BUILD, '01-commercial-sponsors', 'CONTRAT-TYPE-SPONSOR.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'strategie', 'commercial', 'REPORTING-SPONSOR-TEMPLATE.md'),
    join(BUILD, '01-commercial-sponsors', 'REPORTING-SPONSOR-TEMPLATE.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'juridique', 'MENTIONS-LEGALES-DONS.md'),
    join(BUILD, '03-monetisation', 'MENTIONS-LEGALES-DONS.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'juridique', 'COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md'),
    join(BUILD, '05-audit-et-preparation', 'COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'juridique', 'RENDEZ-VOUS-AVOCAT.md'),
    join(BUILD, '05-audit-et-preparation', 'RENDEZ-VOUS-AVOCAT.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'reports', 'LEGAL_REPORT.md'),
    join(BUILD, '05-audit-et-preparation', 'LEGAL_REPORT.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'juridique', 'TODO-MANUAL-extrait-business-legal.md'),
    join(BUILD, '05-audit-et-preparation', 'TODO-MANUAL-extrait-business-legal.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'strategie', 'ONE-PAGER-SPONSOR-COMMERCIAL.md'),
    join(BUILD, '07-annexes-produit', 'ONE-PAGER-SPONSOR-COMMERCIAL.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'strategie', 'commercial', 'JUSTIFICATION-TARIFS-SPONSOR-SOUNDY.md'),
    join(BUILD, '07-annexes-produit', 'JUSTIFICATION-TARIFS-SPONSOR-SOUNDY.md'),
  ],
  [
    join(REPO, 'commun', 'docs', 'strategie', 'commercial', 'JUSTIFICATION-TARIFS-SPONSOR-SYNTHESE-BIC.md'),
    join(BUILD, '07-annexes-produit', 'JUSTIFICATION-TARIFS-SPONSOR-SYNTHESE-BIC.md'),
  ],
];

for (const [src, dest] of staticCopies) {
  if (!existsSync(src)) {
    console.warn('Absent:', src);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('COPY', dest.replace(REPO, ''));
}

/** JSON éditeur → markdown build */
const jsonSources = [
  [join(REPO, 'commun', 'deploy', 'legal-publisher.template.json'), 'legal-publisher.template'],
  [join(REPO, 'commun', 'msdev', 'legal-publisher.example.json'), 'legal-publisher.example'],
];
const outEditor = join(BUILD, '06-donnees-editeur');
mkdirSync(outEditor, { recursive: true });
for (const [jsonPath, baseName] of jsonSources) {
  if (!existsSync(jsonPath)) continue;
  const json = readFileSync(jsonPath, 'utf8');
  const md = `# Données éditeur LCEN — ${baseName}\n\n\`\`\`json\n${json.trim()}\n\`\`\`\n`;
  writeFileSync(join(outEditor, `${baseName}.md`), md, 'utf8');
  console.log('JSON→MD', `${baseName}.md`);
}

console.log('\nExport build dossier avocat terminé.');
