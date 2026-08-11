#!/usr/bin/env node
/**
 * Outil « mobile only » — overrides ios/apptel sans toucher web/app.
 *
 * Usage:
 *   npm run mobile:override -- create pages/HomePage.tsx
 *   npm run mobile:override -- list
 *   npm run mobile:override -- status
 *   npm run mobile:override -- check [--staged]
 *   npm run mobile:override -- help
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, relative, normalize } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const APP_SRC = join(ROOT, 'web/app/src');
const TEL_SRC = join(ROOT, 'ios/apptel/src');

const C = {
  r: '\x1b[0m',
  g: '\x1b[32m',
  y: '\x1b[33m',
  c: '\x1b[36m',
  d: '\x1b[90m',
  e: '\x1b[31m',
  b: '\x1b[1m',
};

function normRel(input) {
  let rel = normalize(input.replace(/\\/g, '/')).replace(/^(\.\/|\/)+/, '');
  if (rel.startsWith('web/app/src/')) rel = rel.slice('web/app/src/'.length);
  if (rel.startsWith('ios/apptel/src/')) rel = rel.slice('ios/apptel/src/'.length);
  return rel;
}

function* walkDir(dir, base = '') {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${name.name}` : name.name;
    const full = join(dir, name.name);
    if (name.isDirectory()) yield* walkDir(full, rel);
    else yield { rel, full };
  }
}

function banner(rel, ext) {
  const line = ` * Fichier override mobile — ios/apptel/src/${rel}`;
  const cmd = ` * Créé via: npm run mobile:override -- create ${rel}`;
  const warn = ` * Ne pas modifier web/app/src/${rel} pour ce comportement mobile-only.`;
  if (ext === '.css') {
    return `/*\n${line}\n${cmd}\n${warn}\n */\n\n`;
  }
  return `/**\n${line}\n${cmd}\n${warn}\n */\n\n`;
}

function createOverride(relRaw) {
  const rel = normRel(relRaw);
  if (!rel || rel.includes('..')) {
    console.error(`${C.e}Chemin invalide:${C.r} ${relRaw}`);
    process.exit(1);
  }

  const appPath = join(APP_SRC, rel);
  const telPath = join(TEL_SRC, rel);

  if (existsSync(telPath)) {
    console.log(`${C.y}Override déjà présent:${C.r} ios/apptel/src/${rel}`);
    console.log(`${C.d}Édite ce fichier pour le mobile uniquement.${C.r}`);
    return;
  }

  if (!existsSync(appPath)) {
    console.error(`${C.e}Fichier web introuvable:${C.r} web/app/src/${rel}`);
    console.log(`${C.d}Crée d'abord le fichier dans web/app ou choisis un chemin relatif existant.${C.r}`);
    process.exit(1);
  }

  const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.')) : '';
  const src = readFileSync(appPath, 'utf8');
  const content = src.startsWith('/**') || src.startsWith('/*') ? src : banner(rel, ext) + src;

  mkdirSync(dirname(telPath), { recursive: true });
  writeFileSync(telPath, content, 'utf8');

  console.log(`${C.g}✓ Override créé${C.r} → ios/apptel/src/${rel}`);
  console.log(`${C.c}Prochaines étapes:${C.r}`);
  console.log(`  1. Modifier ios/apptel/src/${rel} (mobile only)`);
  console.log(`  2. Tester : npm run mobile:dev  → http://localhost:4082/tel/`);
  console.log(`  3. web/app/src/${rel} reste inchangé pour le site web`);
}

function listOverrides() {
  console.log(`\n${C.b}${C.c}Overrides mobile (ios/apptel/src/)${C.r}\n`);
  const files = [...walkDir(TEL_SRC)].sort((a, b) => a.rel.localeCompare(b.rel));
  if (files.length === 0) {
    console.log(`${C.d}(aucun fichier)${C.r}\n`);
    return;
  }
  for (const { rel } of files) {
    const inWeb = existsSync(join(APP_SRC, rel));
    const tag = inWeb ? `${C.y}[override]${C.r}` : `${C.c}[tel-only]${C.r}`;
    console.log(`  ${tag} ${rel}`);
  }
  console.log(`\n${C.d}${files.length} fichier(s) — le reste est hérité de web/app/src/${C.r}\n`);
}

function runStatus() {
  execSync('node commun/scripts/sync-src.js --status', { cwd: ROOT, stdio: 'inherit' });
}

function gitChangedFiles(staged) {
  const cmd = staged ? 'git diff --cached --name-only' : 'git diff --name-only HEAD';
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
    return out ? out.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function checkScope(staged) {
  const files = gitChangedFiles(staged);
  if (files.length === 0) {
    console.log(`${C.g}✓ Aucun changement git à vérifier.${C.r}`);
    return;
  }

  const allowedPrefixes = [
    'ios/apptel/',
    'android/',
    'Smartphone/',
    'commun/scripts/mobile-override.mjs',
    'commun/scripts/sync-src.js',
    '.cursor/rules/onscen-mobile-only.mdc',
    'modification.txt',
    'commun/docs/',
  ];

  const forbidden = [];
  const ok = [];

  for (const f of files) {
    const norm = f.replace(/\\/g, '/');
    if (norm.startsWith('web/app/')) {
      forbidden.push(norm);
      continue;
    }
    if (allowedPrefixes.some((p) => norm.startsWith(p) || norm === p)) {
      ok.push(norm);
      continue;
    }
    if (norm.startsWith('commun/backend/') || norm.startsWith('package.json')) {
      forbidden.push(norm);
      continue;
    }
    ok.push(norm);
  }

  console.log(`\n${C.b}Mobile-only check${staged ? ' (staged)' : ''}${C.r}\n`);
  if (ok.length) {
    console.log(`${C.g}OK (${ok.length}):${C.r}`);
    for (const f of ok) console.log(`  ${C.g}✓${C.r} ${f}`);
  }
  if (forbidden.length) {
    console.log(`\n${C.e}Hors périmètre mobile (${forbidden.length}):${C.r}`);
    for (const f of forbidden) console.log(`  ${C.e}✗${C.r} ${f}`);
    console.log(`\n${C.y}Session mobile-only : ne pas modifier web/app/.${C.r}`);
    console.log(`${C.d}Utilise ios/apptel/src/ ou npm run mobile:override -- create <chemin>${C.r}\n`);
    process.exit(1);
  }
  console.log(`\n${C.g}✓ Périmètre mobile respecté.${C.r}\n`);
}

function printHelp() {
  console.log(`
${C.b}${C.c}OnScen — mobile only (ios/apptel)${C.r}

${C.b}Commandes${C.r}
  npm run mobile:override -- create <chemin>   Copie web/app → ios/apptel override
  npm run mobile:override -- list              Liste les fichiers ios/apptel/src/
  npm run mobile:override -- status            Détail overrides vs web (sync-src)
  npm run mobile:override -- check             Vérifie que git ne touche pas web/app
  npm run mobile:override -- check --staged    Idem sur fichiers indexés

${C.b}Dev / build mobile${C.r}
  npm run mobile:dev                           Vite apptel → :4082/tel/
  npm run mobile:build                         Build PWA → backend/public/tel/
  npm run capacitor:build                      Build natif Capacitor

${C.b}Cursor (agent)${C.r}
  Mentionne ${C.c}@mobile-only${C.r} dans le chat pour limiter les edits à ios/apptel/.

${C.b}Exemple${C.r}
  npm run mobile:override -- create components/MapEventSearchBar.tsx
  npm run mobile:dev
`);
}

const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';

switch (cmd) {
  case 'create':
  case 'add':
    if (!args[1]) {
      console.error(`${C.e}Usage:${C.r} npm run mobile:override -- create <chemin>`);
      process.exit(1);
    }
    createOverride(args[1]);
    break;
  case 'list':
    listOverrides();
    break;
  case 'status':
    runStatus();
    break;
  case 'check':
    checkScope(args.includes('--staged'));
    break;
  case 'help':
  default:
    printHelp();
    break;
}
