/**
 * Seed showcase listener@msdev.local sur le store persisté msdev.
 *
 * Usage (depuis commun/backend) :
 *   npx tsx src/scripts/seed-msdev-showcase.ts
 *   npx tsx src/scripts/seed-msdev-showcase.ts --force
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../msdev/.env') });
process.env.APP_ENV = 'msdev';

import { loadPersistedStore, schedulePersist } from '../lib/persist';
import { seedMsdevShowcase } from '../seed-msdev-showcase';
import { seedHomeFeed } from '../seed-home-feed';
import { seedMsdevStories } from '../seed-msdev-stories';

const force = process.argv.includes('--force');

const restored = loadPersistedStore();
if (!restored) {
  console.error('[msdev:seed-showcase] Aucun store msdev — lancez npm run dev une première fois.');
  process.exit(1);
}

seedHomeFeed({ forceRepair: force });
seedMsdevStories({ force });
const result = seedMsdevShowcase({ force });
schedulePersist();

console.log('[msdev:seed-showcase] OK', result);
console.log('[msdev:seed-showcase] Compte : listener@msdev.local / msdev123');

setTimeout(() => process.exit(0), 1500);
