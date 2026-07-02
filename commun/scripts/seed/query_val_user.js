'use strict';
require('/opt/soundly/node_modules/dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('/opt/soundly/node_modules/pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
(async () => {
  const r = await pool.query(
    `SELECT id, username, email,
            payload->'platformAccounts' AS platform_accounts,
            payload->'connectedPlatforms' AS connected_platforms
     FROM users
     WHERE id = 'user_1781025111633_ipv5l' OR lower(username) = 'val'
     LIMIT 1`
  );
  console.log(JSON.stringify(r.rows[0], null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
