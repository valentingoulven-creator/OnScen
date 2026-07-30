/**
 * Active le live présentation BeatCastel en production (HLS démo, chat, dons).
 *
 * Usage sur le VPS :
 *   cd /opt/soundly && APP_ENV=production node dist/scripts/seed-production-presentation-live.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { db } from '../models/schema';
import {
  loadPersistedStoreAsync,
  usesPostgresPersistence,
} from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { seedProductionSalonsLives, SALON_LIVE_ID_PREFIX } from '../seed-salons-lives';
import { saveSalonsLivesToPostgres, loadSalonsLivesFromPostgres } from '../lib/pgSalonsLives';
import { closePool, getPool } from '../db/pool';
import { PRESENTATION_LIVE_ID } from '../lib/presentationDemoLive';
import {
  persistPresentationLiveData,
  seedMsdevPresentationLive,
} from '../seed-msdev-presentation-live';

dotenv.config({ path: path.join(process.cwd(), '.env') });

function migrateLegacySeedLives(): number {
  let removed = 0;
  for (const id of [...db.lives.keys()]) {
    if (!id.startsWith(`${SALON_LIVE_ID_PREFIX}live-`)) continue;
    if (id === PRESENTATION_LIVE_ID) continue;
    db.lives.delete(id);
    db.liveChats.delete(id);
    removed++;
  }
  return removed;
}

async function deleteLegacySeedLivesFromPg(): Promise<number> {
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM lives WHERE id LIKE $1 AND id <> $2 RETURNING id`,
    [`${SALON_LIVE_ID_PREFIX}live-%`, PRESENTATION_LIVE_ID]
  );
  return res.rowCount ?? 0;
}

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  await loadSalonsLivesFromPostgres();

  const salonsSeed = seedProductionSalonsLives();
  const legacyRemoved = migrateLegacySeedLives();
  const legacyPgRemoved = await deleteLegacySeedLivesFromPg();
  const presentation = seedMsdevPresentationLive();

  await savePersistedStoreToPostgres();
  const pgSaved = await saveSalonsLivesToPostgres();
  await persistPresentationLiveData();

  console.log('\n=== LIVE PRÉSENTATION PROD ===\n');
  console.log(
    JSON.stringify(
      {
        salonsSeed,
        legacyLivesRemoved: legacyRemoved,
        legacyLivesPgRemoved: legacyPgRemoved,
        presentation,
        postgres: pgSaved,
        liveUrl: `https://getsoundy.com/live/${presentation.liveId}`,
      },
      null,
      2
    )
  );
  console.log('\n⚡  Relancer pm2 : pm2 restart melosong-backend\n');
}

main()
  .catch((err) => {
    console.error('[seed-presentation] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
