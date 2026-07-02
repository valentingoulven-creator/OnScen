'use strict';
require('dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('pg');
const VAL_ID = 'user_1781025111633_ipv5l';
(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const pick = await pool.query(
    `SELECT id, latitude, longitude, payload->>'title' AS title, created_at
     FROM salons
     WHERE host_id = $1
       AND COALESCE(payload->>'accessMode', 'public') = 'public'
       AND COALESCE(payload->>'isGhostMode', 'false') = 'false'
       AND latitude BETWEEN 43.5 AND 43.8
       AND longitude BETWEEN 3.7 AND 4.1
     ORDER BY created_at DESC
     LIMIT 1`,
    [VAL_ID]
  );
  console.log('Le Crès pick:', pick.rows[0]);
  if (!pick.rows[0]) {
    await pool.end();
    process.exit(1);
  }
  const target = pick.rows[0];
  await pool.query(`UPDATE salons SET is_active = FALSE WHERE host_id = $1`, [VAL_ID]);
  await pool.query(`UPDATE salons SET is_active = TRUE WHERE id = $1`, [target.id]);
  console.log('Reactivated:', target.id);
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
