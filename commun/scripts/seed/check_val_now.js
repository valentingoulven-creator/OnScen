'use strict';
require('dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const u = await pool.query(`SELECT id, username FROM users WHERE username ILIKE 'val'`);
  console.log('USER:', u.rows);
  const id = u.rows[0]?.id;
  if (!id) {
    await pool.end();
    return;
  }

  const s = await pool.query(
    `SELECT id, is_active, latitude, longitude, created_at, payload
     FROM salons WHERE host_id = $1 ORDER BY created_at DESC LIMIT 8`,
    [id]
  );
  console.log(
    'SALONS:',
    JSON.stringify(
      s.rows.map((r) => ({
        id: r.id,
        is_active: r.is_active,
        lat: r.latitude,
        lon: r.longitude,
        created_at: r.created_at,
        ghost: r.payload?.isGhostMode,
        accessMode: r.payload?.accessMode,
        title: r.payload?.title,
        adminBlocked: r.payload?.adminBlocked,
      })),
      null,
      2
    )
  );

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
