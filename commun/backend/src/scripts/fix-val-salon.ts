/**
 * Corrige les salons actifs du compte Val en prod :
 * - désactive les salons fantômes (Paris)
 * - réactive le salon public le plus récent au Crès
 *
 * Usage : cd /opt/soundly && node scripts/fix-val-salon.js
 */
'use strict';
require('dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('pg');

const VAL_ID = 'user_1781025111633_ipv5l';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const deactivateGhost = await pool.query(
    `UPDATE salons
     SET is_active = FALSE
     WHERE host_id = $1
       AND is_active = TRUE
       AND COALESCE(payload->>'isGhostMode', 'false') = 'true'
     RETURNING id`,
    [VAL_ID]
  );
  console.log('Salons fantômes désactivés:', deactivateGhost.rows.map((r: { id: string }) => r.id));

  const pick = await pool.query(
    `SELECT id, latitude, longitude, payload->>'title' AS title
     FROM salons
     WHERE host_id = $1
       AND COALESCE(payload->>'accessMode', 'public') = 'public'
       AND COALESCE(payload->>'isGhostMode', 'false') = 'false'
     ORDER BY created_at DESC
     LIMIT 1`,
    [VAL_ID]
  );

  if (!pick.rows[0]) {
    console.error('Aucun salon public non fantôme trouvé pour Val.');
    await pool.end();
    process.exit(1);
  }

  const target = pick.rows[0];
  await pool.query(`UPDATE salons SET is_active = FALSE WHERE host_id = $1 AND id <> $2`, [
    VAL_ID,
    target.id,
  ]);
  await pool.query(`UPDATE salons SET is_active = TRUE WHERE id = $1`, [target.id]);

  console.log('Salon réactivé:', target);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
