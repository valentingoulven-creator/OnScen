import { db, Salon, Live, User, FeedPost, FeedPostComment } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { getYoutubeDemoPool } from './lib/musicCatalog';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import {
  POPULATED_CITIES,
  POPULATED_CITY_TOTAL_WEIGHT,
  type PopulatedCity,
} from './lib/botPopulatedCities';

const seededCenters = new Set<string>();
let worldBulkSeeded = false;
let botFeedPostsSeeded = false;

/** Nombre cible de publications bot dans le fil Actualité. */
const BOT_FEED_POST_TARGET = 50;
const BOT_FEED_POST_ID_PREFIX = 'feed-bot-';

/** Bornes carte (legacy imports) — les bots msdev sont placés sur agglomérations, pas uniformément ici. */
export const WORLD_BOUNDS = { latMin: -85, latMax: 85, lonMin: -180, lonMax: 180 };

/** @deprecated Utiliser WORLD_BOUNDS — conservé pour compat imports. */
export const FRANCE_BOUNDS = WORLD_BOUNDS;

const NAMED_BOT_INDEX_BASE = 1_000_000;

interface BotTemplate {
  id: string;
  username: string;
  title: string;
  platform: 'youtube';
  trackTitle: string;
  artist: string;
  albumArtUrl: string;
  trackId: string;
  listenersCount: number;
  isLive?: boolean;
  /** offset en degrés (~111m par 0.001) */
  offsetLat: number;
  offsetLon: number;
}

const MAP_BOTS: BotTemplate[] = [
  {
    id: 'luna',
    username: 'Luna Beats',
    title: 'Chill Electro',
    platform: 'youtube',
    trackTitle: 'Blinding Lights',
    artist: 'The Weeknd',
    albumArtUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    trackId: 'youtube:track:bot1',
    listenersCount: 14,
    offsetLat: 0.004,
    offsetLon: 0.002,
  },
  {
    id: 'nova',
    username: 'Nova Sound',
    title: 'Indie Discovery',
    platform: 'youtube',
    trackTitle: 'Take On Me',
    artist: 'a-ha',
    albumArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    trackId: 'youtube:track:bot2',
    listenersCount: 7,
    offsetLat: -0.003,
    offsetLon: 0.004,
    isLive: true,
  },
  {
    id: 'kira',
    username: 'Kira FM',
    title: 'Lo-Fi Study',
    platform: 'youtube',
    trackTitle: 'lofi hip hop',
    artist: 'ChilledCow',
    albumArtUrl: 'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=400',
    trackId: 'jfKfPfyJRdk',
    listenersCount: 31,
    offsetLat: 0.002,
    offsetLon: -0.005,
  },
  {
    id: 'echo',
    username: 'Echo Park',
    title: 'Rock Classics',
    platform: 'youtube',
    trackTitle: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    albumArtUrl: 'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=400',
    trackId: 'youtube:track:bot4',
    listenersCount: 19,
    offsetLat: -0.005,
    offsetLon: -0.002,
  },
  {
    id: 'wave',
    username: 'Wave Rider',
    title: 'Summer Hits',
    platform: 'youtube',
    trackTitle: 'Get Lucky',
    artist: 'Daft Punk',
    albumArtUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    trackId: '5NV6RXX0i0I',
    listenersCount: 11,
    offsetLat: 0.006,
    offsetLon: -0.001,
  },
  {
    id: 'pixel',
    username: 'Pixel DJ',
    title: 'Synthwave Night',
    platform: 'youtube',
    trackTitle: 'Nightcall',
    artist: 'Kavinsky',
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    trackId: 'youtube:track:bot6',
    listenersCount: 22,
    offsetLat: -0.001,
    offsetLon: 0.006,
  },
  {
    id: 'milo',
    username: 'Milo Groove',
    title: 'Funk & Soul',
    platform: 'youtube',
    trackTitle: 'Uptown Funk',
    artist: 'Bruno Mars',
    albumArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
    trackId: 'youtube:track:bot7',
    listenersCount: 9,
    offsetLat: 0.003,
    offsetLon: 0.005,
  },
  {
    id: 'zara',
    username: 'Zara Mix',
    title: 'Pop Party',
    platform: 'youtube',
    trackTitle: 'Levitating',
    artist: 'Dua Lipa',
    albumArtUrl: 'https://images.unsplash.com/photo-1506157786151-6c9def9644a5?w=400',
    trackId: 'TUVcZfQea-Y',
    listenersCount: 16,
    offsetLat: -0.004,
    offsetLon: 0.001,
  },
];

const USERNAME_POOL = [
  'DJ Pulse', 'Neon Wave', 'Basement Beats', 'Vinyl Soul', 'Midnight Mix',
  'Groove Factory', 'Crystal Sound', 'Urban Flow', 'Deep Horizon', 'Sunset FM',
  'Bass Culture', 'Echo Chamber', 'Rhythm Lab', 'Cloud Nine', 'Stereo Heart',
  'Analog Dreams', 'Digital Soul', 'Frequency', 'Harmonic', 'Melody Lane',
  'Beat Street', 'Sound Garden', 'Wave Form', 'Tempo Shift', 'Audio Pilot',
  'Mix Master', 'Track Hunter', 'Playlist Pro', 'Jam Session', 'Live Wire',
  'Turntable', 'Subwoofer', 'Headphone', 'Amplifier', 'Synthesizer',
  'Chill Pill', 'Dance Floor', 'House Party', 'Techno Tribe', 'Jazz Cat',
  'Rock Spirit', 'Indie Kid', 'Pop Star', 'Hip Hop Head', 'Reggae Root',
  'Folk Singer', 'Classical Mind', 'Metal Head', 'Punk Rocker', 'Blues Brother',
];

const SALON_TITLES = [
  'Session du soir', 'Chill & Vibes', 'Découvertes', 'Hits du moment', 'Deep Focus',
  'Road Trip Mix', 'Afterwork', 'Weekend Party', 'Lo-Fi Corner', 'French Touch',
  'Indie Hour', 'Electro Pulse', 'Acoustic Live', 'Throwback', 'New Releases',
];

const YOUTUBE_TRACKS = getYoutubeDemoPool();

const LIVE_CAP = 80;

/** Champs communs des lives bots : pas de flux WebRTC, mais UI « caméra active » (pas d’embed YouTube en LivePage). */
function botLivePresentationFields(): Pick<Live, 'cameraActive'> {
  return { cameraActive: true };
}

function ensureBotLivesCameraActive(): void {
  for (const live of db.lives.values()) {
    if (live.isActive && live.hostId.startsWith('bot_') && !live.cameraActive) {
      live.cameraActive = true;
      db.lives.set(live.id, live);
    }
  }
}

/** Part des bots carte en live actif (MSDEV_BOT_LIVE_PERCENT ou MSDEV_BOT_LIVE_COUNT, cap 80). */
export function resolveBulkBotLiveCount(totalBots: number): number {
  if (totalBots <= 0) return 0;
  const explicit = process.env.MSDEV_BOT_LIVE_COUNT;
  if (explicit != null && explicit.trim() !== '') {
    const n = parseInt(explicit, 10);
    if (Number.isFinite(n)) return Math.min(LIVE_CAP, Math.max(0, n));
  }
  const pctRaw = parseFloat(process.env.MSDEV_BOT_LIVE_PERCENT ?? '10');
  const percent = Number.isFinite(pctRaw) && pctRaw > 0 ? pctRaw : 10;
  return Math.min(LIVE_CAP, Math.floor((totalBots * percent) / 100));
}

/** @deprecated Utiliser resolveBulkBotLiveCount */
export const resolveFranceBotLiveCount = resolveBulkBotLiveCount;

let bulkBotLiveIndexCache: { key: string; indices: Set<number> } | null = null;

function bulkBotLiveIndices(totalBots: number, liveCount: number): Set<number> {
  const key = `${totalBots}_${liveCount}`;
  if (bulkBotLiveIndexCache?.key === key) return bulkBotLiveIndexCache.indices;
  const indices = Array.from({ length: totalBots }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = botHash(i, 'live-shuffle') % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const set = new Set(indices.slice(0, liveCount));
  bulkBotLiveIndexCache = { key, indices: set };
  return set;
}

function isBulkBotLiveIndex(index: number, liveCount: number, totalBots: number): boolean {
  if (liveCount <= 0 || index >= totalBots) return false;
  return bulkBotLiveIndices(totalBots, liveCount).has(index);
}

/** Noms villes pour affichage (pool legacy). */
export const WORLD_CITIES = POPULATED_CITIES.map((c) => c.name);

export const DEFAULT_BOT_CENTER = { lat: 48.8566, lon: 2.3522 };

const BOT_JITTER_KM_MIN = 5;
const BOT_JITTER_KM_MAX = 20;

/** Nombre de bots carte en msdev (MSDEV_BOT_COUNT, défaut 10000). 0 = 8 bots Paris uniquement. */
export function getMsdevBotCount(): number {
  const raw = process.env.MSDEV_BOT_COUNT;
  if (raw === '0') return 0;
  if (raw != null && raw.trim() !== '') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (
    process.env.APP_ENV === 'msdev' ||
    process.env.MSENV === 'msdev' ||
    process.argv.includes('--msdev')
  ) {
    return 10000;
  }
  return 0;
}

/** Bots de démo sur localhost, msdev et environnement non-production */
export function isLocalDevEnvironment(): boolean {
  return (
    process.env.APP_ENV === 'msdev' ||
    process.env.MSENV === 'msdev' ||
    process.argv.includes('--msdev') ||
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_MAP_BOTS === '1'
  );
}

/** Déterministe pour re-seed idempotent */
function botHash(index: number, salt: string): number {
  let h = index ^ 0x9e3779b9;
  for (let i = 0; i < salt.length; i++) {
    h = (h * 31 + salt.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function botUnit(index: number, salt: string): number {
  return (botHash(index, salt) % 10000) / 10000;
}

function pickWeightedPopulatedCity(index: number): PopulatedCity {
  let r = botUnit(index, 'city-weight') * POPULATED_CITY_TOTAL_WEIGHT;
  for (const city of POPULATED_CITIES) {
    r -= city.weight;
    if (r <= 0) return city;
  }
  return POPULATED_CITIES[POPULATED_CITIES.length - 1];
}

/** Position déterministe près d'une agglomération (jitter 5–20 km). */
function botWorldPosition(index: number): { lat: number; lon: number; city: string } {
  const city = pickWeightedPopulatedCity(index);
  const distKm =
    BOT_JITTER_KM_MIN + botUnit(index, 'jitter-dist') * (BOT_JITTER_KM_MAX - BOT_JITTER_KM_MIN);
  const angle = botUnit(index, 'jitter-ang') * 2 * Math.PI;
  const latRad = (city.lat * Math.PI) / 180;
  const latOffset = (distKm / 111) * Math.cos(angle);
  const lonScale = Math.max(0.25, Math.cos(latRad));
  const lonOffset = (distKm / (111 * lonScale)) * Math.sin(angle);
  return {
    lat: city.lat + latOffset,
    lon: city.lon + lonOffset,
    city: city.name,
  };
}

function syncBotGeo(userId: string, lat: number, lon: number, city?: string): void {
  const user = db.users.get(userId);
  if (!user) return;

  user.latitude = lat;
  user.longitude = lon;
  if (city) user.city = city;
  refreshUserPublicCoords(user);
  db.users.set(userId, user);

  for (const salon of db.salons.values()) {
    if (salon.hostId !== userId) continue;
    salon.latitude = lat;
    salon.longitude = lon;
    salon.blurredLatitude = blurCoordinate(lat);
    salon.blurredLongitude = blurCoordinate(lon);
    db.salons.set(salon.id, salon);

    const live = db.lives.get(salon.id);
    if (live) {
      live.latitude = lat;
      live.longitude = lon;
      live.blurredLatitude = salon.blurredLatitude;
      live.blurredLongitude = salon.blurredLongitude;
      db.lives.set(salon.id, live);
    }
  }
}

/** Repositionne bots existants sur agglomérations peuplées (salons + lives suivent l’hôte). */
function repositionAllWorldBots(bulkCount: number, spreadNamedBots: boolean): void {
  for (let i = 0; i < bulkCount; i++) {
    const userId = `bot_fr_${i}`;
    if (!db.users.has(userId)) continue;
    const { lat, lon, city } = botWorldPosition(i);
    syncBotGeo(userId, lat, lon, city);
  }

  if (!spreadNamedBots) return;

  MAP_BOTS.forEach((bot, idx) => {
    const userId = `bot_${bot.id}`;
    if (!db.users.has(userId)) return;
    const { lat, lon, city } = botWorldPosition(NAMED_BOT_INDEX_BASE + idx);
    syncBotGeo(userId, lat + bot.offsetLat, lon + bot.offsetLon, city);
  });
}

function pickFromPool<T>(pool: T[], index: number, salt: string): T {
  return pool[botHash(index, salt) % pool.length];
}

function centerKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function createNamedMapBot(
  bot: BotTemplate,
  centerLat: number,
  centerLon: number,
  mapIndex: number,
  worldwide: boolean
): void {
  const userId = `bot_${bot.id}`;
  const salonId = `bot_salon_${bot.id}`;

  if (db.salons.has(salonId)) return;

  const worldPos = worldwide
    ? botWorldPosition(NAMED_BOT_INDEX_BASE + mapIndex)
    : { lat: centerLat, lon: centerLon, city: 'Paris' };
  const lat = worldPos.lat + bot.offsetLat;
  const lon = worldPos.lon + bot.offsetLon;
  const city = worldPos.city;

  const user: User = {
    id: userId,
    username: `🤖 ${bot.username}`,
    email: `${bot.id}@bot.onscen.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    latitude: lat,
    longitude: lon,
    listeningRole: 'host',
    city,
    lastSeenAt: Date.now(),
  };
  refreshUserPublicCoords(user);
  db.users.set(userId, user);

  const now = Date.now();
  const progressMs = botHash(bot.id.length, bot.id) % 120000;

  const salon: Salon = {
    id: salonId,
    hostId: userId,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title: bot.title,
    platform: bot.platform,
    playbackState: {
      platform: bot.platform,
      trackId: bot.trackId,
      title: bot.trackTitle,
      artist: bot.artist,
      albumArtUrl: bot.albumArtUrl,
      isPlaying: true,
      progressMs,
      updatedAt: now,
      startedAt: now - progressMs,
    },
    latitude: lat,
    longitude: lon,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lon),
    listenersCount: bot.listenersCount,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [userId],
    allowQueue: true,
    createdAt: Date.now(),
  };

  db.salons.set(salonId, salon);
  ensureSalonQueue(salonId);
  ensureSalonProposals(salonId);
  db.salonChats.set(salonId, [
    {
      id: `bot_msg_${bot.id}_1`,
      roomId: salonId,
      roomType: 'salon',
      senderId: userId,
      senderName: user.username,
      content: 'Bienvenue dans mon salon test ! 🎧',
      timestamp: Date.now() - 120000,
    },
    {
      id: `bot_msg_${bot.id}_2`,
      roomId: salonId,
      roomType: 'salon',
      senderId: 'bot_listener',
      senderName: 'Auditeur Bot',
      content: 'Trop bien ce morceau 🔥',
      timestamp: Date.now() - 60000,
    },
  ]);

  if (bot.isLive) {
    const live: Live = {
      id: salonId,
      salonId,
      hostId: userId,
      hostName: user.username,
      title: `Live — ${bot.title}`,
      platform: bot.platform,
      playbackState: salon.playbackState,
      latitude: lat,
      longitude: lon,
      blurredLatitude: salon.blurredLatitude,
      blurredLongitude: salon.blurredLongitude,
      viewersCount: bot.listenersCount + 5,
      isActive: true,
      startedAt: Date.now() - 600000,
      ...botLivePresentationFields(),
    };
    db.lives.set(salonId, live);
    db.liveChats.set(salonId, []);
  }
}

function createLightweightSalon(
  userId: string,
  user: User,
  lat: number,
  lon: number,
  index: number,
  withLive: boolean
): void {
  const salonId = `bot_salon_fr_${index}`;
  if (db.salons.has(salonId)) return;

  const track = pickFromPool(YOUTUBE_TRACKS, index, 'track');
  const title = pickFromPool(SALON_TITLES, index, 'title');
  const listenersCount = 3 + (botHash(index, 'listeners') % 28);
  const trackId = track.trackId;
  const progressMs = botHash(index, 'progress') % 180000;
  const now = Date.now();

  const salon: Salon = {
    id: salonId,
    hostId: userId,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title,
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId,
      title: track.title,
      artist: track.artist,
      albumArtUrl: `https://img.youtube.com/vi/${trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs,
      updatedAt: now,
      startedAt: now - progressMs,
      externalUrl: buildPlatformTrackUrl('youtube', trackId),
    },
    latitude: lat,
    longitude: lon,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lon),
    listenersCount,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [userId],
    allowQueue: false,
    createdAt: now - botHash(index, 'created') % 86400000,
  };

  db.salons.set(salonId, salon);

  if (withLive) {
    const viewersCount = botHash(index, 'viewers') % 51;
    const live: Live = {
      id: salonId,
      salonId,
      hostId: userId,
      hostName: user.username,
      title: `Live — ${title}`,
      platform: 'youtube',
      playbackState: salon.playbackState,
      latitude: lat,
      longitude: lon,
      blurredLatitude: salon.blurredLatitude,
      blurredLongitude: salon.blurredLongitude,
      viewersCount,
      isActive: true,
      startedAt: now - 300000 - (botHash(index, 'live-start') % 7200000),
      ...botLivePresentationFields(),
    };
    db.lives.set(salonId, live);
    db.liveChats.set(salonId, []);
  }
}

function createBulkWorldBot(index: number, liveCount: number, bulkCount: number): { hasSalon: boolean; hasLive: boolean } {
  const userId = `bot_fr_${index}`;
  const salonId = `bot_salon_fr_${index}`;
  const hasLive = isBulkBotLiveIndex(index, liveCount, bulkCount);

  if (db.users.has(userId)) {
    const user = db.users.get(userId)!;
    if (user.avatarUrl?.includes('/bottts/')) {
      user.avatarUrl = dicebearAdventurerAvatar(userId);
      db.users.set(userId, user);
    }
    if (!db.salons.has(salonId) && user.latitude != null && user.longitude != null) {
      createLightweightSalon(userId, user, user.latitude, user.longitude, index, hasLive);
    } else if (hasLive && !db.lives.has(salonId) && db.salons.has(salonId)) {
      const salon = db.salons.get(salonId)!;
      const viewersCount = botHash(index, 'viewers') % 51;
      db.lives.set(salonId, {
        id: salonId,
        salonId,
        hostId: userId,
        hostName: user.username,
        title: `Live — ${salon.title}`,
        platform: 'youtube',
        playbackState: salon.playbackState,
        latitude: salon.latitude,
        longitude: salon.longitude,
        blurredLatitude: salon.blurredLatitude,
        blurredLongitude: salon.blurredLongitude,
        viewersCount,
        isActive: true,
        startedAt: Date.now() - 300000,
        ...botLivePresentationFields(),
      });
      db.liveChats.set(salonId, []);
    }
    const live = db.lives.get(salonId);
    return {
      hasSalon: db.salons.has(salonId),
      hasLive: Boolean(live?.isActive),
    };
  }

  const { lat, lon, city } = botWorldPosition(index);
  const baseName = pickFromPool(USERNAME_POOL, index, 'name');
  const suffix = botHash(index, 'suffix') % 1000;
  const username = `🤖 ${baseName} ${suffix}`;

  const user: User = {
    id: userId,
    username,
    email: `bot_fr_${index}@bot.onscen.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    latitude: lat,
    longitude: lon,
    city,
    listeningRole: hasLive ? 'host' : 'les_deux',
    connectedPlatforms: ['youtube'],
    lastSeenAt: Date.now() - botHash(index, 'seen') % 3600000,
  };
  refreshUserPublicCoords(user);
  db.users.set(userId, user);

  createLightweightSalon(userId, user, lat, lon, index, hasLive);

  return { hasSalon: true, hasLive };
}

/** Seed ~10000 bots sur agglomérations peuplées + 8 bots nommés (salons complets). */
export function seedWorldMapBots(): void {
  if (!isLocalDevEnvironment()) return;

  const targetCount = getMsdevBotCount();
  const fallbackLat = Number(process.env.BOT_SEED_LAT) || DEFAULT_BOT_CENTER.lat;
  const fallbackLon = Number(process.env.BOT_SEED_LON) || DEFAULT_BOT_CENTER.lon;

  if (targetCount <= 0) {
    ensureMapBots(fallbackLat, fallbackLon);
    return;
  }

  const t0 = Date.now();
  let usersCreated = 0;
  let salonsCreated = 0;
  let livesCreated = 0;

  const bulkCount = Math.max(0, targetCount - MAP_BOTS.length);
  const liveTarget = resolveBulkBotLiveCount(bulkCount);

  for (let i = 0; i < bulkCount; i++) {
    const before = db.users.has(`bot_fr_${i}`);
    const result = createBulkWorldBot(i, liveTarget, bulkCount);
    if (!before && db.users.has(`bot_fr_${i}`)) usersCreated++;
    if (result.hasSalon) salonsCreated++;
    if (result.hasLive) livesCreated++;
  }

  MAP_BOTS.forEach((bot, idx) => {
    createNamedMapBot(bot, fallbackLat, fallbackLon, idx, true);
  });

  repositionAllWorldBots(bulkCount, true);
  ensureBotLivesCameraActive();

  worldBulkSeeded = true;

  const totalBots = [...db.users.keys()].filter((id) => id.startsWith('bot_')).length;
  const totalLives = [...db.lives.values()].filter((l) => l.isActive && l.hostId.startsWith('bot_')).length;
  const elapsed = Date.now() - t0;
  console.log(
    `[onscen] ${totalBots} bot(s) sur la carte monde (${usersCreated} nouveaux, ${salonsCreated} salons, ${livesCreated} lives seedés, ${totalLives} lives actifs, cap live ${LIVE_CAP}, ${elapsed}ms)`
  );
  if (elapsed > 5000) {
    console.warn(
      `[onscen] Seed bots lent (${elapsed}ms) — réduire MSDEV_BOT_COUNT si le boot timeout (ex. 500).`
    );
  }
}

/** @deprecated Utiliser seedWorldMapBots */
export const seedFranceMapBots = seedWorldMapBots;

/** Spawn bots au démarrage serveur */
export function seedBotsAtStartup(): void {
  if (!isLocalDevEnvironment()) return;
  seedWorldMapBots();
  seedBotPosts();
}

/** Place des bots nommés autour d'un centre (legacy, si MSDEV_BOT_COUNT=0) */
export function ensureMapBots(centerLat: number, centerLon: number): void {
  if (getMsdevBotCount() > 0) return;

  const key = centerKey(centerLat, centerLon);
  if (seededCenters.has(key)) return;
  seededCenters.add(key);

  MAP_BOTS.forEach((bot, idx) => {
    createNamedMapBot(bot, centerLat, centerLon, idx, false);
  });

  const count = MAP_BOTS.filter((b) => db.salons.has(`bot_salon_${b.id}`)).length;
  console.log(
    `[onscen] ${count} bot(s) sur la carte près de ${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}`
  );
}

/** À appeler depuis /geo/nearby — évite de re-spawner des bots à chaque pan */
export function ensureMapBotsForNearby(centerLat: number, centerLon: number): void {
  if (getMsdevBotCount() > 0) {
    if (!worldBulkSeeded) seedWorldMapBots();
    return;
  }
  ensureMapBots(centerLat, centerLon);
}

export function isBotHost(hostId: string): boolean {
  return hostId.startsWith('bot_');
}

const BOT_POST_CONTENT_TEMPLATES: Array<
  (track?: { trackId: string; title: string; artist: string }) => string
> = [
  (t) => `Je viens de découvrir 🎵 "${t?.title ?? 'ce titre'}" de ${t?.artist ?? 'cet artiste'} — trop bien !`,
  () => `Live incroyable ce soir ! 🔴 Rejoignez-moi sur le salon 🎧`,
  (t) => `En écoute en ce moment : "${t?.title ?? 'une belle surprise'}" de ${t?.artist ?? 'un artiste à découvrir'} 🎶`,
  () => `Salon ouvert ! Venez écouter avec moi, ambiance garantie 🙌`,
  () => `Ce morceau est dans ma tête depuis ce matin 😅🎵 Quelqu'un d'autre ?`,
  (t) => `${t?.artist ?? 'Cet artiste'} est juste incroyable. Écoutez "${t?.title ?? 'ce titre'}" ❤️`,
  () => `Nouvelle découverte du jour 🔍 — je suis complètement fan !`,
  () => `Live ce soir 🌙 — musique jusqu'au bout de la nuit 🎷 Rejoignez !`,
  () => `Qui écoute quoi en ce moment ? 👂 Partagez vos découvertes dans les commentaires !`,
  () => `Ambiance parfaite pour une soirée relax 🛋️🎵 — le salon est ouvert`,
  () => `J'adore quand on tombe sur une pépite musicale par hasard 💎 La magie de OnScen`,
  () => `Session collective sur le salon — rejoignez-nous, on est déjà 8 ! 🎉`,
  (t) => `"${t?.title ?? 'Ce titre'}" tourne en boucle chez moi depuis hier 🔁 Accro.`,
  () => `La carte est animée ce soir — plein de salons actifs autour de moi ! 🗺️`,
  () => `Qui partage une bonne playlist ? Je cherche des idées pour la semaine 🎧`,
  (t) => `Le clip de "${t?.title ?? 'ce morceau'}" par ${t?.artist ?? 'cet artiste'} — regardez c'est magnifique 📺`,
  () => `Soirée entre amis, on écoute de la musique ensemble sur OnScen 🎶✨`,
  () => `Mon coup de cœur de la semaine, je vous le partage ici ❤️‍🔥`,
  () => `Music is life 🎵 — sur OnScen encore une fois, impossible de décrocher !`,
  () => `Bonne nuit à tous, dernière track avant de dormir 🌙😴`,
  (t) => `${t?.artist ?? 'Artiste incroyable'} = génie absolu. Fin de la discussion. 🏆`,
  () => `On est plusieurs sur le salon ce soir, belle ambiance — venez ! 🙌`,
  () => `Découverte grâce à la carte — merci OnScen 🗺️❤️`,
  (t) => `"${t?.title ?? 'Un titre parfait'}" + café du matin = journée qui commence bien ☕🎵`,
  () => `Vous connaissez ce morceau ? Un chef-d'œuvre selon moi 🎼 Vos avis ?`,
  () => `Juste passé un live — 45 min de pure musique, merci à tous les auditeurs 🔥`,
  () => `Quelqu'un connaît un bon salon de jazz ce soir ? Je cherche 🎷`,
  (t) => `Top track du moment : "${t?.title ?? 'à découvrir'}" 🎯 Ajoutez-la à votre playlist !`,
  () => `OnScen + weekend + bonne humeur = combo parfait ☀️🎵`,
  () => `Premier live de ma vie ce soir — un peu stressé mais motivé ! 😤🎶`,
  () => `Petit café + playlist chill = matinée parfaite ☕🎧`,
  () => `Qui veut rejoindre mon salon ce soir ? On teste des morceaux inédits 🎤`,
  () => `Concert hier soir — encore des frissons ce matin 🎸`,
  () => `Ma playlist du moment fait 3h, impossible de m'arrêter 😅`,
  () => `Le live d'hier soir était fou — merci à tous ceux qui étaient là 🔥`,
  () => `Découverte du jour sur la carte : un salon lo-fi incroyable 🗺️`,
  () => `Vendredi soir = soirée musique sur OnScen, qui est partant ? 🎉`,
  () => `Ce morceau me donne envie de danser dans mon salon 💃🎵`,
  () => `En train de préparer ma setlist pour le prochain live — vos suggestions ? 🎛️`,
];

/** Images Unsplash (https) pour ~1/3 des posts bot. */
const BOT_POST_UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  'https://images.unsplash.com/photo-1516280440620-d857c38c5a56?w=600',
  'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=600',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  'https://images.unsplash.com/photo-1511379938541-c1f69419868d?w=600',
  'https://images.unsplash.com/photo-1501612780327-45045538702b?w=600',
  'https://images.unsplash.com/photo-1514320291840-75555eae4f8f?w=600',
];

const BOT_COMMENT_POOL = [
  '🔥🔥🔥',
  'Trop bien ce morceau !',
  'Merci pour le partage 🙌',
  "Je l'écoute aussi en ce moment 😄",
  'Super découverte !',
  "J'adore cet artiste ❤️",
  'On se retrouve sur le salon ?',
  'Bonne playlist 👍',
  'Clip magnifique 😍',
  'Un classique indémodable 🎶',
  '+1 pour cette track !',
  "Pareil, j'ai le morceau dans la tête 😅",
  'Live ce soir ?',
  "Je viens d'écouter, c'est top !",
  "Ma musique de la semaine aussi 🎧",
  "On est sur la même longueur d'onde 🎵",
  'Excellent choix 💯',
  'Je découvre grâce à toi merci !',
  "Salon ouvert chez moi si t'es chaud 🎤",
  'Fond sonore parfait pour travailler 🖥️🎶',
];

function countBotFeedPosts(): number {
  return db.feedPosts.filter((p) => p.id.startsWith(BOT_FEED_POST_ID_PREFIX)).length;
}

/** Crée ~50 publications de bots dans le fil Actualité. Idempotent (préfixe feed-bot-). */
export function seedBotPosts(): void {
  if (!isLocalDevEnvironment()) return;

  const existing = countBotFeedPosts();
  if (existing >= BOT_FEED_POST_TARGET || botFeedPostsSeeded) return;

  const botUsers = [...db.users.values()].filter((u) => u.id.startsWith('bot_'));
  if (botUsers.length === 0) return;

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const tracks = getYoutubeDemoPool();
  const toCreate = BOT_FEED_POST_TARGET - existing;

  for (let j = 0; j < toCreate; j++) {
    const i = existing + j;
    const bot = botUsers[botHash(i, 'post-author') % botUsers.length];
    const track = tracks.length > 0 ? tracks[botHash(i, 'post-track') % tracks.length] : undefined;
    const templateFn = BOT_POST_CONTENT_TEMPLATES[botHash(i, 'post-tmpl') % BOT_POST_CONTENT_TEMPLATES.length];
    const content = templateFn(track);

    const ageMs = Math.floor(botUnit(i, 'post-age') * sevenDaysMs);
    const createdAt = now - ageMs;

    const hasImage = botHash(i, 'post-img') % 100 < 35;
    let imageUrl: string | undefined;
    if (hasImage) {
      const useYoutube = tracks.length > 0 && botHash(i, 'post-img-src') % 2 === 0;
      if (useYoutube) {
        const imgTrack = tracks[botHash(i, 'post-img-track') % tracks.length];
        imageUrl = `https://img.youtube.com/vi/${imgTrack.trackId}/hqdefault.jpg`;
      } else if (BOT_POST_UNSPLASH_IMAGES.length > 0) {
        imageUrl = BOT_POST_UNSPLASH_IMAGES[botHash(i, 'post-unsplash') % BOT_POST_UNSPLASH_IMAGES.length];
      }
    }

    const postId = `${BOT_FEED_POST_ID_PREFIX}${i}-${createdAt}`;
    const post: FeedPost = {
      id: postId,
      userId: bot.id,
      content,
      ...(imageUrl ? { imageUrl } : {}),
      createdAt,
    };
    db.feedPosts.push(post);

    const likeCount = botHash(i, 'post-likes') % 51;
    if (likeCount > 0) {
      const likers = new Set<string>();
      for (let l = 0; l < likeCount; l++) {
        const liker = botUsers[botHash(i * 1000 + l, 'liker') % botUsers.length];
        if (liker.id !== bot.id) likers.add(liker.id);
      }
      if (likers.size > 0) db.feedPostLikes.set(postId, likers);
    }

    const commentCount = botHash(i, 'post-comments') % 11;
    if (commentCount > 0) {
      const comments: FeedPostComment[] = [];
      for (let c = 0; c < commentCount; c++) {
        const commenter = botUsers[botHash(i * 500 + c, 'commenter') % botUsers.length];
        const commentText = BOT_COMMENT_POOL[botHash(i * 100 + c, 'comment-text') % BOT_COMMENT_POOL.length];
        const commentAgeMs = Math.floor(botUnit(i * 100 + c, 'comment-age') * (sevenDaysMs - ageMs));
        comments.push({
          id: `fc-bot-${i}-${c}`,
          postId,
          userId: commenter.id,
          username: commenter.username,
          avatarUrl: commenter.avatarUrl,
          content: commentText,
          createdAt: createdAt + commentAgeMs,
        });
      }
      db.feedPostComments.set(postId, comments);
    }
  }

  botFeedPostsSeeded = true;
  console.log(
    `[msdev] ${toCreate} publication(s) bot créée(s) dans le fil d'actualité (${countBotFeedPosts()} au total)`
  );
}
