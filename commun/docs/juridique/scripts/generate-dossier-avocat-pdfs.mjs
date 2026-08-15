/**
 * Génère les PDF du dossier avocat (Edge headless) depuis _build-dossier-avocat/.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
} from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JURIDIQUE = join(__dirname, '..');
const REPO = join(JURIDIQUE, '..', '..', '..');
const BUILD = join(JURIDIQUE, '_build-dossier-avocat');
const PDF_OUT = join(JURIDIQUE, 'dossier-avocat-a-valider');
const CSS_PATH = join(JURIDIQUE, 'pdf-style.css');
const HTML_CACHE = join(BUILD, '_html-cache');

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const css = readFileSync(CSS_PATH, 'utf8');

const TODAY = new Date().toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

/** Libellés de catégorie par dossier (affichés dans le bandeau d'en-tête). */
const CATEGORY_LABELS = {
  '01-commercial-sponsors': 'Commercial · Sponsors',
  '02-documents-utilisateurs': 'Documents utilisateurs',
  '03-monetisation': 'Monétisation',
  '04-rgpd-entreprise': 'RGPD · Entreprise',
  '05-audit-et-preparation': 'Audit & préparation',
  '06-donnees-editeur': 'Données éditeur (LCEN)',
  '07-annexes-produit': 'Annexes produit',
};

/** @param {string} relDir */
function categoryLabelFor(relDir) {
  const top = relDir.split(/[\\/]/)[0] ?? '';
  return CATEGORY_LABELS[top] ?? 'Dossier avocat';
}

/** @param {string} dir */
function walkMarkdownFiles(dir, base = dir) {
  /** @type {{ mdPath: string, relDir: string, baseName: string }[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '_html-cache') continue;
      out.push(...walkMarkdownFiles(full, base));
    } else if (name.endsWith('.md')) {
      const rel = relative(base, full);
      const relDir = dirname(rel);
      const baseName = name.replace(/\.md$/i, '');
      out.push({
        mdPath: full,
        relDir: relDir === '.' ? '' : relDir,
        baseName,
      });
    }
  }
  return out;
}

/** @param {string} dir @param {string} [root] */
function removeNonPdfFiles(dir, root = dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      removeNonPdfFiles(full, root);
      if (full !== root && readdirSync(full).length === 0) {
        rmSync(full, { recursive: true });
      }
    } else if (!name.toLowerCase().endsWith('.pdf')) {
      unlinkSync(full);
    }
  }
}

/**
 * @param {string} mdContent
 * @param {string} title
 * @param {string} category
 */
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
    <span class="doc-header__brand">DOSSIER AVOCAT <span>· validation juridique</span></span>
    <span class="doc-header__category">${category}</span>
    <h1 class="doc-header__title" style="border:none;margin-top:10px;padding-bottom:0;">${title}</h1>
    <p class="doc-meta">Document interne — validation juridique requise avant diffusion ou signature · Généré le ${TODAY}</p>
  </header>
  <div class="doc-warning">
    <strong>⚠ Document indicatif.</strong> Contenu produit par l'équipe produit à titre préparatoire ; il ne constitue pas un avis juridique. Seules les versions publiées in-app après validation avocat et complétion des données éditeur font foi.
  </div>
  ${mdContent}
  <footer class="doc-footer">${category} · document interne — ${TODAY}</footer>
</body>
</html>`;
}

/**
 * @param {string} htmlPath
 * @param {string} pdfPath
 */
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
  if (result.error) {
    throw new Error(`Edge: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Edge exit ${result.status}: ${result.stderr || result.stdout}`);
  }
}

/**
 * Retire le premier titre `# ...` du Markdown (déjà affiché dans le bandeau
 * d'en-tête personnalisé) et le retourne avec le corps restant.
 * @param {string} md
 * @param {string} fallbackTitle
 */
function extractTitle(md, fallbackTitle) {
  const match = md.match(/^#\s+(.+?)\s*\n/);
  if (!match) return { title: fallbackTitle, body: md };
  return { title: match[1].trim(), body: md.slice(match[0].length) };
}

async function mdToPdf(mdPath, pdfPath, fallbackTitle, category) {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });
  const raw = readFileSync(mdPath, 'utf8');
  const { title, body: mdBody } = extractTitle(raw, fallbackTitle);
  const body = marked.parse(mdBody);
  const relHtml = relative(BUILD, mdPath).replace(/\.md$/i, '.html');
  const htmlPath = join(HTML_CACHE, relHtml);
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, wrapHtml(body, title, category), 'utf8');
  printPdf(htmlPath, pdfPath);
}

async function main() {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  rmSync(PDF_OUT, { recursive: true, force: true });
  mkdirSync(PDF_OUT, { recursive: true });

  const introDocs = [
    {
      md: join(JURIDIQUE, 'DOSSIER-AVOCAT-LISEZMOI.md'),
      pdf: join(PDF_OUT, '00-LISEZMOI-DOSSIER-AVOCAT.pdf'),
      title: 'Lisez-moi — Dossier avocat',
      category: 'Guide du dossier',
    },
    {
      md: join(JURIDIQUE, 'CHECKLIST-VALIDATION-AVOCAT.md'),
      pdf: join(PDF_OUT, '00-CHECKLIST-VALIDATION-AVOCAT.pdf'),
      title: 'Checklist validation avocat',
      category: 'Guide du dossier',
    },
  ];

  for (const doc of introDocs) {
    await mdToPdf(doc.md, doc.pdf, doc.title, doc.category);
    console.log('PDF', relative(REPO, doc.pdf));
  }

  const mdFiles = walkMarkdownFiles(BUILD);
  for (const { mdPath, relDir, baseName } of mdFiles) {
    const pdfRel = relDir ? join(relDir, `${baseName}.pdf`) : `${baseName}.pdf`;
    const pdfPath = join(PDF_OUT, pdfRel);
    await mdToPdf(mdPath, pdfPath, baseName, categoryLabelFor(relDir));
    console.log('PDF', relative(REPO, pdfPath));
  }

  console.log(`\n${mdFiles.length + introDocs.length} PDF dans dossier-avocat-a-valider/`);

  removeNonPdfFiles(PDF_OUT);
  console.log('Dossier nettoyé : PDF uniquement.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
