'use strict';
/**
 * Seed production PostgreSQL — autonome (pg + dotenv).
 * Usage VPS : cd /opt/soundly && APP_ENV=production node seed_prod_testdata.js
 */
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '/opt/soundly/.env' });

const ID_PREFIX = 'prod-seed-';
const LE_CRES = { lat: 43.6489, lon: 3.9394 };
const TARGET_EMAIL = (process.env.SEED_TARGET_EMAIL || 'admin@getsoundy.com').toLowerCase();

const FOLLOWER_USERNAMES = [
  'soundy_user1',
  'soundy_user2',
  'soundy_user3',
  'soundy_user4',
  'soundy_user5',
];

const EVENT_SEEDS = [
  {
    id: `${ID_PREFIX}evt-cres-open-mic`,
    author: 'soundy_user1',
    content: 'Open mic acoustique ce vendredi — bring your instrument ! 🎤',
    eventDate: '2026-06-12T19:00:00.000Z',
    eventLocation: 'Salle des fêtes, Le Crès, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
  {
    id: `${ID_PREFIX}evt-cres-dj-terrasse`,
    author: 'soundy_user2',
    content: 'Soirée DJ terrasse — house & french touch autour du Crès 🎧',
    eventDate: '2026-06-14T20:30:00.000Z',
    eventLocation: 'Bar Le Patio, Le Crès, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  },
  {
    id: `${ID_PREFIX}evt-montpellier-rockstore`,
    author: 'soundy_user3',
    content: 'Concert indie au Rockstore — entrée libre avant 21h 🎸',
    eventDate: '2026-06-15T18:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  },
  {
    id: `${ID_PREFIX}evt-paris-olympia`,
    author: 'soundy_user4',
    content: "Session live soul à l'Olympia — places limitées 🎷",
    eventDate: '2026-06-18T20:00:00.000Z',
    eventLocation: "L'Olympia, Paris, France",
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  },
  {
    id: `${ID_PREFIX}evt-lyon-nuits-sonores`,
    author: 'soundy_user5',
    content: 'Nuits sonores pop-up — techno & ambient au traboule 🌙',
    eventDate: '2026-06-20T21:00:00.000Z',
    eventLocation: 'Traboule Café, Lyon, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}evt-marseille-jam`,
    author: 'keval',
    content: 'Jam session hip-hop sur le Vieux-Port — micro ouvert 🔥',
    eventDate: '2026-06-22T17:30:00.000Z',
    eventLocation: 'Vieux-Port, Marseille, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}evt-bordeaux-club`,
    author: 'soundy_dev',
    content: 'Club night électro — set 3h non-stop 💃',
    eventDate: '2026-06-25T23:00:00.000Z',
    eventLocation: 'Darwin, Bordeaux, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  },
];

const POST_SEEDS = [
  { id: `${ID_PREFIX}post-1`, author: 'soundy_user1', content: 'Qui écoute du jazz ce soir ? 🎷' },
  {
    id: `${ID_PREFIX}post-2`,
    author: 'soundy_user2',
    content: 'Mon salon YouTube est ouvert — venez !',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
  { id: `${ID_PREFIX}post-3`, author: 'keval', content: 'Découverte du jour : ce morceau est incroyable 🎶' },
  {
    id: `${ID_PREFIX}post-4`,
    author: 'soundy_user3',
    content: 'Ambiance lo-fi parfaite pour travailler ce matin ☕🎧',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  { id: `${ID_PREFIX}post-5`, author: 'soundy_user4', content: 'La carte est animée, plein de lives autour de moi 🗺️' },
  {
    id: `${ID_PREFIX}post-6`,
    author: 'soundy_user5',
    content: 'Soundy + weekend + bonne humeur = combo parfait ☀️🎵',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}post-val-1`,
    author: 'Val',
    content: 'Première publication depuis Le Crès — la scène locale est top ! 🎵',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
];

function blur(coord) {
  return coord + (Math.random() - 0.5) * 2 * 0.00045;
}

function makeNotif(id, recipientId, sender, type, message, extra = {}) {
  const createdAt = Date.now();
  const payload = {
    id,
    recipientId,
    senderId: sender.id,
    senderName: sender.username,
    senderAvatarUrl: sender.avatarUrl,
    type,
    message,
    read: false,
    createdAt,
    ...extra,
  };
  return { id, recipientId, senderId: sender.id, type, read: false, createdAt, payload };
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const usersRes = await pool.query('SELECT id, email, username, payload FROM users');
  const byUsername = new Map();
  const byEmail = new Map();
  for (const row of usersRes.rows) {
    const u = { ...row.payload, id: row.id, email: row.email, username: row.username };
    byUsername.set(u.username.toLowerCase(), u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
  }

  const target = byEmail.get(TARGET_EMAIL) || byUsername.get('val');
  if (!target) throw new Error(`Cible introuvable (${TARGET_EMAIL})`);

  const summary = {
    target: { id: target.id, username: target.username, email: target.email },
    followersAdded: [],
    eventsCreated: 0,
    postsCreated: 0,
    hearts: [],
  };

  // Mise à jour profil Val (géo Le Crès + cœur profil éligible)
  const updatedPayload = { ...target };
  updatedPayload.latitude = LE_CRES.lat;
  updatedPayload.longitude = LE_CRES.lon;
  updatedPayload.blurredLatitude = blur(LE_CRES.lat);
  updatedPayload.blurredLongitude = blur(LE_CRES.lon);
  updatedPayload.city = updatedPayload.city || 'Le cres';
  updatedPayload.relationshipStatus = 'celibataire';
  updatedPayload.age = 28;
  updatedPayload.accountStatus = updatedPayload.accountStatus || 'active';
  await pool.query('UPDATE users SET payload = $1::jsonb WHERE id = $2', [
    JSON.stringify(updatedPayload),
    target.id,
  ]);

  const now = Date.now();
  let offset = 0;

  // Follows
  for (const uname of FOLLOWER_USERNAMES) {
    const follower = byUsername.get(uname.toLowerCase());
    if (!follower) continue;
    const ins = await pool.query(
      `INSERT INTO user_follows (follower_id, followed_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING follower_id`,
      [follower.id, target.id]
    );
    if (ins.rowCount > 0) {
      summary.followersAdded.push(follower.username);
      const notif = makeNotif(
        `notif_${ID_PREFIX}follow-${follower.id}-${target.id}`,
        target.id,
        follower,
        'follow',
        `${follower.username} vous suit maintenant 👤`,
        { peerUserId: follower.id }
      );
      await pool.query(
        `INSERT INTO notifications (id, recipient_id, sender_id, type, read, created_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          notif.id,
          notif.recipientId,
          notif.senderId,
          notif.type,
          notif.read,
          notif.createdAt,
          JSON.stringify(notif.payload),
        ]
      );
    }
  }

  // Posts
  for (const seed of POST_SEEDS) {
    const author = byUsername.get(seed.author.toLowerCase());
    if (!author) continue;
    const post = {
      id: seed.id,
      userId: author.id,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      createdAt: now - offset * 900000,
    };
    const ins = await pool.query(
      `INSERT INTO feed_posts (id, user_id, payload) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [post.id, post.userId, JSON.stringify(post)]
    );
    if (ins.rowCount > 0) {
      summary.postsCreated++;
      offset++;
    }
  }

  // Events
  for (const seed of EVENT_SEEDS) {
    const author = byUsername.get(seed.author.toLowerCase());
    if (!author) continue;
    const post = {
      id: seed.id,
      userId: author.id,
      content: seed.content,
      imageUrl: seed.imageUrl,
      isEvent: true,
      eventDate: seed.eventDate,
      eventLocation: seed.eventLocation,
      eventType: seed.eventType,
      createdAt: now - offset * 900000,
    };
    const ins = await pool.query(
      `INSERT INTO feed_posts (id, user_id, payload) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [post.id, post.userId, JSON.stringify(post)]
    );
    if (ins.rowCount > 0) {
      summary.eventsCreated++;
      offset++;
    }
  }

  // Cœur 1 : profil (soundy_user1 → Val)
  const heartSender1 = byUsername.get('soundy_user1');
  if (heartSender1) {
    const hres = await pool.query(
      `INSERT INTO heart_events (from_id, to_id, created_at)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING from_id`,
      [heartSender1.id, target.id, now]
    );
    if (hres.rowCount > 0) {
      summary.hearts.push(`cœur profil : ${heartSender1.username} → ${target.username}`);
      const notif = makeNotif(
        `notif_${ID_PREFIX}heart-${heartSender1.id}-${target.id}`,
        target.id,
        heartSender1,
        'heart',
        `${heartSender1.username} vous a envoyé un cœur 💜`,
        { peerUserId: heartSender1.id }
      );
      await pool.query(
        `INSERT INTO notifications (id, recipient_id, sender_id, type, read, created_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (id) DO NOTHING`,
        [
          notif.id,
          notif.recipientId,
          notif.senderId,
          notif.type,
          notif.read,
          notif.createdAt,
          JSON.stringify(notif.payload),
        ]
      );
    }
  }

  // Cœur 2 : like publication (keval → post Val)
  const heartSender2 = byUsername.get('keval');
  const valPostId = `${ID_PREFIX}post-val-1`;
  if (heartSender2) {
    const lres = await pool.query(
      `INSERT INTO feed_post_likes (post_id, user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING post_id`,
      [valPostId, heartSender2.id]
    );
    if (lres.rowCount > 0) {
      summary.hearts.push(`like publication : ${heartSender2.username} → post de ${target.username}`);
      const notif = makeNotif(
        `notif_${ID_PREFIX}content-heart-${heartSender2.id}-${valPostId}`,
        target.id,
        heartSender2,
        'content_heart',
        `${heartSender2.username} a aimé votre publication ❤️`,
        { peerUserId: heartSender2.id, postId: valPostId }
      );
      await pool.query(
        `INSERT INTO notifications (id, recipient_id, sender_id, type, read, created_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (id) DO NOTHING`,
        [
          notif.id,
          notif.recipientId,
          notif.senderId,
          notif.type,
          notif.read,
          notif.createdAt,
          JSON.stringify(notif.payload),
        ]
      );
    }
  }

  await pool.query(
    `INSERT INTO store_meta (id, version, saved_at) VALUES (1, 1, $1)
     ON CONFLICT (id) DO UPDATE SET saved_at = EXCLUDED.saved_at`,
    [Date.now()]
  );

  console.log('\n=== SEED PRODUCTION TERMINÉ ===\n');
  console.log(JSON.stringify(summary, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error('[seed]', e);
  process.exit(1);
});
