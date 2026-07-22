'use strict';
/** Vérification comptages du seed démo showcase (lecture seule). */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const QUERIES = [
  ['users_total', `SELECT COUNT(*) FROM users WHERE id LIKE 'demo\\_%'`],
  ['salons', `SELECT COUNT(*) FROM salons WHERE id LIKE 'demo\\_%'`],
  ['lives', `SELECT COUNT(*) FROM lives WHERE id LIKE 'demo\\_%'`],
  ['albums', `SELECT COUNT(*) FROM user_albums WHERE id LIKE 'demo\\_%'`],
  ['compositions', `SELECT COUNT(*) FROM user_compositions WHERE id LIKE 'demo\\_%'`],
  ['compositions_180s_test', `SELECT COUNT(*) FROM user_compositions WHERE id LIKE 'demo_comp_test\\_%' AND (payload->>'durationSec')::int = 180`],
  ['compositions_120s_others', `SELECT COUNT(*) FROM user_compositions WHERE id LIKE 'demo_comp_alb\\_%' AND (payload->>'durationSec')::int = 120`],
  ['events_total', `SELECT COUNT(*) FROM feed_posts WHERE id LIKE 'demo_event\\_%'`],
  ['events_by_test', `SELECT COUNT(*) FROM feed_posts WHERE id LIKE 'demo_event_test\\_%'`],
  ['events_followed_by_test_favorites', `SELECT COUNT(*) FROM feed_post_favorites WHERE user_id = 'demo_user_test'`],
  ['events_world_not_followed', `SELECT COUNT(*) FROM feed_posts WHERE id LIKE 'demo_event_world\\_%'`],
  ['events_sponsored', `SELECT COUNT(*) FROM feed_posts WHERE id LIKE 'demo_event_sponsored\\_%'`],
  ['sponsors_total', `SELECT COUNT(*) FROM sponsors WHERE id LIKE 'demo\\_%'`],
  ['sponsors_france', `SELECT COUNT(*) FROM sponsors WHERE id LIKE 'demo\\_%' AND (payload->>'title') ~ '(Paris|Lyon|Marseille)'`],
  ['reels_total', `SELECT COUNT(*) FROM user_reels WHERE id LIKE 'demo\\_%'`],
  ['stories_total', `SELECT COUNT(*) FROM stories WHERE id LIKE 'demo\\_%'`],
  ['follows_from_test', `SELECT COUNT(*) FROM user_follows WHERE follower_id = 'demo_user_test'`],
  ['favorites_from_test_salons_lives', `SELECT COUNT(*) FROM user_favorites WHERE fan_id = 'demo_user_test'`],
  ['test_account_exists', `SELECT COUNT(*) FROM users WHERE id = 'demo_user_test'`],
  ['album_users_with_album', `SELECT COUNT(DISTINCT user_id) FROM user_albums WHERE id LIKE 'demo_album_alb\\_%'`],
  ['test_albums', `SELECT COUNT(*) FROM user_albums WHERE id LIKE 'demo_album_test\\_%'`],
  ['stories_followed_by_test', `SELECT COUNT(*) FROM stories WHERE id LIKE 'demo_story_flw\\_%'`],
  ['stories_not_followed', `SELECT COUNT(*) FROM stories WHERE id LIKE 'demo_story_out\\_%'`],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const out = {};
  for (const [label, sql] of QUERIES) {
    const res = await pool.query(sql);
    out[label] = Number(res.rows[0].count);
  }
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
