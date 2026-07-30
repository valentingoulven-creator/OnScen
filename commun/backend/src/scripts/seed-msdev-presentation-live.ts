/**
 * Seed live présentation Castelnau-le-Lez (40 spectateurs, chat, HLS démo).
 *
 * Usage (depuis commun/backend) :
 *   npx tsx src/scripts/seed-msdev-presentation-live.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../msdev/.env') });
process.env.APP_ENV = 'msdev';

import { loadPersistedStore, schedulePersist } from '../lib/persist';
import { seedProductionSalonsLives } from '../seed-salons-lives';
import { seedMsdevPresentationLive, persistPresentationLiveData } from '../seed-msdev-presentation-live';

async function main() {
  const restored = loadPersistedStore();
  if (!restored) {
    console.error('[msdev:seed-presentation] Aucun store msdev — lancez npm run dev une première fois.');
    process.exit(1);
  }

  seedProductionSalonsLives();
  const result = seedMsdevPresentationLive();
  schedulePersist();
  await persistPresentationLiveData();

  console.log('[msdev:seed-presentation] OK', result);
  console.log(`[msdev:seed-presentation] Ouvrir : http://localhost:5173/live/${result.liveId}`);
  console.log('[msdev:seed-presentation] Compte : listener@msdev.local / msdev123');
}

main().catch((err) => {
  console.error('[msdev:seed-presentation] ERREUR', err);
  process.exit(1);
});
