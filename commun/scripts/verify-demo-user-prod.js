/* One-off: verify YouTube audit demo user email in prod (JSONB payload). */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const email = process.argv[2];
if (!email) {
  console.error('Usage: node verify-demo-user-prod.js <email>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool
  .query(
    `UPDATE users
     SET payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{emailVerified}', 'true'::jsonb, true)
     WHERE lower(email) = lower($1)
     RETURNING id, username, email, payload->>'emailVerified' AS email_verified`,
    [email]
  )
  .then((r) => {
    console.log(JSON.stringify(r.rows, null, 2));
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
