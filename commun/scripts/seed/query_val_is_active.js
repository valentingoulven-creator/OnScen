'use strict';
require('dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
(async () => {
  const r = await pool.query(
    `SELECT is_active, payload->>'isGhostMode' AS ghost, COUNT(*)::int AS n
     FROM salons WHERE host_id = 'user_1781025111633_ipv5l'
     GROUP BY is_active, payload->>'isGhostMode'
     ORDER BY is_active DESC, ghost`
  );
  console.log('BY is_active:', r.rows);
  const active = await pool.query(
    `SELECT id, latitude, longitude, payload->>'title' title, payload->>'isGhostMode' ghost
     FROM salons WHERE host_id = 'user_1781025111633_ipv5l' AND is_active = TRUE`
  );
  console.log('ACTIVE SALONS:', active.rows);
  const val = await pool.query(
    `SELECT username, payload->>'isGhostMode' AS ghost FROM users WHERE username = 'Val'`
  );
  console.log('VAL USER:', val.rows);
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
