/**
 * Seed 10 lives actifs — grandes villes françaises (PostgreSQL production).
 *
 * Usage sur le VPS :
 *   cd /opt/onscen && APP_ENV=production node dist/scripts/seed-production-france-random-lives.js
 *
 * Usage local (dev avec DATABASE_URL) :
 *   cd commun/backend && npm run build && node dist/scripts/seed-production-france-random-lives.js
 */
import dotenv from 'dotenv';
import path from 'path';
import {
  loadPersistedStoreAsync,
  usesPostgresPersistence,
} from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { seedFranceRandomLives } from '../seed-france-random-lives';
import { saveSalonsLivesToPostgres } from '../lib/pgSalonsLives';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const result = seedFranceRandomLives();
  await savePersistedStoreToPostgres();
  const pgSaved = await saveSalonsLivesToPostgres();

  console.log('\n=== SEED FRANCE RANDOM LIVES TERMINÉ ===\n');
  console.log(
    JSON.stringify(
      {
        ...result,
        postgres: pgSaved,
        mapHint: 'https://onscen.com/map — filtre Lives, centrer sur la France',
        liveUrls: result.lives.map((l) => `https://onscen.com/live/${l.id}`),
      },
      null,
      2
    )
  );
  console.log('\n⚡  Relancer pm2 : pm2 restart onscen-backend\n');
}

main()
  .catch((err) => {
    console.error('[seed-france-lives] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
