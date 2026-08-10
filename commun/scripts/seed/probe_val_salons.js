'use strict';
require('/opt/onscen/node_modules/dotenv').config({ path: '/opt/onscen/.env' });
const { Pool } = require('/opt/onscen/node_modules/pg');
const VAL = 'user_1781025111633_ipv5l';

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const salons = await pool.query(
    `SELECT id, host_id, is_active, created_at, latitude, longitude
     FROM salons WHERE host_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [VAL]
  );
  console.log('=== PG salons ===');
  console.log(JSON.stringify(salons.rows, null, 2));

  const { loadPersistedStoreAsync } = require('/opt/onscen/dist/lib/persist');
  await loadPersistedStoreAsync();
  const { loadSalonsLivesFromPostgres } = require('/opt/onscen/dist/lib/pgSalonsLives');
  await loadSalonsLivesFromPostgres();
  const { db } = require('/opt/onscen/dist/models/schema');
  const { getActiveSalonForHost } = require('/opt/onscen/dist/lib/profile');
  const mem = [...db.salons.values()].filter((s) => s.hostId === VAL);
  console.log('=== Memory salons ===', mem.length);
  for (const s of mem) {
    console.log({
      id: s.id,
      title: s.title,
      accessMode: s.accessMode,
      isGhostMode: s.isGhostMode,
      createdAt: s.createdAt,
    });
  }
  const active = getActiveSalonForHost(VAL, { forOwner: true });
  console.log('getActiveSalonForHost:', active?.id, active?.title);

  await pool.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
