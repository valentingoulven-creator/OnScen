import { db, type Live, type Salon, type User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import { SALON_LIVE_ID_PREFIX } from './seed-salons-lives';

export const FRANCE_RANDOM_LIVE_COUNT = 10;

/** Préfixe IDs bots lives France (persistés PostgreSQL via pgSalonsLives). */
export const FRANCE_RANDOM_ID_PREFIX = `${SALON_LIVE_ID_PREFIX}fr-`;

interface FranceRandomLiveSeed {
  slug: string;
  username: string;
  city: string;
  lat: number;
  lng: number;
  genres: string[];
  salonTitle: string;
  liveTitle: string;
  trackTitle: string;
  artist: string;
  trackId: string;
}

const FRANCE_MAJOR_CITIES: Array<Omit<FranceRandomLiveSeed, 'slug' | 'username' | 'salonTitle' | 'liveTitle'>> = [
  { city: 'Paris', lat: 48.8566, lng: 2.3522, genres: ['Électro', 'House', 'French Touch'], trackTitle: 'One More Time', artist: 'Daft Punk', trackId: 'FGBhQbmrHQQ' },
  { city: 'Lyon', lat: 45.764, lng: 4.8357, genres: ['Techno', 'House', 'Électro'], trackTitle: 'Strobe', artist: 'deadmau5', trackId: 'jfaD3P3N0v4' },
  { city: 'Marseille', lat: 43.2965, lng: 5.3698, genres: ['Hip-Hop', 'Rap', 'R&B'], trackTitle: 'HUMBLE.', artist: 'Kendrick Lamar', trackId: 'tvTRZ0-26n0' },
  { city: 'Montpellier', lat: 43.6108, lng: 3.8767, genres: ['Électro', 'Techno', 'House'], trackTitle: 'Get Lucky', artist: 'Daft Punk', trackId: '5NV6RXX0i0I' },
  { city: 'Bordeaux', lat: 44.8378, lng: -0.5792, genres: ['Funk', 'Soul', 'Disco'], trackTitle: 'Uptown Funk', artist: 'Bruno Mars', trackId: 'OPf0YbXqDm0' },
  { city: 'Toulouse', lat: 43.6047, lng: 1.4442, genres: ['Pop', 'Indie', 'Rock'], trackTitle: 'Mr. Brightside', artist: 'The Killers', trackId: 'gGdGFtwCNBE' },
  { city: 'Nice', lat: 43.7102, lng: 7.262, genres: ['Deep House', 'Électro', 'Ambient'], trackTitle: 'Midnight City', artist: 'M83', trackId: 'dX3kQ8LZX0g' },
  { city: 'Nantes', lat: 47.2184, lng: -1.5536, genres: ['Indie', 'Pop', 'Chanson'], trackTitle: 'Fast Car', artist: 'Tracy Chapman', trackId: 'AIOAlaENplA' },
  { city: 'Strasbourg', lat: 48.5734, lng: 7.7521, genres: ['Jazz', 'Soul', 'Funk'], trackTitle: 'Valerie', artist: 'Amy Winehouse', trackId: 'j8K31XyZ0v4' },
  { city: 'Lille', lat: 50.6292, lng: 3.0573, genres: ['Pop', 'Dance', 'Disco'], trackTitle: 'Levitating', artist: 'Dua Lipa', trackId: 'TUVcZfQea-Y' },
];

function stableHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stableProgressMs(seed: string): number {
  return 20_000 + (stableHash(seed) % 160_000);
}

function citySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function jitterCoords(city: string, lat: number, lng: number): { lat: number; lng: number } {
  const offsetLat = ((stableHash(`fr-jlat-${city}`) % 200) - 100) / 50_000;
  const offsetLng = ((stableHash(`fr-jlng-${city}`) % 200) - 100) / 50_000;
  return { lat: lat + offsetLat, lng: lng + offsetLng };
}

export function buildFranceRandomLiveSeeds(): FranceRandomLiveSeed[] {
  return FRANCE_MAJOR_CITIES.map((entry) => {
    const slug = citySlug(entry.city);
    const { lat, lng } = jitterCoords(entry.city, entry.lat, entry.lng);
    return {
      slug,
      username: `Live_${slug.replace(/-/g, '_')}`,
      city: entry.city,
      lat,
      lng,
      genres: entry.genres,
      salonTitle: `Salon Live — ${entry.city}`,
      liveTitle: `Live Session — ${entry.city}`,
      trackTitle: entry.trackTitle,
      artist: entry.artist,
      trackId: entry.trackId,
    };
  });
}

function seedIds(seed: FranceRandomLiveSeed) {
  const base = `${FRANCE_RANDOM_ID_PREFIX}${seed.slug}`;
  return {
    userId: `${base}-host`,
    salonId: `${base}-salon`,
    liveId: `${base}-salon`,
  };
}

function makeBotUser(seed: FranceRandomLiveSeed, userId: string): User {
  const now = Date.now();
  const user: User = {
    id: userId,
    username: seed.username,
    email: `${userId}@bot.onscen.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    favoriteGenres: seed.genres,
    city: seed.city,
    listeningRole: 'host',
    connectedPlatforms: ['youtube'],
    latitude: seed.lat,
    longitude: seed.lng,
    lastSeenAt: now,
    memberSince: now - 14 * 86_400_000,
    accountStatus: 'active',
  };
  refreshUserPublicCoords(user);
  return user;
}

function makeSalon(seed: FranceRandomLiveSeed, user: User, salonId: string): Salon {
  const now = Date.now();
  const progressMs = stableProgressMs(salonId);
  return {
    id: salonId,
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
    latitude: seed.lat,
    longitude: seed.lng,
    blurredLatitude: blurCoordinate(seed.lat),
    blurredLongitude: blurCoordinate(seed.lng),
    listenersCount: 5 + (stableProgressMs(user.id) % 24),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [user.id],
    allowQueue: true,
    createdAt: now - (stableProgressMs(salonId) % 3_600_000),
  };
}

function makeLive(seed: FranceRandomLiveSeed, user: User, salon: Salon, liveId: string): Live {
  const now = Date.now();
  return {
    id: liveId,
    salonId: salon.id,
    hostId: user.id,
    hostName: user.username,
    title: seed.liveTitle,
    platform: 'youtube',
    playbackState: salon.playbackState,
    latitude: salon.latitude,
    longitude: salon.longitude,
    blurredLatitude: salon.blurredLatitude,
    blurredLongitude: salon.blurredLongitude,
    viewersCount: 8 + (stableProgressMs(liveId) % 34),
    peakViewersCount: 8 + (stableProgressMs(liveId) % 34),
    isActive: true,
    startedAt: now - 720_000 - (stableProgressMs(liveId) % 2_100_000),
    cameraActive: true,
  };
}

export interface SeedFranceRandomLivesResult {
  usersCreated: number;
  usersUpdated: number;
  salonsCreated: number;
  livesCreated: number;
  lives: Array<{ id: string; title: string; host: string; city: string; lat: number; lng: number }>;
}

/** Idempotent : 10 lives actifs répartis dans les grandes villes françaises. */
export function seedFranceRandomLives(): SeedFranceRandomLivesResult {
  const result: SeedFranceRandomLivesResult = {
    usersCreated: 0,
    usersUpdated: 0,
    salonsCreated: 0,
    livesCreated: 0,
    lives: [],
  };

  for (const seed of buildFranceRandomLiveSeeds()) {
    const ids = seedIds(seed);
    let user = db.users.get(ids.userId);
    if (!user) {
      user = makeBotUser(seed, ids.userId);
      db.users.set(ids.userId, user);
      result.usersCreated++;
    } else {
      user.latitude = seed.lat;
      user.longitude = seed.lng;
      user.city = seed.city;
      user.listeningRole = 'host';
      if (!user.connectedPlatforms?.includes('youtube')) {
        user.connectedPlatforms = [...(user.connectedPlatforms ?? []), 'youtube'];
      }
      refreshUserPublicCoords(user);
      db.users.set(ids.userId, user);
      result.usersUpdated++;
    }

    if (!db.salons.has(ids.salonId)) {
      const salon = makeSalon(seed, user, ids.salonId);
      db.salons.set(ids.salonId, salon);
      ensureSalonQueue(ids.salonId);
      ensureSalonProposals(ids.salonId);
      if (!db.salonChats.has(ids.salonId)) db.salonChats.set(ids.salonId, []);
      result.salonsCreated++;
    } else {
      const salon = db.salons.get(ids.salonId)!;
      salon.latitude = seed.lat;
      salon.longitude = seed.lng;
      salon.blurredLatitude = blurCoordinate(seed.lat);
      salon.blurredLongitude = blurCoordinate(seed.lng);
      db.salons.set(ids.salonId, salon);
    }

    const salon = db.salons.get(ids.salonId)!;
    if (!db.lives.has(ids.liveId)) {
      const live = makeLive(seed, user, salon, ids.liveId);
      db.lives.set(ids.liveId, live);
      if (!db.liveChats.has(ids.liveId)) db.liveChats.set(ids.liveId, []);
      result.livesCreated++;
    } else {
      const live = db.lives.get(ids.liveId)!;
      live.isActive = true;
      live.latitude = seed.lat;
      live.longitude = seed.lng;
      live.blurredLatitude = blurCoordinate(seed.lat);
      live.blurredLongitude = blurCoordinate(seed.lng);
      db.lives.set(ids.liveId, live);
    }

    const live = db.lives.get(ids.liveId)!;
    result.lives.push({
      id: live.id,
      title: live.title,
      host: user.username,
      city: seed.city,
      lat: seed.lat,
      lng: seed.lng,
    });
  }

  return result;
}
