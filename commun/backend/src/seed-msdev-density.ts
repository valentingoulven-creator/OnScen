import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { buildPlatformTrackUrl } from './lib/musicLinks';
import { dicebearAdventurerAvatar } from './lib/avatarUrl';
import { POPULATED_CITIES } from './lib/botPopulatedCities';
import { schedulePersist } from './lib/persist';
import { db, type FeedPost, type Live, type MusicPlatform, type User } from './models/schema';

export const MSDEV_DENSITY_LIVE_ID_PREFIX = 'live_msdev_density_';
export const MSDEV_DENSITY_EVENT_ID_PREFIX = 'feed-msdev-festival-';
export const MSDEV_DENSITY_USER_ID_PREFIX = 'msdev_density_host_';

export const MSDEV_DENSITY_LIVE_TARGET = 100;
export const MSDEV_DENSITY_VIEWER_BASE = 1000;

const YOUTUBE_TRACKS = [
  { title: 'Get Lucky', artist: 'Daft Punk', trackId: '5NV6RXX0i0I' },
  { title: 'Strobe', artist: 'deadmau5', trackId: 'jfaD3P3N0v4' },
  { title: 'Midnight City', artist: 'M83', trackId: 'dX3kQ8LZX0g' },
  { title: 'Levitating', artist: 'Dua Lipa', trackId: 'TUVcZfQea-Y' },
  { title: 'Blinding Lights', artist: 'The Weeknd', trackId: '4NRXx6U8ABQ' },
];

const FESTIVAL_SEEDS: Array<{
  name: string;
  location: string;
  dayOffset: 0 | 1;
  hourUtc: number;
  /** Coordonnées réelles du lieu (site du festival) — jamais une ville piochée aléatoirement,
   * sinon le pin peut retomber n'importe où (mer, autre pays) sans lien avec `location`. */
  lat: number;
  lng: number;
}> = [
  { name: 'Tomorrowland', location: 'Boom, Belgium', dayOffset: 1, hourUtc: 18, lat: 51.1198, lng: 4.3502 },
  {
    name: 'Glastonbury Festival',
    location: 'Pilton, Somerset, United Kingdom',
    dayOffset: 0,
    hourUtc: 17,
    lat: 51.1481,
    lng: -2.5992,
  },
  {
    name: 'Coachella Valley Music',
    location: 'Indio, California, USA',
    dayOffset: 1,
    hourUtc: 20,
    lat: 33.6803,
    lng: -116.2378,
  },
  { name: 'Fuji Rock Festival', location: 'Niigata, Japan', dayOffset: 0, hourUtc: 11, lat: 36.8422, lng: 138.7761 },
  {
    name: 'Rock in Rio',
    location: 'Rio de Janeiro, Brazil',
    dayOffset: 1,
    hourUtc: 22,
    lat: -22.9792,
    lng: -43.3652,
  },
  {
    name: 'Ultra Music Festival',
    location: 'Miami, Florida, USA',
    dayOffset: 0,
    hourUtc: 23,
    lat: 25.7825,
    lng: -80.1867,
  },
  {
    name: 'Awakenings Festival',
    location: 'Amsterdam, Netherlands',
    dayOffset: 1,
    hourUtc: 16,
    lat: 52.4159,
    lng: 4.6717,
  },
  { name: 'Primavera Sound', location: 'Barcelona, Spain', dayOffset: 0, hourUtc: 19, lat: 41.4102, lng: 2.2181 },
  { name: 'Mawazine Festival', location: 'Rabat, Morocco', dayOffset: 1, hourUtc: 21, lat: 33.9835, lng: -6.8362 },
  { name: 'Sunburn Festival', location: 'Goa, India', dayOffset: 0, hourUtc: 14, lat: 15.4989, lng: 73.8278 },
];

function stableHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function viewersForIndex(index: number): number {
  const jitter = (stableHash(`density-viewers-${index}`) % 41) - 20;
  return MSDEV_DENSITY_VIEWER_BASE + jitter;
}

function pickCity(index: number) {
  const city = POPULATED_CITIES[stableHash(`density-city-${index}`) % POPULATED_CITIES.length]!;
  const offsetLat = ((stableHash(`density-olat-${index}`) % 200) - 100) / 50_000;
  const offsetLng = ((stableHash(`density-olng-${index}`) % 200) - 100) / 50_000;
  return {
    name: city.name,
    lat: city.lat + offsetLat,
    lng: city.lon + offsetLng,
  };
}

function pickTrack(index: number) {
  return YOUTUBE_TRACKS[stableHash(`density-track-${index}`) % YOUTUBE_TRACKS.length]!;
}

function makeHostUser(userId: string, username: string, city: string, lat: number, lng: number): User {
  const now = Date.now();
  const user: User = {
    id: userId,
    username,
    email: `${userId}@bot.melosong.local`,
    passwordHash: 'bot',
    avatarUrl: dicebearAdventurerAvatar(userId),
    meloCoins: 0,
    isGhostMode: false,
    latitude: lat,
    longitude: lng,
    city,
    listeningRole: 'host',
    connectedPlatforms: ['youtube'],
    memberSince: now - 86_400_000,
    lastSeenAt: now,
    favoriteGenres: ['Électro', 'House'],
    favoriteArtists: ['Daft Punk', 'M83'],
  };
  refreshUserPublicCoords(user);
  return user;
}

function makeDensityLive(
  liveId: string,
  user: User,
  title: string,
  lat: number,
  lng: number,
  viewersCount: number,
  index: number
): Live {
  const platform: MusicPlatform = 'youtube';
  const track = pickTrack(index);
  const now = Date.now();
  return {
    id: liveId,
    hostId: user.id,
    hostName: user.username,
    title,
    platform,
    playbackState: {
      platform,
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      albumArtUrl: `https://img.youtube.com/vi/${track.trackId}/hqdefault.jpg`,
      isPlaying: true,
      progressMs: 20_000 + (stableHash(liveId) % 120_000),
      updatedAt: now,
      externalUrl: buildPlatformTrackUrl(platform, track.trackId),
    },
    latitude: lat,
    longitude: lng,
    blurredLatitude: blurCoordinate(lat),
    blurredLongitude: blurCoordinate(lng),
    viewersCount,
    peakViewersCount: viewersCount + (stableHash(`peak-${liveId}`) % 120),
    isActive: true,
    startedAt: now - 600_000 - (stableHash(liveId) % 3_600_000),
    cameraActive: true,
    streamMode: 'livekit',
  };
}

function eventDateIso(dayOffset: 0 | 1, hourUtc: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

function removeExistingDensitySeeds(): { livesRemoved: number; eventsRemoved: number } {
  let livesRemoved = 0;
  for (const id of [...db.lives.keys()]) {
    if (id.startsWith(MSDEV_DENSITY_LIVE_ID_PREFIX)) {
      db.lives.delete(id);
      db.liveChats.delete(id);
      livesRemoved++;
    }
  }

  const before = db.feedPosts.length;
  db.feedPosts = db.feedPosts.filter((p) => !p.id.startsWith(MSDEV_DENSITY_EVENT_ID_PREFIX));
  const eventsRemoved = before - db.feedPosts.length;

  return { livesRemoved, eventsRemoved };
}

export interface SeedMsdevDensityResult {
  livesCreated: number;
  eventsCreated: number;
  livesRemoved: number;
  eventsRemoved: number;
  averageViewers: number;
  viewerMin: number;
  viewerMax: number;
}

export function seedMsdevDensity(opts?: { force?: boolean }): SeedMsdevDensityResult {
  const force = opts?.force === true;
  const existingLives = [...db.lives.keys()].filter((id) => id.startsWith(MSDEV_DENSITY_LIVE_ID_PREFIX)).length;
  const existingEvents = db.feedPosts.filter((p) => p.id.startsWith(MSDEV_DENSITY_EVENT_ID_PREFIX)).length;

  let livesRemoved = 0;
  let eventsRemoved = 0;
  if (force || existingLives > 0 || existingEvents > 0) {
    const removed = removeExistingDensitySeeds();
    livesRemoved = removed.livesRemoved;
    eventsRemoved = removed.eventsRemoved;
  }

  const viewerCounts: number[] = [];
  let livesCreated = 0;

  for (let i = 1; i <= MSDEV_DENSITY_LIVE_TARGET; i++) {
    const liveId = `${MSDEV_DENSITY_LIVE_ID_PREFIX}${pad3(i)}`;
    if (db.lives.has(liveId)) continue;

    const { name: cityName, lat, lng } = pickCity(i);
    const userId = `${MSDEV_DENSITY_USER_ID_PREFIX}${pad3(i)}`;
    let user = db.users.get(userId);
    if (!user) {
      user = makeHostUser(userId, `🎧 Live Host ${i}`, cityName, lat, lng);
      db.users.set(userId, user);
    } else {
      user.latitude = lat;
      user.longitude = lng;
      user.city = cityName;
      refreshUserPublicCoords(user);
      db.users.set(userId, user);
    }

    const viewersCount = viewersForIndex(i);
    viewerCounts.push(viewersCount);
    const live = makeDensityLive(
      liveId,
      user,
      `Live Festival — ${cityName}`,
      lat,
      lng,
      viewersCount,
      i
    );
    db.lives.set(liveId, live);
    if (!db.liveChats.has(liveId)) db.liveChats.set(liveId, []);
    livesCreated++;
  }

  let eventsCreated = 0;
  const now = Date.now();
  FESTIVAL_SEEDS.forEach((fest, index) => {
    const postId = `${MSDEV_DENSITY_EVENT_ID_PREFIX}${pad3(index + 1)}`;
    if (db.feedPosts.some((p) => p.id === postId)) return;

    const userId = `${MSDEV_DENSITY_USER_ID_PREFIX}evt_${pad3(index + 1)}`;
    const { lat, lng } = fest;
    const cityName = fest.location.split(',')[0] ?? fest.location;
    let user = db.users.get(userId);
    if (!user) {
      user = makeHostUser(userId, `🎪 ${fest.name}`, cityName, lat, lng);
      db.users.set(userId, user);
    } else {
      // Corrige les coordonnées d'un seed précédent (ex-bug pickCity() aléatoire,
      // sans lien avec `fest.location` — cf. MODIF 1000).
      user.latitude = lat;
      user.longitude = lng;
      user.city = cityName;
      refreshUserPublicCoords(user);
      db.users.set(userId, user);
    }

    const post: FeedPost = {
      id: postId,
      userId: user.id,
      content: `${fest.name} — édition 2026. Line-up international, scènes multiples, billetterie ouverte.`,
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
      createdAt: now - 3_600_000,
      isEvent: true,
      eventDate: eventDateIso(fest.dayOffset, fest.hourUtc),
      eventLocation: fest.location,
      eventType: 'dance',
      eventLinkUrl: 'https://getsoundy.com',
    };
    db.feedPosts.unshift(post);
    eventsCreated++;
  });

  schedulePersist();

  const averageViewers =
    viewerCounts.length > 0
      ? Math.round(viewerCounts.reduce((sum, n) => sum + n, 0) / viewerCounts.length)
      : 0;

  return {
    livesCreated,
    eventsCreated,
    livesRemoved,
    eventsRemoved,
    averageViewers,
    viewerMin: viewerCounts.length ? Math.min(...viewerCounts) : 0,
    viewerMax: viewerCounts.length ? Math.max(...viewerCounts) : 0,
  };
}
