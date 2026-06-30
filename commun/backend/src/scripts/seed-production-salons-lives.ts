/**
 * Seed 10 salons + 5 lives (bots) en production PostgreSQL.
 *
 * Usage sur le VPS :
 *   cd /opt/soundy && APP_ENV=production node dist/commun/scripts/seed-production-salons-lives.js
 */
import dotenv from 'dotenv';
import path from 'path';
import {
  loadPersistedStoreAsync,
  usesPostgresPersistence,
} from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { seedProductionSalonsLives } from '../seed-salons-lives';
import { saveSalonsLivesToPostgres } from '../lib/pgSalonsLives';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const result = seedProductionSalonsLives();
  await savePersistedStoreToPostgres();
  const pgSaved = await saveSalonsLivesToPostgres();

  console.log('\n=== SEED SALONS / LIVES TERMINÉ ===\n');
  console.log(
    JSON.stringify(
      {
        ...result,
        postgres: pgSaved,
      },
      null,
      2
    )
  );
  console.log('\n⚡  Relancer pm2 : pm2 restart melosong-backend\n');
}

main()
  .catch((err) => {
    console.error('[seed] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
