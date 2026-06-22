/**
 * Seed sponsors + événements sponsorisés en production (PostgreSQL).
 *
 * Usage sur le VPS :
 *   cd /opt/soundly && APP_ENV=production node dist/scripts/seed-production-sponsors.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { loadPersistedStoreAsync, usesPostgresPersistence } from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import {
  ensureDefaultSponsors,
  syncDefaultSponsorFields,
  syncDefaultSponsorScopes,
} from '../lib/sponsors';
import { ensureDefaultSponsorPlatformConfig } from '../lib/sponsorPlatformConfig';
import { ensureProductionSponsorContent } from '../seed-production-sponsors';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const added = ensureDefaultSponsors();
  const synced = syncDefaultSponsorFields();
  const scopes = syncDefaultSponsorScopes();
  ensureDefaultSponsorPlatformConfig();
  const { events } = ensureProductionSponsorContent();

  await savePersistedStoreToPostgres();

  console.log('\n=== SEED SPONSORS PRODUCTION ===\n');
  console.log(
    JSON.stringify(
      {
        sponsorsAdded: added,
        sponsorsFieldsSynced: synced,
        sponsorScopesSynced: scopes,
        sponsorEventsCreated: events.created,
        sponsorEventsTotal: events.total,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error('[seed] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
