/**
 * Matérialise commun/msdev/.env et web/app/.env.development
 * à partir des variables d'environnement injectées par le dashboard Cloud Agents.
 *
 * Usage (VM cloud, via cloud-install.sh) :
 *   node .cursor/cloud-materialize-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(__dirname, 'cloud-secrets.manifest.json');

function parseEnvExample(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const keys = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    keys.push(t.slice(0, eq).trim());
  }
  return keys;
}

function loadManifest() {
  if (fs.existsSync(MANIFEST)) {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  }
  return {
    files: {
      'commun/msdev/.env': parseEnvExample(path.join(ROOT, 'commun/msdev/.env.example')),
      'web/app/.env.development': parseEnvExample(path.join(ROOT, 'web/app/.env.development.example')),
    },
  };
}

function mergeEnvFile(relPath, keys) {
  const abs = path.join(ROOT, relPath);
  const examplePath = abs.includes('msdev')
    ? path.join(ROOT, 'commun/msdev/.env.example')
    : path.join(ROOT, 'web/app/.env.development.example');

  let base = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf8') : '';
  const lines = base.split('\n');
  const out = [];
  const written = new Set();

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = t.indexOf('=');
    if (eq <= 0) {
      out.push(line);
      continue;
    }
    const key = t.slice(0, eq).trim();
    if (process.env[key] !== undefined && process.env[key] !== '') {
      out.push(`${key}=${process.env[key]}`);
      written.add(key);
    } else {
      out.push(line);
    }
  }

  for (const key of keys) {
    if (written.has(key)) continue;
    if (process.env[key] !== undefined && process.env[key] !== '') {
      out.push(`${key}=${process.env[key]}`);
      written.add(key);
    }
  }

  const cloudDefaults = {
    WEB_APP_URL: 'http://localhost:5173',
    API_BASE_URL: 'http://localhost:4080/api',
    SOCKET_URL: 'http://localhost:4080',
    HOST: '0.0.0.0',
  };
  for (const [key, val] of Object.entries(cloudDefaults)) {
    if (!keys.includes(key) || written.has(key)) continue;
    const idx = out.findIndex((l) => l.trim().startsWith(`${key}=`));
    if (idx >= 0) {
      const cur = out[idx].split('=')[1]?.trim();
      if (!cur || cur.includes('localhost:4080') && key === 'WEB_APP_URL') {
        out[idx] = `${key}=${val}`;
      }
    }
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, out.join('\n').replace(/\n+$/, '\n'));
  return written.size;
}

const manifest = loadManifest();
let total = 0;
for (const [rel, keys] of Object.entries(manifest.files || {})) {
  total += mergeEnvFile(rel, keys);
}

console.log(`[cloud-materialize-env] ${total} clé(s) injectée(s) depuis l'environnement cloud`);
