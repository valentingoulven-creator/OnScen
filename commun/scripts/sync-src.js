#!/usr/bin/env node
/**
 * commun/scripts/sync-src.js
 * ===================
 * Outil de diagnostic et de gestion de la synchronisation app/src ↔ ios/apptel/src.
 *
 * ARCHITECTURE
 * ------------
 * • app/src/    = SOURCE DE VÉRITÉ (webapp + logique partagée) — apptel en
 *   hérite intégralement (pages, composants, CSS, types) via le plugin Vite.
 * • ios/apptel/src/ = OVERRIDES MINIMES, uniquement pour du code réellement
 *   natif (Capacitor : push, deep links, stockage sécurisé, socket, boot).
 *   Aucune page/composant n'est plus dupliqué ici — parité totale avec le
 *   web (cf. plan « Parité totale app mobile / web », 2026-08-11).
 *
 * Le plugin Vite `apptelSrcFallback` dans ios/apptel/vite.config.ts charge
 * automatiquement depuis app/src/ tout fichier absent de ios/apptel/src/.
 * Le tsconfig rootDirs fait de même pour TypeScript.
 * → Aucune copie manuelle n'est nécessaire au quotidien.
 *
 * USAGE
 * -----
 *   node commun/scripts/sync-src.js              # Alias pour --status
 *   node commun/scripts/sync-src.js --status     # Afficher l'état des deux src/
 *   node commun/scripts/sync-src.js --check      # Vérifier qu'il n'y a pas de doublons
 *   node commun/scripts/sync-src.js --clean      # Supprimer les doublons identiques
 *   node commun/scripts/sync-src.js --clean --dry-run  # Voir ce qui serait supprimé
 *
 * FICHIERS PROTÉGÉS
 * -----------------
 * Ces fichiers ont une version intentionnellement différente dans ios/apptel/src/.
 * Ils ne sont jamais supprimés par --clean.
 * Pour en ajouter un, l'ajouter à la liste PROTECTED ci-dessous.
 */

'use strict';

const { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmdirSync, unlinkSync } = require('fs');
const { join, dirname } = require('path');
const { createHash } = require('crypto');

const ROOT    = join(__dirname, '../..');
const APP_SRC = join(ROOT, 'web', 'app', 'src');
const TEL_SRC = join(ROOT, 'ios', 'apptel', 'src');

/**
 * Fichiers spécifiques à apptel — présents dans ios/apptel/src/ intentionnellement.
 * Ces fichiers ne sont JAMAIS supprimés par --clean.
 *
 * [ENTRY]      main.tsx — bootstrap natif (Sentry, permissions, deep links, SW)
 * [LIB-DIFF]   lib/*.ts qui ont une version web équivalente mais un comportement
 *              natif différent (URL socket, stockage sécurisé, endpoints API)
 * [NATIVE-ONLY] fichiers Capacitor sans équivalent web (pas de duplication
 *              possible — présents uniquement côté apptel)
 *
 * Toutes les pages, composants, le CSS et les types sont désormais 100%
 * partagés depuis app/src/ (aucun override) — voir plan « Parité totale
 * app mobile / web » (2026-08-11).
 */
const PROTECTED = new Set([
  // [ENTRY]
  'main.tsx',
  'vite-env.d.ts',
  // [LIB-DIFF]
  'lib/api.ts',
  'lib/api/core.ts',
  'lib/authStorage.ts',
  'lib/socket.ts',
  'lib/nativeServer.ts',
  'lib/platformShell.ts',
  // [NATIVE-ONLY]
  'lib/nativeBoot.ts',
  'lib/nativeDeepLink.ts',
  'lib/nativeOfflineDetection.ts',
  'lib/sentryNative.ts',
  'hooks/useNativePushRegistration.ts',
  'hooks/useAndroidBackButton.ts',
]);

// ── couleurs ─────────────────────────────────────────────────────────────────

const R = '\x1b[0m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const D = '\x1b[90m';
const E = '\x1b[31m';

// ── helpers ──────────────────────────────────────────────────────────────────

function md5(p) {
  return createHash('md5').update(readFileSync(p)).digest('hex');
}

function* walkDir(dir, base) {
  base = base || '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel  = base ? base + '/' + e.name : e.name;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walkDir(full, rel);
    else yield { rel, full };
  }
}

function removeEmptyDirs(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const sub = join(dir, e.name);
      removeEmptyDirs(sub);
      if (readdirSync(sub).length === 0) rmdirSync(sub);
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAN   = args.includes('--clean');
const CHECK   = args.includes('--check');

if (CLEAN) {
  runClean();
} else if (CHECK) {
  runCheck();
} else {
  runStatus();
}

// ── status ───────────────────────────────────────────────────────────────────

function runStatus() {
  console.log('\n📊  ' + C + 'Statut ios/apptel/src vs app/src' + R + '\n');

  const appFiles = new Map();
  for (const f of walkDir(APP_SRC)) appFiles.set(f.rel, f.full);
  const telFiles = new Map();
  for (const f of walkDir(TEL_SRC)) telFiles.set(f.rel, f.full);

  let overrides = 0, sharedCount = 0, duplicates = 0;

  console.log(C + '── Overrides téléphone (ios/apptel/src a sa propre version) ──' + R);
  for (const [rel, telFull] of telFiles) {
    if (!PROTECTED.has(rel)) continue;
    if (appFiles.has(rel)) {
      const diff = md5(telFull) !== md5(appFiles.get(rel));
      const tag  = diff ? Y + '[différent]' + R : D + '[identique]' + R;
      console.log('  ' + tag + ' ' + rel);
    } else {
      console.log('  ' + C + '[tel-only] ' + R + ' ' + rel);
    }
    overrides++;
  }

  // Check for unexpected duplicates
  let dupList = [];
  for (const [rel, telFull] of telFiles) {
    if (PROTECTED.has(rel)) continue;
    if (appFiles.has(rel)) {
      const same = md5(telFull) === md5(appFiles.get(rel));
      dupList.push({ rel, same });
      duplicates++;
    }
  }
  if (dupList.length > 0) {
    console.log('\n' + E + '── ⚠ Doublons détectés dans ios/apptel/src (inutiles) ──' + R);
    for (const { rel, same } of dupList) {
      const tag = same ? D + '[identique]' : Y + '[différent]';
      console.log('  ' + tag + R + ' ' + rel + '  → npm run src:status --clean pour nettoyer');
    }
  }

  console.log('\n' + G + '── Fichiers partagés via plugin Vite (dans app/src seulement) ──' + R);
  for (const [rel] of appFiles) {
    if (!telFiles.has(rel)) {
      const tag = PROTECTED.has(rel) ? D + '[web-only]' + R : G + '[partagé] ' + R;
      console.log('  ' + tag + ' ' + rel);
      sharedCount++;
    }
  }

  console.log('\n' + R + 'Résumé :');
  console.log('  ' + overrides + ' overrides téléphone dans ios/apptel/src/');
  console.log('  ' + sharedCount + ' fichiers partagés via plugin Vite depuis app/src/');
  if (duplicates > 0) {
    console.log('  ' + E + duplicates + ' doublons' + R + ' (lancer: npm run src:status --clean)');
  } else {
    console.log('  ' + G + '0 doublons — architecture propre ✓' + R);
  }
  console.log('');
}

// ── check ─────────────────────────────────────────────────────────────────────

function runCheck() {
  const appFiles = new Map();
  for (const f of walkDir(APP_SRC)) appFiles.set(f.rel, f.full);
  const telFiles = new Map();
  for (const f of walkDir(TEL_SRC)) telFiles.set(f.rel, f.full);

  let issues = 0;
  for (const [rel, telFull] of telFiles) {
    if (PROTECTED.has(rel)) continue;
    if (appFiles.has(rel)) {
      issues++;
      const same = md5(telFull) === md5(appFiles.get(rel));
      const tag  = same ? D + '[doublon identique]' : Y + '[doublon différent!]';
      console.log(tag + R + ' ' + rel);
    }
  }

  if (issues === 0) {
    console.log(G + '✓ Aucun doublon — architecture propre.' + R);
    process.exit(0);
  } else {
    console.log('\n' + E + issues + ' doublon(s) détecté(s). Lancer: node commun/scripts/sync-src.js --clean' + R);
    process.exit(1);
  }
}

// ── clean ─────────────────────────────────────────────────────────────────────

function runClean() {
  const mode = DRY_RUN ? Y + '[DRY-RUN]' + R + ' ' : '';
  console.log('\n🧹  ' + mode + 'Nettoyage des doublons dans ios/apptel/src/\n');

  const appFiles = new Map();
  for (const f of walkDir(APP_SRC)) appFiles.set(f.rel, f.full);
  const telFiles = new Map();
  for (const f of walkDir(TEL_SRC)) telFiles.set(f.rel, f.full);

  let removed = 0, kept = 0;
  for (const [rel, telFull] of telFiles) {
    if (PROTECTED.has(rel)) { kept++; continue; }
    if (appFiles.has(rel)) {
      const same = md5(telFull) === md5(appFiles.get(rel));
      if (!same) {
        kept++;
        continue;
      }
      const tag = D + '[identique]' + R;
      console.log('  ' + G + '✗ SUPPRIMÉ' + R + ' ' + tag + R + ' ' + rel);
      if (!DRY_RUN) unlinkSync(telFull);
      removed++;
    } else {
      kept++;
    }
  }

  if (!DRY_RUN && removed > 0) removeEmptyDirs(TEL_SRC);

  console.log('\n✓ Nettoyage' + (DRY_RUN ? ' (dry-run)' : '') + ' :');
  console.log('  ' + removed + ' fichier(s) supprimé(s) | ' + kept + ' conservé(s)\n');
}
