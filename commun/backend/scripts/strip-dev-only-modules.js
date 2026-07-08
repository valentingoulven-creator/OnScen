#!/usr/bin/env node
/**
 * strip-dev-only-modules.js — Retire du build de production les modules
 * explicitement réservés au développement/msdev et non conformes aux ToS
 * d'un tiers (fallback Piped/Invidious pour les métadonnées YouTube).
 *
 * Contexte (audit RGPD/YouTube/Copyright, YT-2) :
 *   `youtubeRemote.ts` est déjà neutralisé par un garde-fou runtime
 *   (`isYoutubeRemoteFallbackAllowed()` force `false` en production), mais
 *   le fichier compilé restait physiquement présent dans `dist/`, donc
 *   atteignable si une variable d'env était mal positionnée (ex.
 *   ALLOW_YOUTUBE_REMOTE_FALLBACK=true poussé par erreur en prod/preprod).
 *
 * Ce script est appelé UNIQUEMENT par `npm run build:prod` (utilisé par
 * `commun/deploy/deploy_zero_downtime.ps1` pour prod ET preprod). Il n'est
 * PAS appelé par `npm run build` (utilisé par `build:exe`, les scripts de
 * seed msdev, et le dev local ts-node-dev qui ne lit jamais `dist/`), afin
 * de ne pas casser le fallback msdev volontaire.
 *
 * Résultat : même une mauvaise config d'env ne peut plus activer Piped/
 * Invidious en prod/preprod, car le module n'existe tout simplement plus
 * sur disque (`import('./youtubeRemote')` échoue — intercepté par un
 * try/catch défensif côté appelants, qui se contentent alors de ne pas
 * proposer le fallback plutôt que de planter la requête).
 */
const fs = require('fs');
const path = require('path');

const distLibDir = path.join(__dirname, '..', 'dist', 'lib');
const targets = [
  'youtubeRemote.js',
  'youtubeRemote.js.map',
  'youtubeRemote.d.ts',
  'youtubeRemote.d.ts.map',
];

let removed = 0;
for (const file of targets) {
  const full = path.join(distLibDir, file);
  if (fs.existsSync(full)) {
    fs.rmSync(full);
    removed++;
    console.log(`[strip-dev-only-modules] retiré du build : dist/lib/${file}`);
  }
}

const stillPresent = path.join(distLibDir, 'youtubeRemote.js');
if (fs.existsSync(stillPresent)) {
  console.error('[strip-dev-only-modules] ÉCHEC : dist/lib/youtubeRemote.js toujours présent après suppression.');
  process.exit(1);
}

if (removed === 0) {
  console.warn(
    '[strip-dev-only-modules] Aucun fichier youtubeRemote.* trouvé dans dist/lib — ' +
      'build déjà propre ou chemin dist inattendu (vérifier tsconfig outDir).'
  );
} else {
  console.log(
    `[strip-dev-only-modules] OK — fallback Piped/Invidious (non conforme ToS YouTube) exclu du build de production (${removed} fichier(s)).`
  );
}
