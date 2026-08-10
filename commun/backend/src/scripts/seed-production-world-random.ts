/**
 * Seed 20 salons + 20 lives + 50 événements feed — villes aléatoires mondiales (PostgreSQL production).
 *
 * Usage sur le VPS :
 *   cd /opt/onscen && APP_ENV=production node dist/commun/scripts/seed-production-world-random.js
 *
 * Usage local (dev avec DATABASE_URL) :
 *   cd backend && npm run seed:world
 */
import dotenv from 'dotenv';
import path from 'path';
import {
  loadPersistedStoreAsync,
  usesPostgresPersistence,
} from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { seedWorldRandomData } from '../seed-world-random';
import { saveSalonsLivesToPostgres } from '../lib/pgSalonsLives';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const result = seedWorldRandomData();
  await savePersistedStoreToPostgres();
  const pgSaved = await saveSalonsLivesToPostgres();

  console.log('\n=== SEED WORLD RANDOM TERMINÉ ===\n');
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
  console.log('\n⚡  Relancer pm2 : pm2 restart onscen-backend\n');
}

main()
  .catch((err) => {
    console.error('[seed] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
