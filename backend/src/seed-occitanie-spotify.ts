import { db, type Salon, type User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import { isLocalDevEnvironment } from './seed-bots';

/** Préfixe IDs salons Occitanie (persistés PostgreSQL via pgSalonsLives). */
export const OCCITANIE_SALON_ID_PREFIX = 'salon_soundy_occitanie_';

/** Préfixe IDs utilisateurs bots Occitanie. */
export const OCCITANIE_USER_ID_PREFIX = 'soundy_occitanie_';

export interface OccitanieSpotifyBotSeed {
  slug: string;
  city: string;
  lat: number;
  lng: number;
  offsetLat: number;
  offsetLng: number;
  genres: string[];
  salonTitle: string;
  trackTitle: string;
  artist: string;
  trackId: string;
  albumArtUrl: string;
}

/** 10 villes Occitanie — centres réalistes + léger décalage par utilisateur. */
export const OCCITANIE_SPOTIFY_BOT_SEEDS: OccitanieSpotifyBotSeed[] = [
  {
    slug: 'toulouse',
    city: 'Toulouse',
    lat: 43.6047,
    lng: 1.4442,
    offsetLat: 0.002,
    offsetLng: -0.001,
    genres: ['Électro', 'French Touch', 'House'],
    salonTitle: 'Salon French Touch — Toulouse',
    trackTitle: 'Get Lucky',
    artist: 'Daft Punk',
    trackId: '69kOkLUCkxIZYdfIzTdq34',
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
  },
  {
    slug: 'mpm',
    city: 'Montpellier',
    lat: 43.6108,
    lng: 3.8767,
    offsetLat: -0.0015,
    offsetLng: 0.002,
    genres: ['Électro', 'Techno', 'House'],
    salonTitle: 'Nuit Électro — Montpellier',
    trackTitle: 'Midnight City',
    artist: 'M83',
    trackId: '2P91MQbaiQKBR4c9sEgqsl',
    albumArtUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
  },
  {
    slug: 'perpignan',
    city: 'Perpignan',
    lat: 42.6986,
    lng: 2.8956,
    offsetLat: 0.001,
    offsetLng: 0.0015,
    genres: ['Deep House', 'Électro', 'Ambient'],
    salonTitle: 'Deep House — Roussillon',
    trackTitle: 'One More Time',
    artist: 'Daft Punk',
    trackId: '0DiWol3u6YyIcAZPd8w7au',
    albumArtUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
  },
  {
    slug: 'nimes',
    city: 'Nîmes',
    lat: 43.8367,
    lng: 4.3601,
    offsetLat: -0.002,
    offsetLng: 0.001,
    genres: ['Pop', 'Indie', 'Soul'],
    salonTitle: 'Session Indie — Nîmes',
    trackTitle: 'Anti-Hero',
    artist: 'Taylor Swift',
    trackId: '0V3wPSX9ygBnCm8psDIegu',
    albumArtUrl: 'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=400',
  },
  {
    slug: 'carcassonne',
    city: 'Carcassonne',
    lat: 43.213,
    lng: 2.3491,
    offsetLat: 0.0015,
    offsetLng: -0.002,
    genres: ['Jazz', 'Soul', 'Chanson'],
    salonTitle: 'Jazz Lounge — Carcassonne',
    trackTitle: 'So What',
    artist: 'Miles Davis',
    trackId: '0B0ypvCDmWdAXl7I0Paz0h',
    albumArtUrl: 'https://images.unsplash.com/photo-1511379938541-c1f69419868d?w=400',
  },
  {
    slug: 'albi',
    city: 'Albi',
    lat: 43.9263,
    lng: 2.148,
    offsetLat: -0.001,
    offsetLng: 0.002,
    genres: ['Folk', 'Acoustic', 'Chanson'],
    salonTitle: 'Acoustic Session — Albi',
    trackTitle: 'Fast Car',
    artist: 'Tracy Chapman',
    trackId: '5F0m8WAC7JnT0Gz0B1uFAM',
    albumArtUrl: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=400',
  },
  {
    slug: 'rodez',
    city: 'Rodez',
    lat: 44.3506,
    lng: 2.575,
    offsetLat: 0.0025,
    offsetLng: -0.001,
    genres: ['Rock', 'Indie', 'Pop'],
    salonTitle: 'Indie Vibes — Rodez',
    trackTitle: 'Mr. Brightside',
    artist: 'The Killers',
    trackId: '0eGsygTp906u18L0Oimnem',
    albumArtUrl: 'https://images.unsplash.com/photo-1514320291840-75555eae4f8f?w=400',
  },
  {
    slug: 'tarbes',
    city: 'Tarbes',
    lat: 43.2333,
    lng: 0.0833,
    offsetLat: -0.002,
    offsetLng: 0.0015,
    genres: ['Hip-Hop', 'Rap', 'R&B'],
    salonTitle: 'Hip-Hop Session — Tarbes',
    trackTitle: 'HUMBLE.',
    artist: 'Kendrick Lamar',
    trackId: '7KXjTSCq5nL1Lo92L9Awj4',
    albumArtUrl: 'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=400',
  },
  {
    slug: 'auch',
    city: 'Auch',
    lat: 43.6464,
    lng: 0.5867,
    offsetLat: 0.001,
    offsetLng: -0.002,
    genres: ['Funk', 'Soul', 'Disco'],
    salonTitle: 'Funk & Groove — Auch',
    trackTitle: 'Uptown Funk',
    artist: 'Bruno Mars',
    trackId: '32OlwWuMpZ6b0aN2RZOeMS',
    albumArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
  },
  {
    slug: 'beziers',
    city: 'Béziers',
    lat: 43.3472,
    lng: 3.215,
    offsetLat: -0.0015,
    offsetLng: -0.001,
    genres: ['Pop', 'Dance', 'Électro'],
    salonTitle: 'Pop Party — Béziers',
    trackTitle: 'Blinding Lights',
    artist: 'The Weeknd',
    trackId: '0QpXHJVyTFLB8ulPRhK4Tt',
    albumArtUrl: 'https://images.unsplash.com/photo-1506157786151-6c9def9644a5?w=400',
  },
];

function stableProgressMs(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 20_000 + (Math.abs(h) % 160_000);
}

export function occitanieUserId(slug: string): string {
  return `${OCCITANIE_USER_ID_PREFIX}${slug}`;
}

export function occitanieSalonId(slug: string): string {
  return `${OCCITANIE_SALON_ID_PREFIX}${slug}`;
}

function makeBotUser(seed: OccitanieSpotifyBotSeed): User {
  const userId = occitanieUserId(seed.slug);
  const lat = seed.lat + seed.offsetLat;
  const lng = seed.lng + seed.offsetLng;
  const now = Date.now();
  const user: User = {
    id: userId,
    username: userId,
    email: `${userId}@bot.melosong.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    favoriteGenres: seed.genres,
    city: seed.city,
    listeningRole: 'host',
    connectedPlatforms: ['spotify'],
    latitude: lat,
    longitude: lng,
    lastSeenAt: now,
    memberSince: now - 14 * 86_400_000,
    accountStatus: 'active',
  };
  refreshUserPublicCoords(user);
  return user;
}

function makeSalon(seed: OccitanieSpotifyBotSeed, user: User): Salon {
  const salonId = occitanieSalonId(seed.slug);
  const now = Date.now();
  const progressMs = stableProgressMs(salonId);
  const lat = seed.lat + seed.offsetLat;
  const lng = seed.lng + seed.offsetLng;
  return {
    id: salonId,
    hostId: user.id,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title: seed.salonTitle,
    platform: 'spotify',
    playbackState: {
      platform: 'spotify',
      trackId: seed.trackId,
      title: seed.trackTitle,
      artist: seed.artist,
      albumArtUrl: seed.albumArtUrl,
      isPlaying: true,
      progressMs,
      updatedAt: now,
      startedAt: now - progressMs,
      externalUrl: buildPlatformTrackUrl('spotify', seed.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    listenersCount: 5 + (stableProgressMs(user.id) % 18),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [user.id],
    allowQueue: true,
    createdAt: now - (stableProgressMs(salonId) % 3_600_000),
  };
}

export interface SeedOccitanieSpotifyResult {
  usersCreated: number;
  usersUpdated: number;
  salonsCreated: number;
  salons: Array<{ id: string; title: string; host: string; city: string; platform: string }>;
}

/** Idempotent : injecte utilisateurs + salons Spotify publics en Occitanie. */
export function seedOccitanieSpotifySalons(): SeedOccitanieSpotifyResult {
  const result: SeedOccitanieSpotifyResult = {
    usersCreated: 0,
    usersUpdated: 0,
    salonsCreated: 0,
    salons: [],
  };

  for (const seed of OCCITANIE_SPOTIFY_BOT_SEEDS) {
    const userId = occitanieUserId(seed.slug);
    let user = db.users.get(userId);
    if (!user) {
      user = makeBotUser(seed);
      db.users.set(userId, user);
      result.usersCreated++;
    } else {
      const lat = seed.lat + seed.offsetLat;
      const lng = seed.lng + seed.offsetLng;
      user.latitude = lat;
      user.longitude = lng;
      user.city = seed.city;
      user.listeningRole = 'host';
      user.isGhostMode = false;
      if (!user.connectedPlatforms?.includes('spotify')) {
        user.connectedPlatforms = [...(user.connectedPlatforms ?? []), 'spotify'];
      }
      refreshUserPublicCoords(user);
      db.users.set(userId, user);
      result.usersUpdated++;
    }

    const salonId = occitanieSalonId(seed.slug);
    if (!db.salons.has(salonId)) {
      const salon = makeSalon(seed, user);
      db.salons.set(salonId, salon);
      ensureSalonQueue(salonId);
      ensureSalonProposals(salonId);
      if (!db.salonChats.has(salonId)) db.salonChats.set(salonId, []);
      result.salonsCreated++;
    }

    result.salons.push({
      id: salonId,
      title: seed.salonTitle,
      host: user.username,
      city: seed.city,
      platform: 'spotify',
    });
  }

  return result;
}

/** Seed au démarrage msdev / dev local (idempotent). */
export function seedOccitanieSpotifyAtStartup(): void {
  if (!isLocalDevEnvironment()) return;
  const result = seedOccitanieSpotifySalons();
  if (result.usersCreated > 0 || result.salonsCreated > 0) {
    console.log(
      `[melosong] Occitanie Spotify : ${result.usersCreated} utilisateur(s), ${result.salonsCreated} salon(s) créés`
    );
  }
}
