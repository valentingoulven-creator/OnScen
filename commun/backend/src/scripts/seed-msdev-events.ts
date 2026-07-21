/**
 * Re-seed événements msdev (Autour + festivals France).
 *
 * Usage (depuis commun/backend/) :
 *   npm run msdev:seed-events
 *   npm run msdev:seed-events -- --force
 */
import path from 'path';
import dotenv from 'dotenv';
import { loadPersistedStore, savePersistedStore } from '../lib/persist';
import { ensureMsdevDemoAccounts } from '../seed-msdev';
import { getHomeFeedSeedStats, seedHomeFeed } from '../seed-home-feed';

dotenv.config({ path: path.join(process.cwd(), '.env') });
process.env.APP_ENV = process.env.APP_ENV || 'msdev';
process.env.MSENV = process.env.MSENV || 'msdev';

const force = process.argv.includes('--force');

async function main() {
  const restored = loadPersistedStore();
  if (restored) {
    console.log('[msdev:seed-events] Store restauré depuis store.json');
  } else {
    console.log('[msdev:seed-events] Store vide — comptes demo seront créés');
  }

  await ensureMsdevDemoAccounts();

  const result = seedHomeFeed({ forceRepair: force, forceCommunity: force });
  const stats = getHomeFeedSeedStats();

  console.log(
    `[msdev:seed-events] feed-events: +${result.feedEventsCreated} (${stats.feedEventsTotal}/${stats.feedEventTarget}), user-events: +${result.userEventsCreated} (${stats.userEventsTotal}/${stats.userEventTarget})`
  );

  if (force) {
    console.log('[msdev:seed-events] Mode force — seeds feed-event / user-event remplacés');
  }

  savePersistedStore();
  console.log('[msdev:seed-events] store.json persisté');
}

void main().catch((err) => {
  console.error('[msdev:seed-events] Erreur:', err);
  process.exit(1);
});
