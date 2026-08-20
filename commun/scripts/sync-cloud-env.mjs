/**
 * Sync local → config Cloud Agents (manifest secrets + empreinte deps).
 *
 * Usage:
 *   node commun/scripts/sync-cloud-env.mjs
 *   node commun/scripts/sync-cloud-env.mjs --if-changed
 *   npm run cloud:sync
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CURSOR = path.join(ROOT, '.cursor');
const MANIFEST = path.join(CURSOR, 'cloud-secrets.manifest.json');
const STATE = path.join(CURSOR, 'cloud-sync.state.json');
const ENV_JSON = path.join(CURSOR, 'environment.json');

const WATCH_PATHS = [
  'web/app/package-lock.json',
  'commun/backend/package-lock.json',
  'ios/apptel/package-lock.json',
  'commun/msdev/.env.example',
  'web/app/.env.development.example',
  '.cursor/environment.json',
  '.cursor/cloud-install.sh',
  '.cursor/cloud-materialize-env.mjs',
];

function sha256File(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

function fingerprint() {
  const parts = {};
  for (const rel of WATCH_PATHS) {
    parts[rel] = sha256File(rel);
  }
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function parseEnvExample(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const keys = [];
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    keys.push({
      key,
      sensitive: /SECRET|PASSWORD|TOKEN|KEY|PRIVATE|DATABASE_URL|STRIPE|LIVEKIT|SIGHTENGINE|OVH|VAPID|REDIS/i.test(key),
    });
  }
  return keys;
}

function buildManifest() {
  const msdev = parseEnvExample('commun/msdev/.env.example');
  const vite = parseEnvExample('web/app/.env.development.example');
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    dashboardUrl: 'https://cursor.com/dashboard/cloud-agents',
    environmentName: 'soundy-msdev',
    files: {
      'commun/msdev/.env': [...new Set(msdev.map((k) => k.key))],
      'web/app/.env.development': [...new Set(vite.map((k) => k.key))],
    },
    secrets: [...msdev, ...vite].filter((v, i, a) => a.findIndex((x) => x.key === v.key) === i),
    notes: [
      'Ne jamais committer les valeurs — dashboard Cloud Agents → Secrets.',
      'Runtime Secret pour clés API ; Environment Variable pour flags non sensibles.',
      'Après ajout de clés dans .env.example, relancer npm run cloud:sync puis mettre à jour le dashboard.',
    ],
  };
}

function readLocalEnvKeys(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return new Set();
  const keys = new Set();
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) keys.add(t.slice(0, eq).trim());
  }
  return keys;
}

const ifChanged = process.argv.includes('--if-changed');
const fp = fingerprint();

if (ifChanged && fs.existsSync(STATE)) {
  try {
    const prev = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    if (prev.fingerprint === fp) {
      process.exit(0);
    }
  } catch {
    /* regenerate */
  }
}

const manifest = buildManifest();
fs.mkdirSync(CURSOR, { recursive: true });
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

fs.writeFileSync(
  STATE,
  JSON.stringify({ fingerprint: fp, syncedAt: manifest.updatedAt, environmentJson: ENV_JSON }, null, 2),
);

const localMsdev = readLocalEnvKeys('commun/msdev/.env');
const requiredSensitive = manifest.secrets.filter((s) => s.sensitive).map((s) => s.key);
const presentLocally = requiredSensitive.filter((k) => localMsdev.has(k));

console.log('✅ Cloud env sync OK');
console.log(`   Manifest : .cursor/cloud-secrets.manifest.json (${manifest.secrets.length} clés)`);
console.log(`   Empreinte  : ${fp.slice(0, 12)}… (${manifest.updatedAt})`);
console.log(`   Dashboard : ${manifest.dashboardUrl} → Secrets · environnement « ${manifest.environmentName} »`);
if (presentLocally.length) {
  console.log(`   Clés sensibles présentes en local (${presentLocally.length}) — à recopier manuellement dans le dashboard si nouvelles.`);
} else if (fs.existsSync(path.join(ROOT, 'commun/msdev/.env'))) {
  console.log('   commun/msdev/.env local trouvé — vérifiez que le dashboard contient les mêmes clés sensitives.');
} else {
  console.log('   commun/msdev/.env absent en local — utilisez .env.example comme référence pour le dashboard.');
}
