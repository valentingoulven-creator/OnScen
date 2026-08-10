#!/usr/bin/env node
/**
 * Phase 2 rebranding: infra identifiers + docs vivants + strategie (OnScen -> OnScen).
 * Protects getsoundy.com, staging.getsoundy.com, demo Gmail, modification.txt body.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'android',
  'dist',
  'build',
  '.gradle',
]);

const SKIP_PATH_PARTS = [
  `${path.sep}commun${path.sep}docs${path.sep}audit${path.sep}`,
  `${path.sep}commun${path.sep}docs${path.sep}dev-agent${path.sep}rapports${path.sep}`,
  `${path.sep}commun${path.sep}backend${path.sep}public${path.sep}assets${path.sep}`,
];

const SKIP_FILES = new Set([
  'modification.txt',
  'package-lock.json',
  'lint-report2.json',
]);

const TEXT_EXT = new Set([
  '.md', '.mdc', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css',
  '.ps1', '.sh', '.yml', '.yaml', '.sql', '.txt', '.ini', '.example', '.env',
  '.canvas.tsx', '.py', '.bat', '.caddy', '.xml', '.webmanifest', '.plist',
  '.pbxproj', '.entitlements', '.gradle', '.properties', '.toml', '.svg',
]);

const PROTECT = [
  ['getsoundy.com', 'getsoundy.com'],
  ['staging.getsoundy.com', 'staging.getsoundy.com'],
  ['yt.audit.demo2.soundy@gmail.com', 'yt.audit.demo2.soundy@gmail.com'],
];

function shouldSkip(absPath) {
  const rel = path.relative(ROOT, absPath);
  const base = path.basename(absPath);
  if (SKIP_FILES.has(base)) return true;
  if (base.endsWith('.pdf') || base.endsWith('.pptx') || base.endsWith('.png') || base.endsWith('.jpg')) {
    return true;
  }
  for (const part of SKIP_PATH_PARTS) {
    if (rel.includes(part.replaceAll('/', path.sep))) return true;
  }
  return false;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function applyReplacements(text) {
  let s = text;
  for (const [ph, val] of PROTECT) {
    s = s.split(val).join(ph);
  }

  const pairs = [
    ['onscen-backend-staging', 'onscen-backend-staging'],
    ['onscen-backend', 'onscen-backend'],
    ['onscen_staging', 'onscen_staging'],
    ['onscen-prod', 'onscen-prod'],
    ['onscen-staging', 'onscen-staging'],
    ['onscen-db', 'onscen-db'],
    ['onscen-backups', 'onscen-backups'],
    ['onscen_restore_test', 'onscen_restore_test'],
    ['/opt/onscen', '/opt/onscen'],
    ['/opt/onscen', '/opt/onscen'],
    ['Get-OnScenDeployEnvironment', 'Get-OnScenDeployEnvironment'],
    ['ONSCEN_ROOT', 'ONSCEN_ROOT'],
    ['lib/onscen-root.sh', 'lib/onscen-root.sh'],
    ['onscen-root.sh', 'onscen-root.sh'],
    ['seed_onscen_server.js', 'seed_onscen_server.js'],
    ['seed_onscen_server', 'seed_onscen_server'],
    ['seed_onscen.py', 'seed_onscen.py'],
    ['process-onscen-logo.mjs', 'process-onscen-logo.mjs'],
    ['onscen-logo.png', 'onscen-logo.png'],
    ['INFRA-ONSCEN.md', 'INFRA-ONSCEN.md'],
    ['ONSCEN-DEV-AGENT.md', 'ONSCEN-DEV-AGENT.md'],
    ['ONSCEN-CTO-PROMPT.md', 'ONSCEN-CTO-PROMPT.md'],
    ['ONSCEN-CEO-IA-PROMPT.md', 'ONSCEN-CEO-IA-PROMPT.md'],
    ['OnScen-CEO-IA.code-workspace', 'OnScen-CEO-IA.code-workspace'],
    ['onscen-dev-agent.mdc', 'onscen-dev-agent.mdc'],
    ['onscen-cto.mdc', 'onscen-cto.mdc'],
    ['onscen-ceo-ia.mdc', 'onscen-ceo-ia.mdc'],
    ['@onscen-dev-agent', '@onscen-dev-agent'],
    ['@onscen-cto', '@onscen-cto'],
    ['@onscen-ceo-ia', '@onscen-ceo-ia'],
    ['build_onscen_presentation.py', 'build_onscen_presentation.py'],
    ['OnScen-Pitch-Deck.md', 'OnScen-Pitch-Deck.md'],
    ['OnScenGlobeCanvas.tsx', 'OnScenGlobeCanvas.tsx'],
    ['OnScenGlobeScene.tsx', 'OnScenGlobeScene.tsx'],
    ['OnScenGlobe', 'OnScenGlobe'],
    ['OnScen', 'OnScen'],
    ['OnScen', 'OnScen'],
    ['OnScenUltra', 'OnScenUltra'],
    ['OnScen+', 'OnScen+'],
    ['OnScen', 'OnScen'],
    ['ONSCEN-', 'ONSCEN-'],
  ];

  for (const [from, to] of pairs) {
    s = s.split(from).join(to);
  }

  // DB role name (avoid touching protected placeholders)
  s = s.replace(/\brole soundy\b/gi, 'role onscen');
  s = s.replace(/\bROLE soundy\b/g, 'ROLE onscen');
  s = s.replace(/`onscen`/g, '`onscen`');
  s = s.replace(/user=onscen\b/g, 'user=onscen');
  s = s.replace(/USER onscen\b/g, 'USER onscen');

  for (const [ph, val] of PROTECT) {
    s = s.split(ph).join(val);
  }
  return s;
}

const files = walk(ROOT).filter((f) => {
  if (shouldSkip(f)) return false;
  const ext = path.extname(f);
  if (!TEXT_EXT.has(ext) && !f.endsWith('Caddyfile') && !f.endsWith('.well-known')) return false;
  return true;
});

let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  const after = applyReplacements(before);
  if (after !== before) {
    fs.writeFileSync(f, after, 'utf8');
    changed += 1;
  }
}

console.log(`rebrand-onscen-phase2: updated ${changed} files`);
