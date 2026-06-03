import { db, Salon, Live, User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { ensureSalonQueue, ensureSalonProposals } from './lib/salonPlaybackOps';

const seededCenters = new Set<string>();

interface BotTemplate {
  id: string;
  username: string;
  title: string;
  platform: 'spotify' | 'youtube';
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
    platform: 'spotify',
    trackTitle: 'Blinding Lights',
    artist: 'The Weeknd',
    albumArtUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    trackId: 'spotify:track:bot1',
    listenersCount: 14,
    offsetLat: 0.004,
    offsetLon: 0.002,
  },
  {
    id: 'nova',
    username: 'Nova Sound',
    title: 'Indie Discovery',
    platform: 'spotify',
    trackTitle: 'Take On Me',
    artist: 'a-ha',
    albumArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    trackId: 'spotify:track:bot2',
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
    platform: 'spotify',
    trackTitle: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    albumArtUrl: 'https://images.unsplash.com/photo-1459742915495-5b3c976c1ea8?w=400',
    trackId: 'spotify:track:bot4',
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
    platform: 'spotify',
    trackTitle: 'Nightcall',
    artist: 'Kavinsky',
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    trackId: 'spotify:track:bot6',
    listenersCount: 22,
    offsetLat: -0.001,
    offsetLon: 0.006,
  },
  {
    id: 'milo',
    username: 'Milo Groove',
    title: 'Funk & Soul',
    platform: 'spotify',
    trackTitle: 'Uptown Funk',
    artist: 'Bruno Mars',
    albumArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
    trackId: 'spotify:track:bot7',
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

export const DEFAULT_BOT_CENTER = { lat: 48.8566, lon: 2.3522 };

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

function centerKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

/** Spawn bots au démarrage serveur (Paris par défaut) */
export function seedBotsAtStartup(): void {
  if (!isLocalDevEnvironment()) return;
  const lat = Number(process.env.BOT_SEED_LAT) || DEFAULT_BOT_CENTER.lat;
  const lon = Number(process.env.BOT_SEED_LON) || DEFAULT_BOT_CENTER.lon;
  ensureMapBots(lat, lon);
}

/** Place des bots de test autour du centre carte (idempotent par zone) */
export function ensureMapBots(centerLat: number, centerLon: number): void {
  const key = centerKey(centerLat, centerLon);
  if (seededCenters.has(key)) return;
  seededCenters.add(key);

  for (const bot of MAP_BOTS) {
    const userId = `bot_${bot.id}`;
    const salonId = `bot_salon_${bot.id}`;

    if (db.salons.has(salonId)) continue;

    const lat = centerLat + bot.offsetLat;
    const lon = centerLon + bot.offsetLon;

    const user: User = {
      id: userId,
      username: `🤖 ${bot.username}`,
      email: `${bot.id}@bot.melosong.local`,
      passwordHash: 'bot',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.id}`,
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
    };
    db.users.set(userId, user);

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
        progressMs: Math.floor(Math.random() * 120000),
        updatedAt: Date.now(),
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
      };
      db.lives.set(salonId, live);
      db.liveChats.set(salonId, []);
    }
  }

  const count = MAP_BOTS.filter((b) => db.salons.has(`bot_salon_${b.id}`)).length;
  console.log(
    `[melosong] ${count} bot(s) sur la carte près de ${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}`
  );
}

export function isBotHost(hostId: string): boolean {
  return hostId.startsWith('bot_');
}
