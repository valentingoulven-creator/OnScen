'use strict';
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: process.argv[2] || '/opt/soundly/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

(async () => {
  const users = await pool.query(
    `SELECT id, email, username, payload->>'city' as city,
            payload->>'latitude' as lat, payload->>'longitude' as lng
     FROM users ORDER BY email`
  );
  console.log('=== USERS ===');
  for (const u of users.rows) console.log(JSON.stringify(u));

  const fc = await pool.query('SELECT COUNT(*)::int AS n FROM user_follows');
  console.log('\n=== FOLLOWS COUNT ===', fc.rows[0].n);

  const postCount = await pool.query(`SELECT COUNT(*)::int AS n FROM feed_posts`);
  console.log('\n=== FEED POSTS COUNT ===', postCount.rows[0].n);

  const posts = await pool.query(
    `SELECT id, payload->>'userId' AS user_id, payload->>'isEvent' AS is_event,
            payload->>'eventLocation' AS event_location
     FROM feed_posts WHERE id LIKE 'prod-seed-%' ORDER BY id`
  );
  console.log('\n=== SEED POSTS ===');
  for (const p of posts.rows) console.log(JSON.stringify(p));

  const hearts = await pool.query('SELECT from_id, to_id, created_at FROM heart_events LIMIT 10');
  console.log('\n=== HEART EVENTS ===');
  for (const h of hearts.rows) console.log(JSON.stringify(h));

  const val = await pool.query(
    `SELECT id, username, payload->>'relationshipStatus' as rel,
            payload->>'age' as age, payload->>'accountStatus' as status
     FROM users WHERE username IN ('Val', 'keval')`
  );
  console.log('\n=== TARGET USERS ===');
  for (const u of val.rows) console.log(JSON.stringify(u));

  const followsDetail = await pool.query(
    `SELECT u.username as follower, t.username as followed
     FROM user_follows f
     JOIN users u ON u.id = f.follower_id
     JOIN users t ON t.id = f.followed_id
     ORDER BY follower`
  );
  console.log('\n=== FOLLOWS ===');
  for (const f of followsDetail.rows) console.log(JSON.stringify(f));

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
