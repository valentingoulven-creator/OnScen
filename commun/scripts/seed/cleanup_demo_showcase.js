'use strict';
/**
 * Nettoyage complet du jeu de données « Démo Showcase » (voir seed_demo_showcase.js).
 *
 * Supprime TOUTE entité dont l'id (ou l'email pour users) commence par le préfixe `demo_` /
 * `demo-` — c'est-à-dire exactement ce que seed_demo_showcase.js a créé, rien d'autre.
 *
 * ⚠️ Comme pour le seed, exécuter avec le backend arrêté (pm2 stop) puis le redémarrer après
 * (pm2 start) pour que la mémoire de l'app soit resynchronisée sans les entités supprimées.
 *
 * Usage : APP_ENV=production node cleanup_demo_showcase.js
 * Les fichiers audio masters (public/uploads/compositions/demo_master_*.mp3) ne sont PAS
 * supprimés par ce script (réutilisables sans risque) — à retirer manuellement si besoin :
 *   rm -f public/uploads/compositions/demo_master_*.mp3
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('[demo-cleanup] DATABASE_URL manquant — placez-vous dans le répertoire de l\'app (.env)');
  process.exit(1);
}

const LIKE = 'demo\\_%'; // échappe le underscore LIKE (sinon wildcard '_' = un caractère)

async function del(client, sql, params, label) {
  const res = await client.query(sql, params);
  return { label, count: res.rowCount };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  const results = [];
  try {
    await client.query('BEGIN');

    results.push(
      await del(
        client,
        `DELETE FROM reel_likes WHERE reel_id IN (SELECT id FROM user_reels WHERE id LIKE $1)`,
        [LIKE],
        'reel_likes'
      )
    );
    results.push(
      await del(
        client,
        `DELETE FROM reel_comments WHERE reel_id IN (SELECT id FROM user_reels WHERE id LIKE $1)`,
        [LIKE],
        'reel_comments'
      )
    );
    results.push(
      await del(
        client,
        `DELETE FROM reel_shares WHERE reel_id IN (SELECT id FROM user_reels WHERE id LIKE $1)`,
        [LIKE],
        'reel_shares'
      )
    );
    results.push(
      await del(
        client,
        `DELETE FROM reel_views WHERE reel_id IN (SELECT id FROM user_reels WHERE id LIKE $1)`,
        [LIKE],
        'reel_views'
      )
    );
    results.push(await del(client, `DELETE FROM user_reels WHERE id LIKE $1`, [LIKE], 'user_reels'));

    results.push(await del(client, `DELETE FROM user_compositions WHERE id LIKE $1`, [LIKE], 'user_compositions'));
    results.push(await del(client, `DELETE FROM user_albums WHERE id LIKE $1`, [LIKE], 'user_albums'));

    results.push(
      await del(client, `DELETE FROM feed_post_favorites WHERE post_id LIKE $1 OR user_id LIKE $1`, [LIKE], 'feed_post_favorites')
    );
    results.push(await del(client, `DELETE FROM feed_post_likes WHERE post_id LIKE $1`, [LIKE], 'feed_post_likes'));
    results.push(await del(client, `DELETE FROM feed_post_upvotes WHERE post_id LIKE $1`, [LIKE], 'feed_post_upvotes'));
    results.push(await del(client, `DELETE FROM feed_post_comments WHERE post_id LIKE $1`, [LIKE], 'feed_post_comments'));
    results.push(await del(client, `DELETE FROM feed_posts WHERE id LIKE $1`, [LIKE], 'feed_posts'));

    results.push(await del(client, `DELETE FROM sponsors WHERE id LIKE $1`, [LIKE], 'sponsors'));
    results.push(await del(client, `DELETE FROM stories WHERE id LIKE $1`, [LIKE], 'stories'));

    results.push(
      await del(client, `DELETE FROM user_favorites WHERE fan_id LIKE $1 OR host_id LIKE $1`, [LIKE], 'user_favorites')
    );
    results.push(
      await del(client, `DELETE FROM user_follows WHERE follower_id LIKE $1 OR followed_id LIKE $1`, [LIKE], 'user_follows')
    );

    results.push(await del(client, `DELETE FROM lives WHERE id LIKE $1`, [LIKE], 'lives'));
    results.push(await del(client, `DELETE FROM salons WHERE id LIKE $1`, [LIKE], 'salons'));

    results.push(await del(client, `DELETE FROM users WHERE id LIKE $1`, [LIKE], 'users'));

    await client.query('COMMIT');

    console.log('\n=== CLEANUP DEMO SHOWCASE TERMINÉ ===\n');
    console.log(JSON.stringify(results, null, 2));
    console.log(
      '\nPenser à : pm2 restart <process> pour recharger la mémoire sans les entités supprimées.'
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[demo-cleanup] Échec:', err);
  process.exit(1);
});
