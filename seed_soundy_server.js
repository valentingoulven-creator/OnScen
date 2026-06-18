#!/usr/bin/env node
// seed_soundy_server.js
// À exécuter DIRECTEMENT sur le serveur production :
//   node /tmp/seed_soundy_server.js
//
// Inject 10 bots (users + salons/lives) + 10 events dans store.json

'use strict';
const fs = require('fs');

const STORE = '/opt/soundly/data/store.json';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function blur(coord) {
  return coord + (Math.random() - 0.5) * 2 * 0.00045;
}
function nowMs() { return Date.now(); }
function randCreatedMs() {
  const days = Math.random() * 89 + 1;          // 1–90 jours en arrière
  return nowMs() - Math.floor(days * 86_400_000);
}
function eventDateISO(daysFromNow, hour = 20) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ─── Données bots ─────────────────────────────────────────────────────────────
const BOTS = [
  {
    id: 'bot_djmaxime', username: 'DJ_Maxime', city: 'Paris',
    lat: 48.8566, lng: 2.3522, role: 'host',
    genres: ['Électro', 'House', 'Funk'], activity: 'salon',
    salonTitle: 'Salon Électro — Paris',
    track: 'Midnight City', artist: 'M83', platform: 'spotify',
    trackId: '2P91MQbaiQKBR4c9sEgqsl',
    albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
  },
  {
    id: 'bot_laurabeats', username: 'LauraBeats', city: 'Lyon',
    lat: 45.7640, lng: 4.8357, role: 'les_deux',
    genres: ['Pop', 'Soul', 'Indie'], activity: 'live',
    liveTitle: 'Live Pop — Lyon',
    track: 'Anti-Hero', artist: 'Taylor Swift', platform: 'spotify',
    trackId: '0V3wPSX9ygBnCm8psDIegu',
    albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
  },
  {
    id: 'bot_rapperkev', username: 'RapperKev', city: 'Marseille',
    lat: 43.2965, lng: 5.3698, role: 'les_deux',
    genres: ['Rap', 'Hip-Hop', 'Funk'], activity: null,
  },
  {
    id: 'bot_electraflo', username: 'ElectraFlo', city: 'Bordeaux',
    lat: 44.8378, lng: -0.5792, role: 'host',
    genres: ['Électro', 'Pop'], activity: null,
  },
  {
    id: 'bot_jazzmarie', username: 'JazzMarie', city: 'Toulouse',
    lat: 43.6047, lng: 1.4442, role: 'les_deux',
    genres: ['Jazz', 'Soul', 'Pop'], activity: 'salon',
    salonTitle: 'Jazz Lounge — Toulouse',
    track: 'So What', artist: 'Miles Davis', platform: 'spotify',
    trackId: 'spotify:track:soWhat_jazz',
    albumArt: 'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=400',
  },
  {
    id: 'bot_soulbruno', username: 'SoulBruno', city: 'Lille',
    lat: 50.6292, lng: 3.0573, role: 'les_deux',
    genres: ['Soul', 'Funk', 'Jazz'], activity: null,
  },
  {
    id: 'bot_beatsam', username: 'BeatMaker_Sam', city: 'Nantes',
    lat: 47.2184, lng: -1.5536, role: 'les_deux',
    genres: ['Hip-Hop', 'Rap', 'Électro'], activity: 'live',
    liveTitle: 'Live Hip-Hop — Nantes',
    track: 'DNA.', artist: 'Kendrick Lamar', platform: 'spotify',
    trackId: 'spotify:track:dna_kendrick',
    albumArt: 'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=400',
  },
  {
    id: 'bot_trapqueen', username: 'TrapQueen', city: 'Strasbourg',
    lat: 48.5734, lng: 7.7521, role: 'les_deux',
    genres: ['Rap', 'Hip-Hop'], activity: null,
  },
  {
    id: 'bot_indietom', username: 'IndieRock_Tom', city: 'Rennes',
    lat: 48.1173, lng: -1.6778, role: 'host',
    genres: ['Indie', 'Pop', 'Soul'], activity: 'salon',
    salonTitle: 'Indie Session — Rennes',
    track: 'Mr. Brightside', artist: 'The Killers', platform: 'spotify',
    trackId: 'spotify:track:mrbrightside',
    albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
  },
  {
    id: 'bot_funkmaster', username: 'FunkMaster', city: 'Nice',
    lat: 43.7102, lng: 7.2620, role: 'host',
    genres: ['Funk', 'Soul', 'Pop'], activity: null,
  },
];

const EVENTS = [
  { id: 'evt_festival_jazz_paris',   title: 'Festival Jazz',   city: 'Paris',
    lat: 48.8588, lng: 2.3478, days: 2,  type: 'festival', attendees: 200, author: 'bot_jazzmarie' },
  { id: 'evt_soiree_dj_lyon',        title: 'Soirée DJ',      city: 'Lyon',
    lat: 45.7612, lng: 4.8402, days: 5,  type: 'concert',  attendees: 80,  author: 'bot_laurabeats' },
  { id: 'evt_concert_rap_marseille', title: 'Concert Rap',    city: 'Marseille',
    lat: 43.2998, lng: 5.3811, days: 1,  type: 'concert',  attendees: 150, author: 'bot_rapperkev' },
  { id: 'evt_nuit_electro_bordeaux', title: 'Nuit Électro',   city: 'Bordeaux',
    lat: 44.8415, lng: -0.5724, days: 7, type: 'club',     attendees: 200, author: 'bot_electraflo' },
  { id: 'evt_open_mic_toulouse',     title: 'Open Mic',       city: 'Toulouse',
    lat: 43.6022, lng: 1.4481, days: 3,  type: 'bar',      attendees: 40,  author: 'bot_jazzmarie' },
  { id: 'evt_concert_soul_lille',    title: 'Concert Soul',   city: 'Lille',
    lat: 50.6322, lng: 3.0618, days: 10, type: 'concert',  attendees: 100, author: 'bot_soulbruno' },
  { id: 'evt_festival_indie_nantes', title: 'Festival Indie', city: 'Nantes',
    lat: 47.2205, lng: -1.5491, days: 14,type: 'festival', attendees: 300, author: 'bot_beatsam' },
  { id: 'evt_battle_rap_strasbourg', title: 'Battle Rap',     city: 'Strasbourg',
    lat: 48.5763, lng: 7.7558, days: 4,  type: 'concert',  attendees: 120, author: 'bot_trapqueen' },
  { id: 'evt_soiree_funk_rennes',    title: 'Soirée Funk',    city: 'Rennes',
    lat: 48.1152, lng: -1.6801, days: 6, type: 'bar',      attendees: 60,  author: 'bot_indietom' },
  { id: 'evt_concert_jazz_nice',     title: 'Concert Jazz',   city: 'Nice',
    lat: 43.7128, lng: 7.2588, days: 21, type: 'concert',  attendees: 180, author: 'bot_funkmaster' },
];

// ─── Constructeurs ────────────────────────────────────────────────────────────
function makePlayback(b) {
  const ts = nowMs();
  const progress = Math.floor(Math.random() * 180_000) + 15_000;
  return {
    platform: b.platform, trackId: b.trackId,
    title: b.track, artist: b.artist, albumArtUrl: b.albumArt,
    isPlaying: true, progressMs: progress,
    updatedAt: ts, startedAt: ts - progress,
  };
}

function makeUser(b) {
  return {
    id: b.id, username: b.username,
    email: `${b.id}@bot.soundy.local`,
    passwordHash: 'bot',
    avatarUrl: null,
    meloCoins: 0, isGhostMode: false,
    favoriteGenres: b.genres,
    city: b.city, listeningRole: b.role,
    latitude: b.lat, longitude: b.lng,
    blurredLatitude: blur(b.lat), blurredLongitude: blur(b.lng),
    memberSince: randCreatedMs(),
    lastSeenAt: nowMs(),
  };
}

function makeSalon(b) {
  const salonId = `salon_${b.id}`;
  const pb = makePlayback(b);
  return [salonId, {
    id: salonId, hostId: b.id, hostName: b.username, hostAvatarUrl: null,
    title: b.salonTitle, platform: b.platform, playbackState: pb,
    latitude: b.lat, longitude: b.lng,
    blurredLatitude: blur(b.lat), blurredLongitude: blur(b.lng),
    listenersCount: Math.floor(Math.random() * 15) + 3,
    isGhostMode: false, isPublic: true, accessMode: 'public',
    allowedUserIds: [b.id], allowQueue: true, createdAt: nowMs(),
  }];
}

function makeLive(b) {
  const liveId = `live_${b.id}`;
  const pb = makePlayback(b);
  return [liveId, {
    id: liveId, hostId: b.id, hostName: b.username,
    title: b.liveTitle, platform: b.platform, playbackState: pb,
    latitude: b.lat, longitude: b.lng,
    blurredLatitude: blur(b.lat), blurredLongitude: blur(b.lng),
    viewersCount: Math.floor(Math.random() * 25) + 5,
    isActive: true,
    startedAt: nowMs() - Math.floor(Math.random() * 1_500_000) - 300_000,
  }];
}

function makeEvent(e) {
  return {
    id: e.id, title: e.title, city: e.city,
    authorId: e.author,
    latitude: e.lat, longitude: e.lng,
    date: eventDateISO(e.days),
    status: 'published', type: e.type,
    expectedAttendees: e.attendees,
    createdAt: nowMs(),
  };
}

// ─── Fusion robuste (dict ou array) ──────────────────────────────────────────
function upsert(store, key, itemId, item) {
  if (!store[key]) store[key] = {};
  if (Array.isArray(store[key])) {
    store[key] = store[key].filter(x => x.id !== itemId);
    store[key].push(item);
  } else {
    store[key][itemId] = item;
  }
}

function upsertList(store, key, item) {
  if (!store[key]) store[key] = [];
  store[key] = store[key].filter(x => x.id !== item.id);
  store[key].push(item);
}

function ensureMapEntry(store, key, mapKey, val) {
  if (!store[key]) store[key] = {};
  if (Array.isArray(store[key])) return; // format inconnu, on skip
  if (!store[key][mapKey]) store[key][mapKey] = val;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('  Soundy Production Seeder (Node.js on-server)');
console.log('='.repeat(60));

// Lire store.json
let store;
try {
  const raw = fs.readFileSync(STORE, 'utf-8');
  store = JSON.parse(raw);
  const keys = Object.keys(store);
  console.log(`\n✅  store.json lu (${raw.length.toLocaleString()} bytes) — clés : ${keys.join(', ')}`);
} catch (err) {
  console.error(`\n❌  Impossible de lire ${STORE} :`, err.message);
  process.exit(1);
}

// Backup
const backupPath = `${STORE}.bak.${Date.now()}`;
fs.copyFileSync(STORE, backupPath);
console.log(`📋  Backup : ${backupPath}`);

const createdUsers  = [];
const createdSalons = [];
const createdLives  = [];
const createdEvents = [];

// ── Bots
console.log('\n👤  Injection des bots …');
for (const b of BOTS) {
  const user = makeUser(b);
  upsert(store, 'users', b.id, user);
  let label = `${b.username} (${b.city})`;

  if (b.activity === 'salon') {
    const [salonId, salon] = makeSalon(b);
    upsert(store, 'salons', salonId, salon);
    ensureMapEntry(store, 'salonChats',     salonId, []);
    ensureMapEntry(store, 'salonQueues',    salonId, []);
    ensureMapEntry(store, 'salonProposals', salonId, []);
    createdSalons.push(salonId);
    label += ' [salon actif]';
  } else if (b.activity === 'live') {
    const [liveId, live] = makeLive(b);
    upsert(store, 'lives', liveId, live);
    ensureMapEntry(store, 'liveChats', liveId, []);
    createdLives.push(liveId);
    label += ' [live actif]';
  }

  createdUsers.push(label);
  console.log(`   ✓ ${label}`);
}

// ── Events
console.log('\n📅  Injection des événements …');
for (const e of EVENTS) {
  const event = makeEvent(e);
  upsertList(store, 'events', event);
  const label = `${e.title} — ${e.city} (${eventDateISO(e.days).slice(0, 10)})`;
  createdEvents.push(label);
  console.log(`   ✓ ${label}`);
}

// Écrire store.json
const newJson = JSON.stringify(store, null, 2);
const tmpPath = `${STORE}.tmp_${Date.now()}`;
fs.writeFileSync(tmpPath, newJson, 'utf-8');
fs.renameSync(tmpPath, STORE);
console.log(`\n📝  store.json mis à jour (${newJson.length.toLocaleString()} bytes)`);

// Résumé
console.log('\n' + '='.repeat(60));
console.log('  🎉  Seeding terminé !');
console.log('='.repeat(60));
console.log(`\n👤  ${createdUsers.length} bots créés :`);
createdUsers.forEach(u => console.log(`   • ${u}`));
console.log(`\n📅  ${createdEvents.length} événements créés :`);
createdEvents.forEach(e => console.log(`   • ${e}`));
if (createdSalons.length) console.log(`\n🎵  Salons actifs : ${createdSalons.join(', ')}`);
if (createdLives.length)  console.log(`🔴  Lives actifs  : ${createdLives.join(', ')}`);
console.log('\n⚡  Relance pm2 : pm2 restart melosong-backend');
