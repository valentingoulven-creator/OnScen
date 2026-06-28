import { db, type FeedPost, type Live, type MusicPlatform, type Salon, type User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import { isLocalDevEnvironment } from './seed-bots';
import { POPULATED_CITIES, type PopulatedCity } from './lib/botPopulatedCities';
import { schedulePersist } from './lib/persist';

/** Préfixe IDs salons monde (persistés PostgreSQL via pgSalonsLives). */
export const WORLD_SALON_ID_PREFIX = 'salon_soundy_world_';

/** Préfixe IDs lives monde. */
export const WORLD_LIVE_ID_PREFIX = 'live_soundy_world_';

/** Préfixe IDs utilisateurs bots salons. */
export const WORLD_USER_SALON_PREFIX = 'soundy_world_salon_';

/** Préfixe IDs utilisateurs bots lives autonomes. */
export const WORLD_USER_LIVE_PREFIX = 'soundy_world_live_';

/** Préfixe IDs utilisateurs bots événements feed. */
export const WORLD_USER_EVENT_PREFIX = 'soundy_world_event_';

/** Préfixe publications événement feed monde. */
export const WORLD_EVENT_POST_ID_PREFIX = 'feed-world-event-';

export const WORLD_SALON_COUNT = 20;
export const WORLD_LIVE_COUNT = 20;
export const WORLD_LINKED_LIVE_COUNT = 12;
export const WORLD_STANDALONE_LIVE_COUNT = WORLD_LIVE_COUNT - WORLD_LINKED_LIVE_COUNT;
export const WORLD_EVENT_COUNT = 50;

const GENRES_POOL = [
  ['Électro', 'House', 'Techno'],
  ['Pop', 'Indie', 'Rock'],
  ['Hip-Hop', 'Rap', 'R&B'],
  ['Jazz', 'Soul', 'Funk'],
  ['Deep House', 'French Touch', 'Disco'],
  ['Lo-Fi', 'Ambient', 'Chill'],
  ['Reggae', 'Latin', 'World'],
  ['Metal', 'Punk', 'Alternative'],
];

const YOUTUBE_TRACKS = [
  { title: 'Get Lucky', artist: 'Daft Punk', trackId: '5NV6RXX0i0I' },
  { title: 'Strobe', artist: 'deadmau5', trackId: 'jfaD3P3N0v4' },
  { title: 'Never Gonna Give You Up', artist: 'Rick Astley', trackId: 'dQw4w9WgXcQ' },
  { title: 'Midnight City', artist: 'M83', trackId: 'dX3kQ8LZX0g' },
  { title: 'Uptown Funk', artist: 'Bruno Mars', trackId: 'OPf0YbXqDm0' },
  { title: 'Levitating', artist: 'Dua Lipa', trackId: 'TUVcZfQea-Y' },
];

const EVENT_TYPES: Array<'dance' | 'chant' | 'autre'> = ['dance', 'chant', 'autre'];

const EVENT_VENUE_SUFFIXES = [
  'Music Hall',
  'Open Air Stage',
  'Jazz Club',
  'Arena',
  'Rooftop Sessions',
  'Underground',
  'Festival Grounds',
  'Concert Hall',
];

const EVENT_CONTENT_TEMPLATES = [
  (city: string, venue: string) =>
    `Soirée live à ${venue} — découvertes locales et sets invités à ${city}.`,
  (city: string, venue: string) =>
    `Festival open air : ${venue}, ${city}. Line-up international, danse et good vibes.`,
  (city: string, venue: string) =>
    `Session acoustique intimiste au ${venue} — chanson et reprises à ${city}.`,
  (city: string, venue: string) =>
    `Nuit électro au ${venue} (${city}) : house, techno et visuals.`,
  (city: string, venue: string) =>
    `Jam communautaire Soundly — ${venue}, ${city}. Venez avec votre instrument !`,
];

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  'https://images.unsplash.com/photo-1506157786151-6c9def9644a5?w=600',
];

function stableHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stableProgressMs(seed: string): number {
  return 20_000 + (stableHash(seed) % 160_000);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pickCity(slot: number): { city: PopulatedCity; lat: number; lng: number } {
  const idx = stableHash(`world-city-${slot}`) % POPULATED_CITIES.length;
  const city = POPULATED_CITIES[idx]!;
  const offsetLat = ((stableHash(`olat-${slot}`) % 200) - 100) / 50_000;
  const offsetLng = ((stableHash(`olng-${slot}`) % 200) - 100) / 50_000;
  return { city, lat: city.lat + offsetLat, lng: city.lon + offsetLng };
}

export function worldSalonUserId(index: number): string {
  return `${WORLD_USER_SALON_PREFIX}${pad2(index)}`;
}

export function worldLiveUserId(index: number): string {
  return `${WORLD_USER_LIVE_PREFIX}${pad2(index)}`;
}

export function worldEventUserId(index: number): string {
  return `${WORLD_USER_EVENT_PREFIX}${pad2(index)}`;
}

export function worldSalonId(index: number): string {
  return `${WORLD_SALON_ID_PREFIX}${pad2(index)}`;
}

export function worldLiveId(index: number): string {
  return `${WORLD_LIVE_ID_PREFIX}${pad2(index)}`;
}

export function worldEventPostId(index: number): string {
  return `${WORLD_EVENT_POST_ID_PREFIX}${pad2(index)}`;
}

function pickPlatform(_slot: number): MusicPlatform {
  return 'youtube';
}

function pickTrack(_platform: MusicPlatform, slot: number) {
  const pool = YOUTUBE_TRACKS;
  return pool[stableHash(`track-${slot}`) % pool.length]!;
}

function futureEventDateIso(slot: number): string {
  const daysAhead = 1 + (stableHash(`ev-day-${slot}`) % 120);
  const hour = 17 + (stableHash(`ev-hour-${slot}`) % 6);
  const minute = (stableHash(`ev-min-${slot}`) % 4) * 15;
  const d = new Date(Date.UTC(2026, 5, 14 + daysAhead, hour, minute, 0));
  return d.toISOString();
}

function makeHostUser(
  userId: string,
  username: string,
  city: string,
  lat: number,
  lng: number,
  genres: string[],
  platform: MusicPlatform,
  listeningRole: 'host' | 'les_deux'
): User {
  const now = Date.now();
  const user: User = {
    id: userId,
    username,
    email: `${userId}@bot.melosong.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    favoriteGenres: genres,
    city,
    listeningRole,
    connectedPlatforms: [platform],
    latitude: lat,
    longitude: lng,
    lastSeenAt: now,
    memberSince: now - 21 * 86_400_000,
    accountStatus: 'active',
  };
  refreshUserPublicCoords(user);
  return user;
}

function makeSalon(
  salonId: string,
  user: User,
  title: string,
  platform: MusicPlatform,
  track: { title: string; artist: string; trackId: string },
  lat: number,
  lng: number
): Salon {
  const now = Date.now();
  const progressMs = stableProgressMs(salonId);
  const albumArtUrl =
    platform === 'youtube'
      ? `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400';
  return {
    id: salonId,
    hostId: user.id,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title,
    platform,
    playbackState: {
      platform,
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      albumArtUrl,
      isPlaying: true,
      progressMs,
      updatedAt: now,
      startedAt: now - progressMs,
      externalUrl: buildPlatformTrackUrl(platform, track.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    listenersCount: 4 + (stableProgressMs(user.id) % 28),
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [user.id],
    allowQueue: true,
    createdAt: now - (stableProgressMs(salonId) % 4_800_000),
  };
}

function makeLive(
  liveId: string,
  user: User,
  title: string,
  platform: MusicPlatform,
  playbackState: Live['playbackState'],
  lat: number,
  lng: number,
  salonId?: string
): Live {
  const now = Date.now();
  const blurredLat = blurCoordinate(lat);
  const blurredLng = blurCoordinate(lng);
  return {
    id: liveId,
    ...(salonId ? { salonId } : {}),
    hostId: user.id,
    hostName: user.username,
    title,
    platform,
    playbackState,
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurredLat,
    blurredLongitude: blurredLng,
    viewersCount: 6 + (stableProgressMs(liveId) % 42),
    isActive: true,
    startedAt: now - 900_000 - (stableProgressMs(liveId) % 2_400_000),
    cameraActive: true,
  };
}

function upsertHostUser(
  userId: string,
  username: string,
  city: string,
  lat: number,
  lng: number,
  genres: string[],
  platform: MusicPlatform,
  listeningRole: 'host' | 'les_deux',
  stats: { usersCreated: number; usersUpdated: number }
): User {
  let user = db.users.get(userId);
  if (!user) {
    user = makeHostUser(userId, username, city, lat, lng, genres, platform, listeningRole);
    db.users.set(userId, user);
    stats.usersCreated++;
  } else {
    user.latitude = lat;
    user.longitude = lng;
    user.city = city;
    user.isGhostMode = false;
    user.listeningRole = listeningRole;
    if (!user.connectedPlatforms?.includes(platform)) {
      user.connectedPlatforms = [...(user.connectedPlatforms ?? []), platform];
    }
    refreshUserPublicCoords(user);
    db.users.set(userId, user);
    stats.usersUpdated++;
  }
  return user;
}

export interface SeedWorldRandomResult {
  usersCreated: number;
  usersUpdated: number;
  salonsCreated: number;
  livesCreated: number;
  eventsCreated: number;
  uniqueCities: number;
  salons: Array<{ id: string; title: string; host: string; city: string; platform: string }>;
  lives: Array<{ id: string; title: string; host: string; city: string; linkedSalon: boolean }>;
  events: number;
}

/** Idempotent : 20 salons + 20 lives + 50 événements feed dans des villes mondiales. */
export function seedWorldRandomData(): SeedWorldRandomResult {
  const result: SeedWorldRandomResult = {
    usersCreated: 0,
    usersUpdated: 0,
    salonsCreated: 0,
    livesCreated: 0,
    eventsCreated: 0,
    uniqueCities: 0,
    salons: [],
    lives: [],
    events: 0,
  };

  const citySlotsUsed = new Set<string>();

  for (let i = 1; i <= WORLD_SALON_COUNT; i++) {
    const slot = i;
    const { city, lat, lng } = pickCity(slot);
    citySlotsUsed.add(city.name);
    const platform = pickPlatform(slot);
    const track = pickTrack(platform, slot);
    const genres = GENRES_POOL[(slot - 1) % GENRES_POOL.length]!;
    const userId = worldSalonUserId(i);
    const salonId = worldSalonId(i);
    const user = upsertHostUser(
      userId,
      userId,
      city.name,
      lat,
      lng,
      genres,
      platform,
      'host',
      result
    );

    const salonTitle = `${genres[0]} Session — ${city.name}`;
    if (!db.salons.has(salonId)) {
      const salon = makeSalon(salonId, user, salonTitle, platform, track, lat, lng);
      db.salons.set(salonId, salon);
      ensureSalonQueue(salonId);
      ensureSalonProposals(salonId);
      if (!db.salonChats.has(salonId)) db.salonChats.set(salonId, []);
      result.salonsCreated++;
    }

    result.salons.push({
      id: salonId,
      title: salonTitle,
      host: user.username,
      city: city.name,
      platform,
    });
  }

  for (let i = 1; i <= WORLD_LIVE_COUNT; i++) {
    const liveId = worldLiveId(i);
    const linked = i <= WORLD_LINKED_LIVE_COUNT;
    let user: User;
    let lat: number;
    let lng: number;
    let cityName: string;
    let platform: MusicPlatform;
    let playbackState: Live['playbackState'];
    let salonId: string | undefined;

    if (linked) {
      const salon = db.salons.get(worldSalonId(i))!;
      const host = db.users.get(salon.hostId)!;
      user = host;
      lat = salon.latitude;
      lng = salon.longitude;
      cityName = host.city ?? pickCity(i).city.name;
      platform = salon.platform;
      playbackState = salon.playbackState;
      salonId = salon.id;
    } else {
      const standaloneIdx = i - WORLD_LINKED_LIVE_COUNT;
      const slot = 100 + standaloneIdx;
      const picked = pickCity(slot);
      citySlotsUsed.add(picked.city.name);
      cityName = picked.city.name;
      lat = picked.lat;
      lng = picked.lng;
      platform = pickPlatform(slot);
      const track = pickTrack(platform, slot);
      const genres = GENRES_POOL[(standaloneIdx - 1) % GENRES_POOL.length]!;
      const userId = worldLiveUserId(standaloneIdx);
      user = upsertHostUser(
        userId,
        userId,
        cityName,
        lat,
        lng,
        genres,
        platform,
        'host',
        result
      );
      playbackState = {
        platform,
        trackId: track.trackId,
        title: track.title,
        artist: track.artist,
        albumArtUrl:
          platform === 'youtube'
            ? `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`
            : 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
        isPlaying: true,
        progressMs: stableProgressMs(liveId),
        updatedAt: Date.now(),
        externalUrl: buildPlatformTrackUrl(platform, track.trackId),
      };
    }

    const liveTitle = linked
      ? `Live — ${result.salons[i - 1]?.title ?? cityName}`
      : `Live Stream — ${cityName}`;

    if (!db.lives.has(liveId)) {
      const live = makeLive(liveId, user, liveTitle, platform, playbackState, lat, lng, salonId);
      db.lives.set(liveId, live);
      if (!db.liveChats.has(liveId)) db.liveChats.set(liveId, []);
      result.livesCreated++;
    }

    result.lives.push({
      id: liveId,
      title: liveTitle,
      host: user.username,
      city: cityName,
      linkedSalon: linked,
    });
  }

  const existingEventIds = new Set(
    db.feedPosts.filter((p) => p.id.startsWith(WORLD_EVENT_POST_ID_PREFIX)).map((p) => p.id)
  );
  const now = Date.now();
  let eventsCreated = 0;

  for (let i = 1; i <= WORLD_EVENT_COUNT; i++) {
    const postId = worldEventPostId(i);
    if (existingEventIds.has(postId)) continue;

    const slot = 200 + i;
    const { city } = pickCity(slot);
    citySlotsUsed.add(city.name);
    const userId = worldEventUserId(i);
    const { lat, lng } = pickCity(slot);
    const genres = GENRES_POOL[(i - 1) % GENRES_POOL.length]!;
    upsertHostUser(
      userId,
      userId,
      city.name,
      lat,
      lng,
      genres,
      pickPlatform(slot),
      'les_deux',
      result
    );

    const venue = EVENT_VENUE_SUFFIXES[(i - 1) % EVENT_VENUE_SUFFIXES.length]!;
    const eventLocation = `${venue}, ${city.name}`;
    const content =
      EVENT_CONTENT_TEMPLATES[(i - 1) % EVENT_CONTENT_TEMPLATES.length]!(city.name, venue);
    const post: FeedPost = {
      id: postId,
      userId,
      content,
      imageUrl: UNSPLASH_IMAGES[(i - 1) % UNSPLASH_IMAGES.length],
      isEvent: true,
      eventDate: futureEventDateIso(i),
      eventLocation,
      eventType: EVENT_TYPES[(i - 1) % EVENT_TYPES.length],
      createdAt: now - i * 180_000,
    };
    db.feedPosts.push(post);
    eventsCreated++;
  }

  if (eventsCreated > 0) {
    schedulePersist();
  }

  result.eventsCreated = eventsCreated;
  result.events = db.feedPosts.filter((p) => p.id.startsWith(WORLD_EVENT_POST_ID_PREFIX)).length;
  result.uniqueCities = citySlotsUsed.size;

  return result;
}

/** Seed au démarrage msdev / dev local (idempotent). */
export function seedWorldRandomAtStartup(): void {
  if (!isLocalDevEnvironment()) return;
  const result = seedWorldRandomData();
  if (
    result.usersCreated > 0 ||
    result.salonsCreated > 0 ||
    result.livesCreated > 0 ||
    result.eventsCreated > 0
  ) {
    console.log(
      `[melosong] World seed : ${result.usersCreated} utilisateur(s), ${result.salonsCreated} salon(s), ${result.livesCreated} live(s), ${result.eventsCreated} événement(s) (${result.uniqueCities} villes)`
    );
  }
}
