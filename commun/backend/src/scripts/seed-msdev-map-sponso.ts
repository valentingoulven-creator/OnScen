/**
 * Seed événements + sponsors carrousel Sponso sidebar carte (msdev).
 *
 * Usage (depuis commun/backend/) :
 *   npm run msdev:seed-map-sponso
 */
import path from 'path';
import dotenv from 'dotenv';
import { loadPersistedStore, savePersistedStore } from '../lib/persist';
import { ensureMsdevDemoAccounts } from '../seed-msdev';
import { ensureProductionSponsorContent, refreshMsdevSponsorEventDatesIfStale } from '../seed-production-sponsors';
import { ensureDefaultMapSidebarEventSponsors, listActiveMapSidebarEventPostIds } from '../lib/sponsors';

dotenv.config({ path: path.join(process.cwd(), '.env') });
process.env.APP_ENV = process.env.APP_ENV || 'msdev';
process.env.MSENV = process.env.MSENV || 'msdev';

async function main() {
  const restored = loadPersistedStore();
  console.log(
    restored
      ? '[msdev:seed-map-sponso] Store restauré depuis store.json'
      : '[msdev:seed-map-sponso] Store vide — comptes demo seront créés'
  );

  await ensureMsdevDemoAccounts();

  const events = ensureProductionSponsorContent().events;
  const refreshed = refreshMsdevSponsorEventDatesIfStale();
  const sponsorsAdded = ensureDefaultMapSidebarEventSponsors();
  const activePostIds = listActiveMapSidebarEventPostIds();

  console.log(
    `[msdev:seed-map-sponso] events: +${events.created} (${events.total} total), dates repoussées: ${refreshed}, sponsors: +${sponsorsAdded}, actifs: ${activePostIds.length}`
  );
  if (activePostIds.length > 0) {
    console.log(`[msdev:seed-map-sponso] postIds: ${activePostIds.join(', ')}`);
  }

  savePersistedStore();
  console.log('[msdev:seed-map-sponso] store.json persisté');
}

void main().catch((err) => {
  console.error('[msdev:seed-map-sponso] Erreur:', err);
  process.exit(1);
});
