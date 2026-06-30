/**
 * Seed stories msdev pour les favoris de listener@msdev.local.
 *
 * Usage (depuis backend/) :
 *   npm run msdev:seed-stories
 *   npm run msdev:seed-stories -- --force
 *
 * Charge store.json local msdev puis persiste les changements.
 */
import path from 'path';
import dotenv from 'dotenv';
import { loadPersistedStore, savePersistedStore } from '../lib/persist';
import { seedMsdevStories } from '../seed-msdev-stories';

dotenv.config({ path: path.join(process.cwd(), '.env') });
process.env.APP_ENV = process.env.APP_ENV || 'msdev';
process.env.MSENV = process.env.MSENV || 'msdev';

const force = process.argv.includes('--force');

const restored = loadPersistedStore();
if (restored) {
  console.log('[msdev:seed-stories] Store restauré depuis store.json');
} else {
  console.log('[msdev:seed-stories] Store vide — lancez msdev une fois ou reset-msdev-data.ps1');
}

const result = seedMsdevStories({ force });

console.log(
  `[msdev:seed-stories] ${result.created} story(s) créée(s), ${result.total} seed actives, ${result.authorsWithStories} auteur(s) favori(s) avec story`
);
if (result.authorIds.length) {
  console.log(`[msdev:seed-stories] Auteurs : ${result.authorIds.join(', ')}`);
}
if (result.removed) {
  console.log(`[msdev:seed-stories] ${result.removed} story(s) seed supprimée(s) (force)`);
}

savePersistedStore();
