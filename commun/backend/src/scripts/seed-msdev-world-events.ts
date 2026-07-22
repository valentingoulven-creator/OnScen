/**
 * Seed 50 événements feed monde (hors France) — msdev store.json.
 *
 * Usage (depuis commun/backend/) :
 *   npm run msdev:seed-world-events
 *   npm run msdev:seed-world-events -- --force
 */
import path from 'path';
import dotenv from 'dotenv';
import { loadPersistedStore, savePersistedStore } from '../lib/persist';
import { seedWorldEventPosts } from '../seed-world-random';

dotenv.config({ path: path.join(process.cwd(), '.env') });
process.env.APP_ENV = process.env.APP_ENV || 'msdev';
process.env.MSENV = process.env.MSENV || 'msdev';

const force = process.argv.includes('--force');

async function main() {
  const restored = loadPersistedStore();
  console.log(
    restored
      ? '[msdev:seed-world-events] Store restauré depuis store.json'
      : '[msdev:seed-world-events] Store vide — initialisation'
  );

  const result = seedWorldEventPosts({ force });
  savePersistedStore();

  console.log(
    `[msdev:seed-world-events] +${result.eventsCreated} événement(s) (${result.eventsTotal}/50), bots +${result.usersCreated}`
  );
  if (force) {
    console.log('[msdev:seed-world-events] Mode force — feed-world-event-* régénérés');
  }
  if (result.cities.length > 0) {
    console.log(`[msdev:seed-world-events] Villes : ${result.cities.slice(0, 8).join(', ')}…`);
  }
}

void main().catch((err) => {
  console.error('[msdev:seed-world-events] Erreur:', err);
  process.exit(1);
});
