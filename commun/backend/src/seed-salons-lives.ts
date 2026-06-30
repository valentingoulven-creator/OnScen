import { db, type Live, type Salon, type User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';

export const SALON_LIVE_ID_PREFIX = 'prod-seed-';

/** Le Crès (Hérault) — centre carte test production. */
export const LE_CRES_CENTER = { lat: 43.6489, lng: 3.9394, label: 'Le Crès, France' };

export interface SalonLiveBotSeed {
  userId: string;
  username: string;
  city: string;
  lat: number;
  lng: number;
  genres: string[];
  salonId: string;
  salonTitle: string;
  liveTitle?: string;
  withLive: boolean;
  trackTitle: string;
  artist: string;
  trackId: string;
}

/** 10 salons + 5 lives — France, dominante Le Crès / Occitanie. */
export const SALON_LIVE_BOT_SEEDS: SalonLiveBotSeed[] = [
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-dj-cres`,
    username: 'DJ_Cres',
    city: 'Le Crès',
    lat: 43.6492,
    lng: 3.9388,
    genres: ['Électro', 'House', 'French Touch'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-dj-cres`,
    salonTitle: 'Salon French Touch — Le Crès',
    liveTitle: 'Live DJ Set — Le Crès',
    withLive: true,
    trackTitle: 'Get Lucky',
    artist: 'Daft Punk',
    trackId: '5NV6RXX0i0I',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-luna-mtp`,
    username: 'Luna_MTP',
    city: 'Montpellier',
    lat: 43.6108,
    lng: 3.8767,
    genres: ['Électro', 'Techno', 'House'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-luna-mtp`,
    salonTitle: 'Nuit Électro — Montpellier',
    liveTitle: 'Live Techno — Montpellier',
    withLive: true,
    trackTitle: 'Strobe',
    artist: 'deadmau5',
    trackId: 'jfaD3P3N0v4',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-soul-lattes`,
    username: 'SoulLattes',
    city: 'Lattes',
    lat: 43.5675,
    lng: 3.9045,
    genres: ['Soul', 'Jazz', 'R&B'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-soul-lattes`,
    salonTitle: 'Jazz & Soul Lounge — Lattes',
    liveTitle: 'Live Soul Session — Lattes',
    withLive: true,
    trackTitle: 'Valerie',
    artist: 'Amy Winehouse',
    trackId: 'j8K31XyZ0v4',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-beat-castel`,
    username: 'BeatCastel',
    city: 'Castelnau-le-Lez',
    lat: 43.6347,
    lng: 3.8979,
    genres: ['Hip-Hop', 'Rap', 'Trap'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-beat-castel`,
    salonTitle: 'Hip-Hop Session — Castelnau',
    liveTitle: 'Live Rap — Castelnau-le-Lez',
    withLive: true,
    trackTitle: 'HUMBLE.',
    artist: 'Kendrick Lamar',
    trackId: 'tvTRZ0-26n0',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-indie-mau`,
    username: 'IndieMau',
    city: 'Mauguio',
    lat: 43.6177,
    lng: 4.0083,
    genres: ['Indie', 'Pop', 'Rock'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-indie-mau`,
    salonTitle: 'Indie Vibes — Mauguio',
    liveTitle: 'Live Indie Night — Mauguio',
    withLive: true,
    trackTitle: 'Mr. Brightside',
    artist: 'The Killers',
    trackId: 'gGdGFtwCNBE',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-acoustic-nimes`,
    username: 'AcousticNimes',
    city: 'Nîmes',
    lat: 43.8367,
    lng: 4.3601,
    genres: ['Folk', 'Acoustic', 'Chanson'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-acoustic-nimes`,
    salonTitle: 'Acoustic Live — Nîmes',
    withLive: false,
    trackTitle: 'Fast Car',
    artist: 'Tracy Chapman',
    trackId: 'AIOAlaENplA',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-pop-sete`,
    username: 'PopSete',
    city: 'Sète',
    lat: 43.4058,
    lng: 3.6967,
    genres: ['Pop', 'Dance', 'Disco'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-pop-sete`,
    salonTitle: 'Pop Party — Sète',
    withLive: false,
    trackTitle: 'Levitating',
    artist: 'Dua Lipa',
    trackId: 'TUVcZfQea-Y',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-deep-perpignan`,
    username: 'DeepPerpignan',
    city: 'Perpignan',
    lat: 42.6887,
    lng: 2.8948,
    genres: ['Deep House', 'Électro', 'Ambient'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-deep-perpignan`,
    salonTitle: 'Deep House — Roussillon',
    withLive: false,
    trackTitle: 'Midnight City',
    artist: 'M83',
    trackId: 'dX3kQ8LZX0g',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-electro-lyon`,
    username: 'ElectroLyon',
    city: 'Lyon',
    lat: 45.764,
    lng: 4.8357,
    genres: ['Électro', 'House', 'Funk'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-electro-lyon`,
    salonTitle: 'Session House — Lyon',
    withLive: false,
    trackTitle: 'One More Time',
    artist: 'Daft Punk',
    trackId: 'FGBhQbmrHQQ',
  },
  {
    userId: `${SALON_LIVE_ID_PREFIX}bot-funk-bdx`,
    username: 'FunkBdx',
    city: 'Bordeaux',
    lat: 44.8378,
    lng: -0.5792,
    genres: ['Funk', 'Soul', 'Disco'],
    salonId: `${SALON_LIVE_ID_PREFIX}salon-funk-bdx`,
    salonTitle: 'Funk & Groove — Bordeaux',
    withLive: false,
    trackTitle: 'Uptown Funk',
    artist: 'Bruno Mars',
    trackId: 'OPf0YbXqDm0',
  },
];

function stableProgressMs(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 20_000 + (Math.abs(h) % 160_000);
}

function makeBotUser(seed: SalonLiveBotSeed): User {
  const now = Date.now();
  const user: User = {
    id: seed.userId,
    username: seed.username,
    email: `${seed.userId}@bot.melosong.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(seed.userId),
    meloCoins: 0,
    isGhostMode: false,
    favoriteGenres: seed.genres,
    city: seed.city,
    listeningRole: seed.withLive ? 'host' : 'les_deux',
    connectedPlatforms: ['youtube'],
    latitude: seed.lat,
    longitude: seed.lng,
    lastSeenAt: now,
    memberSince: now - 7 * 86_400_000,
    accountStatus: 'active',
  };
  refreshUserPublicCoords(user);
  return user;
}

function makeSalon(seed: SalonLiveBotSeed, user: User): Salon {
  const now = Date.now();
  const progressMs = stableProgressMs(seed.salonId);
  const lat = seed.lat;
  const lng = seed.lng;
  return {
    id: seed.salonId,
    hostId: user.id,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title: seed.salonTitle,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: seed.trackId,
      title: seed.trackTitle,
      artist: seed.artist,
      albumArtUrl: `https://img.youtube.com/vi/${seed.trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs,
      updatedAt: now,
      startedAt: now - progressMs,
      externalUrl: buildPlatformTrackUrl('youtube', seed.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    listenersCount: 4 + (stableProgressMs(seed.userId) % 22),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [user.id],
    allowQueue: true,
    createdAt: now - stableProgressMs(seed.salonId) % 3_600_000,
  };
}

function makeLive(seed: SalonLiveBotSeed, user: User, salon: Salon): Live {
  const now = Date.now();
  const liveId = `${SALON_LIVE_ID_PREFIX}live-${seed.userId.replace(SALON_LIVE_ID_PREFIX, '')}`;
  return {
    id: liveId,
    salonId: salon.id,
    hostId: user.id,
    hostName: user.username,
    title: seed.liveTitle ?? `Live — ${seed.salonTitle}`,
    platform: 'youtube',
    playbackState: salon.playbackState,
    latitude: salon.latitude,
    longitude: salon.longitude,
    blurredLatitude: salon.blurredLatitude,
    blurredLongitude: salon.blurredLongitude,
    viewersCount: 6 + (stableProgressMs(liveId) % 38),
    isActive: true,
    startedAt: now - 600_000 - (stableProgressMs(liveId) % 1_800_000),
    cameraActive: true,
  };
}

export interface SeedSalonsLivesResult {
  usersCreated: number;
  usersUpdated: number;
  salonsCreated: number;
  livesCreated: number;
  salons: Array<{ id: string; title: string; host: string; city: string }>;
  lives: Array<{ id: string; title: string; host: string; city: string }>;
}

/** Idempotent : injecte 10 salons + 5 lives (bots hôtes) en mémoire. */
export function seedProductionSalonsLives(): SeedSalonsLivesResult {
  const result: SeedSalonsLivesResult = {
    usersCreated: 0,
    usersUpdated: 0,
    salonsCreated: 0,
    livesCreated: 0,
    salons: [],
    lives: [],
  };

  for (const seed of SALON_LIVE_BOT_SEEDS) {
    let user = db.users.get(seed.userId);
    if (!user) {
      user = makeBotUser(seed);
      db.users.set(seed.userId, user);
      result.usersCreated++;
    } else {
      user.latitude = seed.lat;
      user.longitude = seed.lng;
      user.city = seed.city;
      user.listeningRole = seed.withLive ? 'host' : 'les_deux';
      if (!user.connectedPlatforms?.includes('youtube')) {
        user.connectedPlatforms = [...(user.connectedPlatforms ?? []), 'youtube'];
      }
      refreshUserPublicCoords(user);
      db.users.set(seed.userId, user);
      result.usersUpdated++;
    }

    if (!db.salons.has(seed.salonId)) {
      const salon = makeSalon(seed, user);
      db.salons.set(seed.salonId, salon);
      ensureSalonQueue(seed.salonId);
      ensureSalonProposals(seed.salonId);
      if (!db.salonChats.has(seed.salonId)) db.salonChats.set(seed.salonId, []);
      result.salonsCreated++;
    }

    result.salons.push({
      id: seed.salonId,
      title: seed.salonTitle,
      host: user.username,
      city: seed.city,
    });

    if (seed.withLive && seed.liveTitle) {
      const liveId = `${SALON_LIVE_ID_PREFIX}live-${seed.userId.replace(SALON_LIVE_ID_PREFIX, '')}`;
      if (!db.lives.has(liveId)) {
        const salon = db.salons.get(seed.salonId)!;
        const live = makeLive(seed, user, salon);
        db.lives.set(liveId, live);
        if (!db.liveChats.has(liveId)) db.liveChats.set(liveId, []);
        result.livesCreated++;
      }
      const live = db.lives.get(liveId)!;
      result.lives.push({
        id: live.id,
        title: live.title,
        host: user.username,
        city: seed.city,
      });
    }
  }

  return result;
}
