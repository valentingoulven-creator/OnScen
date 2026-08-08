import bcrypt from 'bcryptjs';
import { DEFAULT_PLAYBACK_SESSION_TITLE } from './lib/brandName';
import { db, Salon, Live, MusicPlatform, User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { seedWorldMapBots, seedBotPosts } from './seed-bots';
import {
  seedProductionSalonsLives,
  SALON_LIVE_BOT_SEEDS,
  SALON_LIVE_ID_PREFIX,
} from './seed-salons-lives';
import { ensureBeatCastelShowcaseProfile } from './seed-beatcastel-profile';
import { followUser } from './lib/follows';
import { ensureSalonQueue, ensureSalonProposals, enqueueItem } from './lib/salonPlaybackOps';
import { MSDEV_DEMO_AGE } from './lib/msdevDemoAccounts';
import { FRANCE_COUNTRY_CODE, resolveLiveCountry } from './lib/liveCountry';
import { schedulePersist } from './lib/persist';
import { maskEmail } from './lib/maskPii';

/** Assure que les lives démo msdev (DJ Melody, BassHunter) sont actifs au démarrage.
 *  Appelé après loadPersistedStore() pour éviter un feed vide. */
export function ensureMsdevDemoLives(): void {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return;

  const DEMO_LIVES: Array<{ id: string; hostId: string; hostName: string; title: string; lat: number; lon: number; viewers: number }> = [
    { id: 'salon_dj',  hostId: 'user_dj',   hostName: 'DJ Melody',  title: 'Live DJ Melody — Deep House',   lat: 48.8570, lon: 2.3525, viewers: 24 },
    { id: 'live_demo_bass', hostId: 'user_bass', hostName: 'BassHunter', title: 'Live BassHunter — YouTube Vibes', lat: 48.8561, lon: 2.3524, viewers: 7 },
  ];

  let changed = false;

  for (const def of DEMO_LIVES) {
    const host = db.users.get(def.hostId);
    if (!host) continue; // comptes démo pas encore créés

    const existing = db.lives.get(def.id);
    if (existing?.isActive) continue; // déjà actif, rien à faire

    const live: Live = {
      id: def.id,
      salonId: def.id === 'salon_dj' ? 'salon_dj' : undefined,
      hostId: def.hostId,
      hostName: def.hostName,
      title: def.title,
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: def.id === 'salon_dj' ? '2P91MQbaiQKBR4c9sEgqsl' : 'dQw4w9WgXcQ',
        title: def.id === 'salon_dj' ? 'Midnight City' : 'Never Gonna Give You Up',
        artist: def.id === 'salon_dj' ? 'M83' : 'Rick Astley',
        albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
        isPlaying: true,
        progressMs: Math.floor(Math.random() * 120000),
        updatedAt: Date.now(),
        startedAt: Date.now() - 300000,
      },
      latitude: def.lat,
      longitude: def.lon,
      blurredLatitude: blurCoordinate(def.lat),
      blurredLongitude: blurCoordinate(def.lon),
      viewersCount: def.viewers,
      isActive: true,
      startedAt: Date.now() - 300000,
    };

    db.lives.set(live.id, live);
    if (!db.liveChats.has(live.id)) db.liveChats.set(live.id, []);
    if (!db.liveBans.has(live.id))  db.liveBans.set(live.id, new Map());
    changed = true;
    console.log(`[msdev] Live démo activé : ${live.title}`);
  }

  if (changed) schedulePersist();
}

/** Salons + lives France (Occitanie, Montpellier…) — idempotent, réactive les lives inactifs. */
export function ensureMsdevFranceSalonLives(): void {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return;

  const result = seedProductionSalonsLives();
  ensureBeatCastelShowcaseProfile();
  let reactivated = 0;

  for (const seed of SALON_LIVE_BOT_SEEDS) {
    if (!seed.withLive || !seed.liveTitle) continue;
    const liveId = `${SALON_LIVE_ID_PREFIX}live-${seed.userId.replace(SALON_LIVE_ID_PREFIX, '')}`;
    const existing = db.lives.get(liveId);
    if (!existing?.isActive) {
      if (!existing) continue;
      existing.isActive = true;
      if (!existing.startedAt) existing.startedAt = Date.now() - 600_000;
      db.lives.set(liveId, existing);
      reactivated++;
      console.log(`[msdev] Live France réactivé : ${existing.title}`);
    }
  }

  if (result.livesCreated > 0 || result.salonsCreated > 0 || reactivated > 0) {
    schedulePersist();
  }
  if (result.salonsCreated > 0 || result.livesCreated > 0) {
    console.log(
      `[msdev] France : +${result.salonsCreated} salon(s), +${result.livesCreated} live(s)`
    );
  }
}

const PARIS_LAT = 48.8566;
const PARIS_LON = 2.3522;
const MONTPELLIER_LAT = 43.6108;
const MONTPELLIER_LON = 3.8767;

function buildMsdevDemoUsers(hash: string): { dj: User; bass: User; listener: User } {
  const dj: User = {
    id: 'user_dj',
    username: 'DJ Melody',
    email: 'dj@msdev.local',
    passwordHash: hash,
    isAdmin: true,
    staffRole: 'dev' as const,
    accountStatus: 'active',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DJMelody',
    meloCoins: 500,
    isGhostMode: false,
    age: MSDEV_DEMO_AGE,
    lastSeenAt: Date.now(),
  };

  const bass: User = {
    id: 'user_bass',
    username: 'BassHunter',
    email: 'bass@msdev.local',
    passwordHash: hash,
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=BassHunter',
    meloCoins: 200,
    isGhostMode: false,
    age: MSDEV_DEMO_AGE,
    lastSeenAt: Date.now(),
  };

  const listener: User = {
    id: 'user_listener',
    username: 'demo_test_founder',
    email: 'listener@msdev.local',
    passwordHash: hash,
    isAdmin: true,
    staffRole: 'dev' as const,
    accountStatus: 'active',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
    profilePhotos: [
      'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    ],
    meloCoins: 100,
    isGhostMode: false,
    age: MSDEV_DEMO_AGE,
    lastSeenAt: Date.now(),
    memberSince: Date.now() - 86400000 * 30,
    bio: 'Compte de démonstration OnScen — contenu de test pour valider les parcours produit.',
    interests: ['Sessions live', 'Carte géoloc', 'Rencontres musicales'],
    favoriteGenres: ['Électro', 'Indie', 'Lo-fi', 'French touch'],
    favoriteArtists: ['M83', 'Daft Punk', 'Lomepal'],
    connectedPlatforms: ['youtube', 'youtube'] as MusicPlatform[],
    city: 'Montpellier',
    profileType: 'dj',
    listeningRole: 'les_deux' as const,
    relationshipStatus: 'celibataire',
    onboardingCompleted: true,
    emailVerified: true,
    favoritesCountOverride: 243_000,
  };

  Object.assign(dj, {
    bio: 'Host deep house — je mixe en live sur OnScen pour faire vibrer le quartier.',
    interests: ['Deep house', 'Live mixing', 'Communauté'],
    favoriteGenres: ['House', 'Techno'],
    favoriteArtists: ['M83', 'Disclosure'],
    connectedPlatforms: ['youtube'],
    city: 'Paris',
    listeningRole: 'host',
    memberSince: Date.now() - 86400000 * 120,
  });

  Object.assign(bass, {
    bio: 'YouTube & bass music — toujours un morceau à partager.',
    interests: ['YouTube', 'Bass', 'Memes musicaux'],
    favoriteGenres: ['Dubstep', 'Pop'],
    favoriteArtists: ['Rick Astley', 'Skrillex'],
    connectedPlatforms: ['youtube'],
    city: 'Paris',
    listeningRole: 'host',
    memberSince: Date.now() - 86400000 * 60,
  });

  const setUserGeo = (u: User, lat: number, lon: number) => {
    u.latitude = lat;
    u.longitude = lon;
    refreshUserPublicCoords(u);
    u.lastSeenAt = Date.now();
  };

  setUserGeo(dj, PARIS_LAT + 0.0004, PARIS_LON + 0.0003);
  setUserGeo(bass, PARIS_LAT - 0.0005, PARIS_LON + 0.0002);
  setUserGeo(listener, MONTPELLIER_LAT - 0.0008, MONTPELLIER_LON + 0.0004);

  return { dj, bass, listener };
}

/**
 * Après restauration d'un store.json partiel (ex. bots world sans comptes démo),
 * recrée les comptes listener@ / dj@ / bass@ msdev manquants.
 */
export async function ensureMsdevDemoAccounts(): Promise<number> {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return 0;

  const hash = await bcrypt.hash('msdev123', 10);
  const { dj, bass, listener } = buildMsdevDemoUsers(hash);
  let added = 0;
  for (const user of [dj, bass, listener]) {
    const exists = [...db.users.values()].some(
      (u) => u.email === user.email || u.id === user.id
    );
    if (exists) continue;
    db.users.set(user.id, user);
    added++;
    console.log(`[msdev] Compte démo créé : ${maskEmail(user.email)}`);
  }
  if (added > 0) schedulePersist();
  return added;
}

export async function seedMsdevData(): Promise<void> {
  if (db.users.size > 0) return;

  const hash = await bcrypt.hash('msdev123', 10);
  const { dj, bass, listener } = buildMsdevDemoUsers(hash);

  db.users.set(dj.id, dj);
  db.users.set(bass.id, bass);
  db.users.set(listener.id, listener);

  const parisLat = PARIS_LAT;
  const parisLon = PARIS_LON;

  const salon1: Salon = {
    id: 'salon_dj',
    hostId: dj.id,
    hostName: dj.username,
    hostAvatarUrl: dj.avatarUrl,
    title: 'Deep House Paris',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: '2P91MQbaiQKBR4c9sEgqsl',
      title: 'Midnight City',
      artist: 'M83',
      albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
      isPlaying: true,
      progressMs: 45000,
      updatedAt: Date.now(),
      startedAt: Date.now() - 45000,
      externalUrl: 'https://youtube.com/watch/track/2P91MQbaiQKBR4c9sEgqsl',
    },
    latitude: parisLat + 0.0004,
    longitude: parisLon + 0.0003,
    blurredLatitude: blurCoordinate(parisLat + 0.0004),
    blurredLongitude: blurCoordinate(parisLon + 0.0003),
    listenersCount: 8,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [dj.id],
    allowQueue: true,
    createdAt: Date.now(),
  };

  const salon2: Salon = {
    id: 'salon_bass',
    hostId: bass.id,
    hostName: bass.username,
    hostAvatarUrl: bass.avatarUrl,
    title: 'YouTube Vibes',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      albumArtUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      isPlaying: true,
      progressMs: 12000,
      updatedAt: Date.now(),
      startedAt: Date.now() - 12000,
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    latitude: parisLat - 0.0005,
    longitude: parisLon - 0.0004,
    blurredLatitude: blurCoordinate(parisLat - 0.0005),
    blurredLongitude: blurCoordinate(parisLon - 0.0004),
    listenersCount: 3,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [bass.id],
    allowQueue: false,
    createdAt: Date.now(),
  };

  db.salons.set(salon1.id, salon1);
  db.salons.set(salon2.id, salon2);
  ensureSalonQueue(salon1.id);
  ensureSalonProposals(salon1.id);
  enqueueItem(salon1.id, {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    trackId: '0VjIjW4GlUZAMYd2vXMi3b',
    externalUrl: 'https://youtube.com/watch/track/0VjIjW4GlUZAMYd2vXMi3b',
    addedById: bass.id,
    addedByName: bass.username,
    source: 'proposal',
  });
  db.salonChats.set(salon1.id, [
    {
      id: 'm1',
      roomId: salon1.id,
      roomType: 'salon',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Super session ! 🔥',
      timestamp: Date.now() - 60000,
    },
  ]);
  db.salonChats.set(salon2.id, []);

  const live1: Live = {
    id: salon1.id,
    salonId: salon1.id,
    hostId: dj.id,
    hostName: dj.username,
    title: 'Live DJ Melody',
    platform: 'youtube',
    playbackState: salon1.playbackState,
    latitude: salon1.latitude,
    longitude: salon1.longitude,
    blurredLatitude: salon1.blurredLatitude,
    blurredLongitude: salon1.blurredLongitude,
    viewersCount: 24,
    isActive: true,
    startedAt: Date.now() - 300000,
  };
  db.lives.set(live1.id, live1);
  db.liveChats.set(live1.id, [
    {
      id: 'lm1',
      roomId: live1.id,
      roomType: 'live',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Le drop arrive ! 🔥',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'lm2',
      roomId: live1.id,
      roomType: 'live',
      senderId: listener.id,
      senderName: listener.username,
      content: 'Incroyable ce morceau',
      timestamp: Date.now() - 90000,
    },
  ]);
  db.gifts.push({
    id: 'gift_seed1',
    liveId: live1.id,
    senderId: listener.id,
    senderName: listener.username,
    giftType: 'heart',
    amount: 25,
    timestamp: Date.now() - 60000,
  });

  db.hostRatings.push(
    {
      id: 'rating_seed_dj',
      hostId: dj.id,
      raterId: listener.id,
      stars: 5,
      salonId: salon1.id,
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'rating_seed_bass',
      hostId: bass.id,
      raterId: listener.id,
      stars: 4,
      salonId: salon2.id,
      timestamp: Date.now() - 172800000,
    }
  );

  seedWorldMapBots();
  ensureDemoLivesOutsideFrance(hash);
  seedBotPosts();

  followUser(listener.id, dj.id);
  followUser(listener.id, bass.id);

  // Historique messages privés de démo
  const dmSeed = [
    { from: bass.id, to: listener.id, content: 'Hey ! On écoute quoi ce soir ?', ago: 3600000 },
    { from: listener.id, to: bass.id, content: 'Je suis sur la carte, je te rejoins !', ago: 3500000 },
    { from: dj.id, to: listener.id, content: 'Bienvenue sur OnScen 🎵', ago: 7200000 },
    { from: listener.id, to: dj.id, content: 'Merci DJ Melody, super live !', ago: 7000000 },
    { from: dj.id, to: listener.id, content: 'Merci d\'être passé, à bientôt sur la carte', ago: 6800000 },
  ];
  for (const d of dmSeed) {
    db.directMessages.push({
      id: `dm_seed_${d.from}_${d.ago}`,
      senderId: d.from,
      receiverId: d.to,
      content: d.content,
      timestamp: Date.now() - d.ago,
      accepted: true,
    });
  }

  console.log('[msdev] Données de démo chargées');
  console.log('[msdev] Connexion: listener@msdev.local / msdev123');
}

/** Lives de démo hors France (Bruxelles, Genève) si aucun live actif n'est détecté hors FR. */
function ensureDemoLivesOutsideFrance(passwordHash: string): void {
  const active = [...db.lives.values()].filter((l) => l.isActive);
  const hasForeign = active.some((l) => {
    const host = db.users.get(l.hostId);
    const country = resolveLiveCountry(l.latitude, l.longitude, host?.city);
    return country != null && country.code !== FRANCE_COUNTRY_CODE;
  });
  if (hasForeign) return;

  const demos: Array<{
    id: string;
    username: string;
    email: string;
    city: string;
    lat: number;
    lon: number;
    title: string;
    viewers: number;
  }> = [
    {
      id: 'user_live_be',
      username: 'Bruxelles Beats',
      email: 'bruxelles@msdev.local',
      city: 'Brussels',
      lat: 50.8503,
      lon: 4.3517,
      title: 'Live Bruxelles',
      viewers: 12,
    },
    {
      id: 'user_live_ch',
      username: 'Geneva Groove',
      email: 'geneva@msdev.local',
      city: 'Geneva',
      lat: 46.2044,
      lon: 6.1432,
      title: 'Live Genève',
      viewers: 9,
    },
  ];

  for (const d of demos) {
    if (db.users.has(d.id)) continue;
    const user: User = {
      id: d.id,
      username: d.username,
      email: d.email,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(d.username)}`,
      meloCoins: 120,
      isGhostMode: false,
      age: MSDEV_DEMO_AGE,
      city: d.city,
      lastSeenAt: Date.now(),
      connectedPlatforms: ['youtube'],
      listeningRole: 'host',
      favoritesCountOverride: d.id === 'user_live_be' ? 1_200 : 900,
    };
    user.latitude = d.lat;
    user.longitude = d.lon;
    refreshUserPublicCoords(user);
    db.users.set(user.id, user);

    const live: Live = {
      id: `live_${d.id}`,
      hostId: user.id,
      hostName: user.username,
      title: d.title,
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'demo',
        title: DEFAULT_PLAYBACK_SESSION_TITLE,
        artist: user.username,
        albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
      },
      latitude: d.lat,
      longitude: d.lon,
      blurredLatitude: blurCoordinate(d.lat),
      blurredLongitude: blurCoordinate(d.lon),
      viewersCount: d.viewers,
      isActive: true,
      startedAt: Date.now() - 120000,
    };
    db.lives.set(live.id, live);
    db.liveChats.set(live.id, []);
    db.liveBans.set(live.id, new Map());

    const salon: Salon = {
      id: `salon_${d.id}`,
      hostId: user.id,
      hostName: user.username,
      hostAvatarUrl: user.avatarUrl,
      title: `${d.title} — salon`,
      platform: 'youtube',
      playbackState: live.playbackState,
      latitude: d.lat,
      longitude: d.lon,
      blurredLatitude: blurCoordinate(d.lat),
      blurredLongitude: blurCoordinate(d.lon),
      listenersCount: d.id === 'user_live_be' ? 6 : 4,
      isGhostMode: false,
      isPublic: true,
      accessMode: 'public',
      allowedUserIds: [user.id],
      allowQueue: false,
      createdAt: Date.now(),
    };
    db.salons.set(salon.id, salon);
    ensureSalonQueue(salon.id);
    ensureSalonProposals(salon.id);
  }
}
