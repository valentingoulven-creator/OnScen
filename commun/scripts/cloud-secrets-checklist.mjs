/**
 * Affiche la checklist secrets Cloud Agents + état local (présent/absent, jamais la valeur).
 *
 * Usage:
 *   node commun/scripts/cloud-secrets-checklist.mjs
 *   npm run cloud:checklist
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TIERS = path.join(ROOT, '.cursor/cloud-secrets.tiers.json');
const MSENV = path.join(ROOT, 'commun/msdev/.env');
const VITEENV = path.join(ROOT, 'web/app/.env.development');

function loadEnvKeys(filePath) {
  const keys = new Map();
  if (!fs.existsSync(filePath)) return keys;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    keys.set(key, val.length > 0);
  }
  return keys;
}

function status(key, localKeys) {
  if (!localKeys.has(key)) return { icon: '○', label: 'absent local' };
  if (localKeys.get(key)) return { icon: '✓', label: 'prêt à copier' };
  return { icon: '△', label: 'clé sans valeur' };
}

const tiers = JSON.parse(fs.readFileSync(TIERS, 'utf8'));
const msdev = loadEnvKeys(MSENV);
const vite = loadEnvKeys(VITEENV);

console.log('');
console.log('══════════════════════════════════════════════════════════');
console.log('  Soundy — Checklist secrets Cursor Cloud Agents');
console.log('  Dashboard : https://cursor.com/dashboard/cloud-agents');
console.log('  Environnement : soundy-msdev');
console.log('══════════════════════════════════════════════════════════');
console.log('');

let totalOk = 0;
let totalNeed = 0;

for (const [tierId, tier] of Object.entries(tiers.tiers)) {
  console.log(`── ${tier.label}`);
  console.log('');
  for (const item of tier.keys) {
    const file = item.file?.includes('web') ? vite : msdev;
    const st = status(item.key, file);
    const type = item.type || tier.typeDefault || 'Environment Variable';
    const src = item.value?.startsWith('<') ? item.value : (item.value ? `défaut: ${item.value}` : '');
    if (st.icon === '✓') totalOk += 1;
    else totalNeed += 1;
    console.log(`  ${st.icon} ${item.key.padEnd(28)} [${type}]  ${st.label}`);
    if (item.note) console.log(`      → ${item.note}`);
    if (src) console.log(`      → ${src}`);
  }
  console.log('');
}

console.log('── Résumé');
console.log(`  Clés prêtes en local (copier dashboard) : ${totalOk}`);
console.log(`  Clés à compléter : ${totalNeed}`);
console.log('');
console.log('── Ordre recommandé dashboard');
console.log('  1. Coller tier P0 (boot) — redémarrer agent');
console.log('  2. P1 si tests salons YouTube');
console.log('  3. P2 DATABASE_URL si besoin données réalistes PG');
console.log('  4. P3/P4 selon feature testée');
console.log('');
console.log('── Cloud defaults (si absent du local)');
for (const [k, v] of Object.entries(tiers.cloudDefaults || {})) {
  console.log(`  ${k}=${v}`);
}
console.log('');
console.log('Ne jamais committer les valeurs. npm run cloud:sync après modif .env.example');
console.log('');
