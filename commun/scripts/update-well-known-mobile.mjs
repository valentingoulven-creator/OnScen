#!/usr/bin/env node
/**
 * Met à jour assetlinks.json et apple-app-site-association avec les empreintes réelles.
 *
 * Variables (mobile-store.env ou env) :
 *   ANDROID_RELEASE_SHA256  — empreinte release (AA:BB:…)
 *   APPLE_TEAM_ID           — Team ID Apple Developer
 *
 * Usage :
 *   node commun/scripts/update-well-known-mobile.mjs
 *   node commun/scripts/update-well-known-mobile.mjs --from-keystore
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, 'android/config/mobile-store.env');

function loadEnvFile() {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function sha256FromKeystore() {
  const propsPath = path.join(root, 'ios/apptel/android/keystore.properties');
  if (!fs.existsSync(propsPath)) {
    console.error('keystore.properties introuvable — copier keystore.properties.example');
    process.exit(1);
  }
  const props = Object.fromEntries(
    fs
      .readFileSync(propsPath, 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const [k, ...rest] = l.split('=');
        return [k.trim(), rest.join('=').trim()];
      })
  );
  const storeFile = path.resolve(path.dirname(propsPath), props.storeFile);
  const keytool = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
    : 'keytool';
  const r = spawnSync(
    keytool,
    ['-list', '-v', '-keystore', storeFile, '-alias', props.keyAlias, '-storepass', props.storePassword],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  const m = r.stdout.match(/SHA-?256:\s*([0-9A-Fa-f:]+)/i) || r.stdout.match(/SHA 256:\s*([0-9A-Fa-f:]+)/i);
  if (!m) {
    console.error('SHA256 introuvable dans keytool output');
    process.exit(1);
  }
  return m[1].toUpperCase();
}

function writeJson(relPath, data) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('Updated', relPath);
}

function main() {
  loadEnvFile();

  if (process.argv.includes('--from-keystore')) {
    process.env.ANDROID_RELEASE_SHA256 = sha256FromKeystore();
    console.log('ANDROID_RELEASE_SHA256 =', process.env.ANDROID_RELEASE_SHA256);
  }

  const sha256 = process.env.ANDROID_RELEASE_SHA256;
  const teamId = process.env.APPLE_TEAM_ID?.trim();

  if (!sha256) {
    console.error('ANDROID_RELEASE_SHA256 manquant (mobile-store.env ou --from-keystore)');
    process.exit(1);
  }

  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.soundy.app',
        sha256_cert_fingerprints: [sha256],
      },
    },
  ];

  writeJson('web/app/public/.well-known/assetlinks.json', assetlinks);
  writeJson('commun/backend/public/.well-known/assetlinks.json', assetlinks);

  if (teamId) {
    const aasa = {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.com.soundy.app`,
            paths: ['/salon/*', '/live/*', '/profile/*', '/'],
          },
        ],
      },
      webcredentials: {
        apps: [`${teamId}.com.soundy.app`],
      },
    };
    writeJson('web/app/public/.well-known/apple-app-site-association', aasa);
    writeJson('commun/backend/public/.well-known/apple-app-site-association', aasa);
  } else {
    console.warn('APPLE_TEAM_ID absent — AASA non mis à jour');
  }
}

main();
