'use strict';
/**
 * Seed « Démo Showcase » — jeu de données de démonstration complet (compte test + écosystème).
 *
 * Contexte : cf. commun/docs/dev-agent/rapports/<date>-demo-showcase-seed.md pour l'analyse de
 * risque complète (architecture in-memory store PostgreSQL, nécessité d'un arrêt pm2 bref).
 *
 * TOUTES les entités créées sont préfixées `demo_` (id) / `demo-` (email) pour permettre un
 * nettoyage ciblé ultérieur via cleanup_demo_showcase.js (même préfixe).
 *
 * ⚠️ IMPORTANT — architecture Soundy : le backend charge tout son état (users, follows,
 * feed_posts/events, stories, sponsors, favorites) en mémoire au démarrage et re-synchronise
 * PÉRIODIQUEMENT (10 s) PostgreSQL depuis cette mémoire — y compris des DELETE des lignes
 * absentes de la mémoire du process pour plusieurs tables (user_follows, feed_posts, stories,
 * sponsors, user_favorites, feed_post_favorites...). Écrire directement en base pendant que le
 * process pm2 tourne serait donc invisible (l'app ne relit pas Postgres à chaud) ET risquerait
 * d'être effacé au prochain flush. Procédure obligatoire :
 *   1. pm2 stop <process>
 *   2. node seed_demo_showcase.js   (ce script — écrit directement en PostgreSQL)
 *   3. pm2 start <process>          (recharge la mémoire depuis PostgreSQL, données visibles)
 *
 * Usage (depuis le répertoire de l'app, ex. /opt/soundly) :
 *   APP_ENV=production node seed_demo_showcase.js
 *
 * Variables optionnelles :
 *   DEMO_SEED_PASSWORD — mot de passe du compte test + de tous les comptes démo (défaut ci-dessous)
 *   DEMO_SEED_FORCE=1  — ré-exécute même si demo_user_test existe déjà (upsert idempotent)
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('[demo-seed] DATABASE_URL manquant — placez-vous dans le répertoire de l\'app (.env)');
  process.exit(1);
}

const TERMS_VERSION = '2026-07-09';
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'DemoShowcase#2026!';
const FORCE = process.env.DEMO_SEED_FORCE === '1';

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const WINDOW_END = NOW;
const WINDOW_START = NOW - 60 * DAY; // fenêtre 2 mois : passé récent → aujourd'hui

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260722);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pad = (n, len) => String(n).padStart(len, '0');

/** Répartit l'index i (sur n) linéairement dans la fenêtre 2 mois + un peu de bruit. */
function spreadTs(i, n) {
  const span = WINDOW_END - WINDOW_START;
  const base = WINDOW_START + Math.round((i / Math.max(n - 1, 1)) * span);
  const jitter = Math.round((rng() - 0.5) * DAY * 1.5);
  return Math.min(WINDOW_END, Math.max(WINDOW_START, base + jitter));
}
function blur(v) {
  return v + (rng() - 0.5) * 2 * 0.00045;
}
function avatar(seed) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}

const FR_CITIES = [
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Lyon', lat: 45.764, lon: 4.8357 },
  { name: 'Marseille', lat: 43.2965, lon: 5.3698 },
  { name: 'Toulouse', lat: 43.6047, lon: 1.4442 },
  { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
  { name: 'Nice', lat: 43.7102, lon: 7.262 },
];
const WORLD_CITIES = [
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', lat: 41.9028, lon: 12.4964 },
  { name: 'Lisbon', lat: 38.7223, lon: -9.1393 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Seoul', lat: 37.5665, lon: 126.978 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Toronto', lat: 43.6511, lon: -79.3839 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
];
const ALL_CITIES = [...FR_CITIES, ...WORLD_CITIES];

const YOUTUBE_TRACKS = [
  { title: 'Get Lucky', artist: 'Daft Punk', trackId: '5NV6RXX0i0I' },
  { title: 'Strobe', artist: 'deadmau5', trackId: 'jfaD3P3N0v4' },
  { title: 'Midnight City', artist: 'M83', trackId: 'dX3kQ8LZX0g' },
  { title: 'Uptown Funk', artist: 'Bruno Mars', trackId: 'OPf0YbXqDm0' },
  { title: 'Levitating', artist: 'Dua Lipa', trackId: 'TUVcZfQea-Y' },
];
const GENRES_POOL = [
  ['Électro', 'House'],
  ['Pop', 'Indie'],
  ['Hip-Hop', 'R&B'],
  ['Jazz', 'Soul'],
  ['Lo-Fi', 'Ambient'],
];
const EVENT_TYPES = ['dance', 'chant', 'autre'];
const EVENT_VENUES = ['Music Hall', 'Open Air Stage', 'Jazz Club', 'Rooftop Sessions', 'Festival Grounds', 'Concert Hall'];
const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  'https://images.unsplash.com/photo-1506157786151-6c9def9644a5?w=600',
];
/** Masters audio silencieux (générés ffmpeg, sans droits) — déposés à plat sous public/uploads/compositions/. */
const AUDIO_3MIN = ['/uploads/compositions/demo_master_3min_a.mp3', '/uploads/compositions/demo_master_3min_b.mp3'];
const AUDIO_2MIN = ['/uploads/compositions/demo_master_2min_a.mp3', '/uploads/compositions/demo_master_2min_b.mp3'];

// ─────────────────────────────────────────────────────────────────────────
// Construction du jeu de données (en mémoire, avant écriture)
// ─────────────────────────────────────────────────────────────────────────

const TEST_ID = 'demo_user_test';
const TEST_EMAIL = 'demo-test@getsoundy.com';

function makeUser(id, username, email, opts = {}) {
  const city = opts.city || pick(ALL_CITIES);
  const lat = blur(city.lat);
  const lon = blur(city.lon);
  return {
    id,
    username,
    email,
    latitude: lat,
    longitude: lon,
    blurredLatitude: blur(lat),
    blurredLongitude: blur(lon),
    city: city.name,
    avatarUrl: avatar(username),
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: opts.lastSeenAt ?? spreadTs(opts.i ?? 0, opts.n ?? 1),
    memberSince: opts.memberSince ?? spreadTs(opts.i ?? 0, opts.n ?? 1),
    accountStatus: 'active',
    onboardingCompleted: true,
    emailVerified: true,
    acceptedTermsAt: WINDOW_START,
    acceptedTermsVersion: TERMS_VERSION,
    ageConfirmedAt: WINDOW_START,
    favoriteGenres: pick(GENRES_POOL),
    bio: opts.bio || 'Compte de démonstration Soundy.',
    profileType: 'artiste',
    listeningRole: 'les_deux',
  };
}

const N_ALBUM_USERS = 40;
const N_GENERIC_USERS = 60;
const N_OUTER_USERS = 25;

const albumUsers = [];
for (let i = 0; i < N_ALBUM_USERS; i++) {
  const n = i + 1;
  albumUsers.push(
    makeUser(`demo_user_alb_${pad(n, 2)}`, `demo_alb_${pad(n, 2)}`, `demo-alb-${pad(n, 2)}@getsoundy.com`, {
      i: n,
      n: N_ALBUM_USERS,
      bio: 'Artiste démo Soundy — 1 album, 2 morceaux.',
    })
  );
}

const genericUsers = [];
for (let i = 0; i < N_GENERIC_USERS; i++) {
  const n = i + 1;
  genericUsers.push(
    makeUser(`demo_user_gen_${pad(n, 2)}`, `demo_gen_${pad(n, 2)}`, `demo-gen-${pad(n, 2)}@getsoundy.com`, {
      i: n,
      n: N_GENERIC_USERS,
    })
  );
}

const outerUsers = [];
for (let i = 0; i < N_OUTER_USERS; i++) {
  const n = i + 1;
  outerUsers.push(
    makeUser(`demo_user_out_${pad(n, 2)}`, `demo_out_${pad(n, 2)}`, `demo-out-${pad(n, 2)}@getsoundy.com`, {
      i: n,
      n: N_OUTER_USERS,
    })
  );
}

const testUser = makeUser(TEST_ID, 'demo_test', TEST_EMAIL, {
  i: 0,
  n: 1,
  city: FR_CITIES[0],
  bio: 'Compte de démonstration principal Soundy (showcase complet).',
});

const followedPool = [...albumUsers, ...genericUsers]; // 100 — suivis par le compte test
const outerPool = outerUsers; // 25 — NON suivis par le compte test
const allOtherUsers = [...followedPool, ...outerPool]; // 125

// Rôles dédiés dans genericUsers (indices 0-based)
const salonHosts = genericUsers.slice(0, 5);
const liveHosts = genericUsers.slice(5, 10);
const storyFollowedPosters = genericUsers.slice(10, 15);
const reelOtherAuthors = genericUsers.slice(15, 23);
const followedEventAuthors = genericUsers.slice(23, 27);

// ── Salons (5) ──
const salons = salonHosts.map((host, i) => {
  const city = pick(ALL_CITIES);
  const lat = blur(city.lat);
  const lon = blur(city.lon);
  const track = pick(YOUTUBE_TRACKS);
  return {
    id: `demo_salon_${pad(i + 1, 2)}`,
    hostId: host.id,
    hostName: host.username,
    hostAvatarUrl: host.avatarUrl,
    title: `Salon démo ${city.name} #${i + 1}`,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      isPlaying: false,
      progressMs: 0,
      updatedAt: spreadTs(i, 5),
    },
    latitude: lat,
    longitude: lon,
    blurredLatitude: blur(lat),
    blurredLongitude: blur(lon),
    listenersCount: 1 + Math.floor(rng() * 8),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [],
    allowQueue: true,
    createdAt: spreadTs(i, 5),
    genres: pick(GENRES_POOL),
  };
});

// ── Lives autonomes (5), archivés (isActive=false) ──
const lives = liveHosts.map((host, i) => {
  const city = pick(ALL_CITIES);
  const lat = blur(city.lat);
  const lon = blur(city.lon);
  const track = pick(YOUTUBE_TRACKS);
  const startedAt = spreadTs(i, 5);
  return {
    id: `demo_live_${pad(i + 1, 2)}`,
    hostId: host.id,
    hostName: host.username,
    title: `Live démo ${city.name} #${i + 1}`,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      isPlaying: false,
      progressMs: 0,
      updatedAt: startedAt,
    },
    latitude: lat,
    longitude: lon,
    blurredLatitude: blur(lat),
    blurredLongitude: blur(lon),
    viewersCount: 0,
    isActive: false,
    startedAt,
    endedAt: startedAt + (30 + Math.floor(rng() * 60)) * 60 * 1000,
    peakViewersCount: 3 + Math.floor(rng() * 40),
  };
});

// ── Albums + compositions ──
function makeAlbum(id, userId, title, ts) {
  return { id, userId, title, description: 'Album de démonstration Soundy.', createdAt: ts, updatedAt: ts };
}
function makeComposition(id, userId, albumId, title, artist, fileUrl, durationSec, ts) {
  return { id, userId, albumId, title, artist, fileUrl, durationSec, createdAt: ts };
}

const albums = [];
const compositions = [];

// Test : 2 albums × 3 morceaux × 180 s
for (let a = 0; a < 2; a++) {
  const albId = `demo_album_test_${a + 1}`;
  const ts = spreadTs(a, 2);
  albums.push(makeAlbum(albId, TEST_ID, `Album démo test ${a + 1}`, ts));
  for (let t = 0; t < 3; t++) {
    const compId = `demo_comp_test_${a + 1}_${t + 1}`;
    compositions.push(
      makeComposition(
        compId,
        TEST_ID,
        albId,
        `Morceau démo test ${a + 1}.${t + 1}`,
        testUser.username,
        pick(AUDIO_3MIN),
        180,
        spreadTs(a * 3 + t, 6)
      )
    );
  }
}

// 40 autres utilisateurs : 1 album × 2 morceaux × 120 s
albumUsers.forEach((user, i) => {
  const albId = `demo_album_alb_${pad(i + 1, 2)}`;
  const ts = spreadTs(i, N_ALBUM_USERS);
  albums.push(makeAlbum(albId, user.id, `Album démo ${user.username}`, ts));
  for (let t = 0; t < 2; t++) {
    const compId = `demo_comp_alb_${pad(i + 1, 2)}_${t + 1}`;
    compositions.push(
      makeComposition(
        compId,
        user.id,
        albId,
        `Morceau démo ${user.username}.${t + 1}`,
        user.username,
        pick(AUDIO_2MIN),
        120,
        spreadTs(i, N_ALBUM_USERS)
      )
    );
  }
});

// ── Événements (feed_posts isEvent=true) ──
function eventContent(city, venue) {
  return `Événement démo Soundy — ${venue}, ${city}. Jeu de données de démonstration.`;
}
function makeEvent(id, authorId, ts, city, venue) {
  return {
    id,
    userId: authorId,
    content: eventContent(city.name, venue),
    imageUrl: pick(UNSPLASH_IMAGES),
    isEvent: true,
    eventDate: new Date(ts).toISOString(),
    eventLocation: `${venue}, ${city.name}`,
    eventType: pick(EVENT_TYPES),
    createdAt: ts,
  };
}

const eventsTest = [];
for (let i = 0; i < 10; i++) {
  const ts = spreadTs(i, 10);
  eventsTest.push(makeEvent(`demo_event_test_${pad(i + 1, 2)}`, TEST_ID, ts, pick(ALL_CITIES), pick(EVENT_VENUES)));
}

const eventsFollowed = followedEventAuthors.map((author, i) =>
  makeEvent(`demo_event_followed_${pad(i + 1, 2)}`, author.id, spreadTs(i, 4), pick(ALL_CITIES), pick(EVENT_VENUES))
);

const eventsWorld = [];
for (let i = 0; i < 30; i++) {
  const author = allOtherUsers[i % allOtherUsers.length];
  eventsWorld.push(
    makeEvent(`demo_event_world_${pad(i + 1, 2)}`, author.id, spreadTs(i, 30), pick(ALL_CITIES), pick(EVENT_VENUES))
  );
}

const eventsSponsored = [];
for (let i = 0; i < 20; i++) {
  const author = allOtherUsers[(i + 50) % allOtherUsers.length];
  const city = i < 3 ? FR_CITIES[i] : pick(WORLD_CITIES);
  eventsSponsored.push(
    makeEvent(`demo_event_sponsored_${pad(i + 1, 2)}`, author.id, spreadTs(i, 20), city, pick(EVENT_VENUES))
  );
}

const allEvents = [...eventsTest, ...eventsFollowed, ...eventsWorld, ...eventsSponsored];

// ── Sponsors (20 événements sponsorisés, dont 3 en France) ──
const sponsors = eventsSponsored.map((evt, i) => {
  const ts = evt.createdAt;
  return {
    id: `demo_sponsor_${pad(i + 1, 2)}`,
    name: `Sponsor démo ${i + 1}`,
    placement: 'map_sidebar_events',
    linkedEventPostId: evt.id,
    active: true,
    priority: i + 1,
    title: evt.eventLocation,
    subtitle: 'Événement sponsorisé (démo)',
    cta: 'Voir',
    kind: 'sponsored',
    createdAt: ts,
    updatedAt: ts,
  };
});

// ── Reels (10 au total) ──
const reels = [];
for (let i = 0; i < 2; i++) {
  reels.push({
    id: `demo_reel_test_${i + 1}`,
    title: `Reel démo test ${i + 1}`,
    artist: testUser.username,
    genre: pick(GENRES_POOL)[0],
    mediaType: 'image',
    posterUrl: pick(UNSPLASH_IMAGES),
    authorId: TEST_ID,
    createdAt: spreadTs(i, 2),
    visibility: 'public',
  });
}
reelOtherAuthors.forEach((user, i) => {
  reels.push({
    id: `demo_reel_oth_${pad(i + 1, 2)}`,
    title: `Reel démo ${user.username}`,
    artist: user.username,
    genre: pick(GENRES_POOL)[0],
    mediaType: 'image',
    posterUrl: pick(UNSPLASH_IMAGES),
    authorId: user.id,
    createdAt: spreadTs(i, reelOtherAuthors.length),
    visibility: 'public',
  });
});

// ── Stories (30 : 5 suivis par test + 25 non suivis) ──
const stories = [];
storyFollowedPosters.forEach((user, i) => {
  const ts = spreadTs(i, storyFollowedPosters.length);
  stories.push({
    id: `demo_story_flw_${pad(i + 1, 2)}`,
    userId: user.id,
    content: 'Story démo Soundy',
    imageUrl: pick(UNSPLASH_IMAGES),
    createdAt: ts,
    expiresAt: ts + DAY,
    visibility: 'public',
  });
});
outerPool.forEach((user, i) => {
  const ts = spreadTs(i, outerPool.length);
  stories.push({
    id: `demo_story_out_${pad(i + 1, 2)}`,
    userId: user.id,
    content: 'Story démo Soundy',
    imageUrl: pick(UNSPLASH_IMAGES),
    createdAt: ts,
    expiresAt: ts + DAY,
    visibility: 'public',
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Écriture PostgreSQL
// ─────────────────────────────────────────────────────────────────────────

async function upsertUserRow(client, user, passwordHash) {
  const payload = { ...user };
  await client.query(
    `INSERT INTO users (id, email, username, password_hash, latitude, longitude, geom, payload)
     VALUES ($1,$2,$3,$4,$5::double precision,$6::double precision,
       CASE WHEN $5::double precision IS NOT NULL AND $6::double precision IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint($6::double precision,$5::double precision),4326)::geography
         ELSE NULL END,
       $7::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [user.id, user.email.toLowerCase(), user.username, passwordHash, user.latitude ?? null, user.longitude ?? null, JSON.stringify(payload)]
  );
}

async function upsertSalonRow(client, salon) {
  await client.query(
    `INSERT INTO salons (id, host_id, created_at, latitude, longitude, geom, is_active, payload)
     VALUES ($1,$2,$3,$4::double precision,$5::double precision,
       ST_SetSRID(ST_MakePoint($5::double precision,$4::double precision),4326)::geography,
       TRUE, $6::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [salon.id, salon.hostId, salon.createdAt, salon.latitude, salon.longitude, JSON.stringify(salon)]
  );
}

async function upsertLiveRow(client, live) {
  await client.query(
    `INSERT INTO lives (id, host_id, salon_id, started_at, is_active, latitude, longitude, geom, payload)
     VALUES ($1,$2,NULL,$3,$4,$5::double precision,$6::double precision,
       ST_SetSRID(ST_MakePoint($6::double precision,$5::double precision),4326)::geography,
       $7::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [live.id, live.hostId, live.startedAt, live.isActive, live.latitude, live.longitude, JSON.stringify(live)]
  );
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE id = $1', [TEST_ID]);
    if (existing.rows.length > 0 && !FORCE) {
      console.log(`[demo-seed] ${TEST_ID} existe déjà — seed déjà appliqué, rien à faire (DEMO_SEED_FORCE=1 pour forcer).`);
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    await client.query('BEGIN');

    await upsertUserRow(client, testUser, passwordHash);
    for (const u of allOtherUsers) await upsertUserRow(client, u, passwordHash);

    for (const s of salons) await upsertSalonRow(client, s);
    for (const l of lives) await upsertLiveRow(client, l);

    for (const alb of albums) {
      await client.query(
        `INSERT INTO user_albums (id, user_id, created_at, payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
        [alb.id, alb.userId, alb.createdAt, JSON.stringify(alb)]
      );
    }
    for (const c of compositions) {
      await client.query(
        `INSERT INTO user_compositions (id, user_id, created_at, payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.userId, c.createdAt, JSON.stringify(c)]
      );
    }

    for (const evt of allEvents) {
      await client.query(
        `INSERT INTO feed_posts (id, user_id, payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO NOTHING`,
        [evt.id, evt.userId, JSON.stringify(evt)]
      );
    }

    for (const sp of sponsors) {
      await client.query(
        `INSERT INTO sponsors (id, payload) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO NOTHING`,
        [sp.id, JSON.stringify(sp)]
      );
    }

    for (const r of reels) {
      await client.query(
        `INSERT INTO user_reels (id, author_id, created_at, visibility, payload) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id) DO NOTHING`,
        [r.id, r.authorId, r.createdAt, r.visibility, JSON.stringify(r)]
      );
    }

    for (const st of stories) {
      await client.query(
        `INSERT INTO stories (id, user_id, payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO NOTHING`,
        [st.id, st.userId, JSON.stringify(st)]
      );
    }

    // Follows : test → 100 (followedPool)
    for (const u of followedPool) {
      await client.query(
        `INSERT INTO user_follows (follower_id, followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [TEST_ID, u.id]
      );
    }

    // Favorites (« suit ») : 5 salons + 5 lives → favorite du host
    const favoriteHosts = [...salonHosts, ...liveHosts];
    for (const host of favoriteHosts) {
      const ts = NOW;
      await client.query(
        `INSERT INTO user_favorites (fan_id, host_id, payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT (fan_id, host_id) DO NOTHING`,
        [TEST_ID, host.id, JSON.stringify({ fanId: TEST_ID, hostId: host.id, notificationsEnabled: true, createdAt: ts })]
      );
    }

    // 4 événements suivis (favoris) par le compte test
    for (const evt of eventsFollowed) {
      await client.query(
        `INSERT INTO feed_post_favorites (user_id, post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [TEST_ID, evt.id]
      );
    }

    await client.query('COMMIT');

    const summary = {
      testAccount: { id: TEST_ID, email: TEST_EMAIL, username: 'demo_test', password: DEMO_PASSWORD },
      usersCreated: 1 + allOtherUsers.length,
      albumUsers: albumUsers.length,
      genericFollowedUsers: genericUsers.length,
      outerUnfollowedUsers: outerUsers.length,
      salons: salons.length,
      lives: lives.length,
      albums: albums.length,
      compositions: compositions.length,
      eventsCreatedByTest: eventsTest.length,
      eventsFollowedByTest: eventsFollowed.length,
      eventsWorldNotFollowed: eventsWorld.length,
      eventsSponsored: eventsSponsored.length,
      sponsorsCreated: sponsors.length,
      reels: reels.length,
      stories: stories.length,
      storiesFollowedByTest: storyFollowedPosters.length,
      storiesNotFollowed: outerPool.length,
      followsFromTest: followedPool.length,
      favoritesFromTest: favoriteHosts.length,
      windowStart: new Date(WINDOW_START).toISOString(),
      windowEnd: new Date(WINDOW_END).toISOString(),
    };
    console.log('\n=== SEED DEMO SHOWCASE TERMINÉ ===\n');
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[demo-seed] Échec:', err);
  process.exit(1);
});
