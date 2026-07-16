/**
 * Seed msdev : 100 lives (~1000 spectateurs) + 10 festivals monde (aujourd'hui/demain).
 *
 * Usage (depuis commun/backend/) :
 *   npx ts-node src/scripts/seed-msdev-density.ts
 *   npx ts-node src/scripts/seed-msdev-density.ts --force
 */
import path from 'path';
import dotenv from 'dotenv';
import { loadPersistedStore, savePersistedStore } from '../lib/persist';
import { seedMsdevDensity } from '../seed-msdev-density';

dotenv.config({ path: path.join(process.cwd(), '../../commun/msdev/.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
process.env.APP_ENV = process.env.APP_ENV || 'msdev';
process.env.MSENV = process.env.MSENV || 'msdev';

const force = process.argv.includes('--force');

const restored = loadPersistedStore();
if (restored) {
  console.log('[msdev:seed-density] Store restauré depuis store.json');
} else {
  console.log('[msdev:seed-density] Store vide — lancez msdev une fois ou reset-msdev-data.ps1');
}

const result = seedMsdevDensity({ force });

console.log(
  `[msdev:seed-density] ${result.livesCreated} live(s), ${result.eventsCreated} festival(s) créés` +
    (result.livesRemoved || result.eventsRemoved
      ? ` (${result.livesRemoved} live(s) / ${result.eventsRemoved} event(s) remplacés)`
      : '')
);
console.log(
  `[msdev:seed-density] Spectateurs : moyenne ${result.averageViewers}, min ${result.viewerMin}, max ${result.viewerMax}`
);

savePersistedStore();
