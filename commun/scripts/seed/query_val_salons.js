'use strict';
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: process.argv[2] || '/opt/onscen/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

(async () => {
  const users = await pool.query(
    `SELECT id, username, email,
            payload->>'city' AS city,
            payload->>'latitude' AS lat,
            payload->>'longitude' AS lng,
            payload->>'blurredLatitude' AS blat,
            payload->>'blurredLongitude' AS blon,
            payload->>'isGhostMode' AS ghost,
            payload->>'locationPrecision' AS loc_prec,
            payload->>'isAdmin' AS is_admin
     FROM users
     WHERE username ILIKE 'val' OR username ILIKE 'keval' OR email ILIKE '%val%'
     ORDER BY username`
  );
  console.log('=== USERS (Val/keval) ===');
  console.log(JSON.stringify(users.rows, null, 2));

  for (const u of users.rows) {
    const salons = await pool.query(
      `SELECT id, host_id, latitude, longitude, payload
       FROM salons WHERE host_id = $1`,
      [u.id]
    );
    console.log(`\n=== SALONS host=${u.username} (${salons.rows.length}) ===`);
    for (const s of salons.rows) {
      const pl = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
      console.log(
        JSON.stringify(
          {
            id: s.id,
            hostId: s.host_id,
            dbLat: s.latitude,
            dbLon: s.longitude,
            title: pl.title,
            accessMode: pl.accessMode,
            isPublic: pl.isPublic,
            isGhostMode: pl.isGhostMode,
            adminBlocked: pl.adminBlocked,
            payloadLat: pl.latitude,
            payloadLon: pl.longitude,
            blurredLat: pl.blurredLatitude,
            blurredLon: pl.blurredLongitude,
            isLive: pl.isLive,
            endedAt: pl.endedAt,
          },
          null,
          2
        )
      );
    }
  }

  const allSalons = await pool.query(
    `SELECT s.id, u.username AS host, s.latitude, s.longitude,
            payload->>'title' AS title,
            payload->>'accessMode' AS access_mode,
            payload->>'isGhostMode' AS ghost,
            payload->>'adminBlocked' AS blocked
     FROM salons s
     JOIN users u ON u.id = s.host_id
     ORDER BY u.username`
  );
  console.log('\n=== ALL SALONS ===');
  console.log(JSON.stringify(allSalons.rows, null, 2));

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
