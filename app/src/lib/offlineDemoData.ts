import type {
  AppNotification,
  ChatMessage,
  Conversation,
  DirectMessage,
  DmContact,
  Live,
  MusicMatch,
  NearbyPerson,
  PlaybackState,
  Salon,
  SalonQueueItem,
  SalonTrackProposal,
  User,
} from '../types';
import { OFFLINE_DEMO_USER } from './offlineDemo';

const PARIS_LAT = 48.8566;
const PARIS_LON = 2.3522;
const now = Date.now();

const dj: User = {
  id: 'user_dj',
  username: 'DJ Melody',
  avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DJMelody',
  isGhostMode: false,
  bio: 'Host deep house — je mixe en live sur MeloSong.',
  city: 'Paris',
  listeningRole: 'host',
  connectedPlatforms: ['spotify'],
  memberSince: now - 86400000 * 120,
};

const bass: User = {
  id: 'user_bass',
  username: 'BassHunter',
  avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=BassHunter',
  isGhostMode: false,
  bio: 'YouTube & bass music — toujours un morceau à partager.',
  city: 'Paris',
  listeningRole: 'host',
  connectedPlatforms: ['youtube'],
  memberSince: now - 86400000 * 60,
};

const playbackDj: PlaybackState = {
  platform: 'spotify',
  trackId: '2P91MQbaiQKBR4c9sEgqsl',
  title: 'Midnight City',
  artist: 'M83',
  albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
  isPlaying: true,
  progressMs: 45000,
  updatedAt: now,
  startedAt: now - 45000,
  externalUrl: 'https://open.spotify.com/track/2P91MQbaiQKBR4c9sEgqsl',
};

const playbackBass: PlaybackState = {
  platform: 'youtube',
  trackId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  artist: 'Rick Astley',
  albumArtUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  isPlaying: true,
  progressMs: 12000,
  updatedAt: now,
  startedAt: now - 12000,
  externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

export const offlineSalons: Salon[] = [
  {
    id: 'salon_dj',
    hostId: dj.id,
    hostName: dj.username,
    hostAvatarUrl: dj.avatarUrl,
    title: 'Deep House Paris',
    platform: 'spotify',
    playbackState: playbackDj,
    latitude: PARIS_LAT + 0.0004,
    longitude: PARIS_LON + 0.0003,
    listenersCount: 8,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [dj.id],
    allowQueue: true,
    canJoin: true,
    isHost: false,
  },
  {
    id: 'salon_bass',
    hostId: bass.id,
    hostName: bass.username,
    hostAvatarUrl: bass.avatarUrl,
    title: 'YouTube Vibes',
    platform: 'youtube',
    playbackState: playbackBass,
    latitude: PARIS_LAT - 0.0005,
    longitude: PARIS_LON - 0.0004,
    listenersCount: 3,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [bass.id],
    allowQueue: false,
    canJoin: true,
    isHost: false,
  },
  {
    id: 'salon_luna',
    hostId: 'bot_luna',
    hostName: 'Luna Beats',
    hostAvatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=LunaBeats',
    title: 'Chill Electro',
    platform: 'spotify',
    playbackState: {
      platform: 'spotify',
      trackId: 'bot1',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      albumArtUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      isPlaying: true,
      progressMs: 30000,
      updatedAt: now,
      startedAt: now - 30000,
    },
    latitude: PARIS_LAT + 0.004,
    longitude: PARIS_LON + 0.002,
    listenersCount: 14,
    isBot: true,
    isPublic: true,
    accessMode: 'public',
    allowQueue: true,
    canJoin: true,
  },
];

export const offlineLives: Live[] = [
  {
    id: 'salon_dj',
    salonId: 'salon_dj',
    hostId: dj.id,
    hostName: dj.username,
    title: 'Live DJ Melody',
    platform: 'spotify',
    playbackState: playbackDj,
    latitude: PARIS_LAT + 0.0004,
    longitude: PARIS_LON + 0.0003,
    viewersCount: 24,
    isActive: true,
    distanceKm: 0.1,
  },
  {
    id: 'live_nova',
    hostId: 'bot_nova',
    hostName: 'Nova Sound',
    title: 'Indie Discovery Live',
    platform: 'spotify',
    playbackState: {
      platform: 'spotify',
      trackId: 'bot2',
      title: 'Take On Me',
      artist: 'a-ha',
      albumArtUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
      isPlaying: true,
      progressMs: 20000,
      updatedAt: now,
      startedAt: now - 20000,
    },
    latitude: PARIS_LAT - 0.003,
    longitude: PARIS_LON + 0.004,
    viewersCount: 7,
    isActive: true,
    distanceKm: 0.4,
  },
];

export const offlinePeople: NearbyPerson[] = [
  {
    id: dj.id,
    username: dj.username,
    avatarUrl: dj.avatarUrl,
    listeningRole: 'host',
    city: 'Paris',
    distanceKm: 0.1,
    salonId: 'salon_dj',
    salonTitle: 'Deep House Paris',
    isLive: true,
    hostRatingAverage: 4.8,
    hostRatingCount: 12,
    listeningPlatform: 'spotify',
    latitude: PARIS_LAT + 0.0004,
    longitude: PARIS_LON + 0.0003,
  },
  {
    id: bass.id,
    username: bass.username,
    avatarUrl: bass.avatarUrl,
    listeningRole: 'host',
    city: 'Paris',
    distanceKm: 0.2,
    salonId: 'salon_bass',
    salonTitle: 'YouTube Vibes',
    listeningPlatform: 'youtube',
    latitude: PARIS_LAT - 0.0005,
    longitude: PARIS_LON - 0.0004,
  },
  {
    id: 'bot_luna',
    username: 'Luna Beats',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=LunaBeats',
    distanceKm: 0.5,
    isBot: true,
    salonId: 'salon_luna',
    salonTitle: 'Chill Electro',
    listeningPlatform: 'spotify',
    latitude: PARIS_LAT + 0.004,
    longitude: PARIS_LON + 0.002,
  },
  {
    id: 'bot_nova',
    username: 'Nova Sound',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=NovaSound',
    distanceKm: 0.4,
    isBot: true,
    isLive: true,
    listeningPlatform: 'spotify',
    latitude: PARIS_LAT - 0.003,
    longitude: PARIS_LON + 0.004,
  },
  {
    id: 'bot_kira',
    username: 'Kira FM',
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=KiraFM',
    distanceKm: 0.6,
    isBot: true,
    listeningPlatform: 'youtube',
    latitude: PARIS_LAT + 0.002,
    longitude: PARIS_LON - 0.005,
  },
];

export const offlineUsers: Record<string, User> = {
  [OFFLINE_DEMO_USER.id]: { ...OFFLINE_DEMO_USER },
  [dj.id]: dj,
  [bass.id]: bass,
};

export const offlineSalonChats: Record<string, ChatMessage[]> = {
  salon_dj: [
    {
      id: 'm1',
      roomId: 'salon_dj',
      roomType: 'salon',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Super session ! 🔥',
      timestamp: now - 60000,
    },
  ],
  salon_bass: [],
};

export const offlineLiveChats: Record<string, ChatMessage[]> = {
  salon_dj: [
    {
      id: 'lm1',
      roomId: 'salon_dj',
      roomType: 'live',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Le drop arrive ! 🔥',
      timestamp: now - 120000,
    },
    {
      id: 'lm2',
      roomId: 'salon_dj',
      roomType: 'live',
      senderId: OFFLINE_DEMO_USER.id,
      senderName: OFFLINE_DEMO_USER.username,
      content: 'Incroyable ce morceau',
      timestamp: now - 90000,
    },
  ],
};

export const offlineQueues: Record<string, SalonQueueItem[]> = {
  salon_dj: [
    {
      id: 'q1',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      trackId: '0VjIjW4GlUZAMYd2vXMi3b',
      externalUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
      addedById: bass.id,
      addedByName: bass.username,
      source: 'proposal',
      addedAt: now - 3600000,
    },
  ],
};

export const offlineProposals: Record<string, SalonTrackProposal[]> = {
  salon_dj: [],
};

export const offlineDirectMessages: DirectMessage[] = [
  {
    id: 'dm1',
    senderId: bass.id,
    receiverId: OFFLINE_DEMO_USER.id,
    content: 'Hey ! On écoute quoi ce soir ?',
    timestamp: now - 3600000,
    accepted: true,
  },
  {
    id: 'dm2',
    senderId: OFFLINE_DEMO_USER.id,
    receiverId: bass.id,
    content: 'Je suis sur la carte, je te rejoins !',
    timestamp: now - 3500000,
    accepted: true,
  },
  {
    id: 'dm3',
    senderId: dj.id,
    receiverId: OFFLINE_DEMO_USER.id,
    content: 'Bienvenue sur MeloSong 🎵',
    timestamp: now - 7200000,
    accepted: true,
  },
];

export const offlineContacts: DmContact[] = [
  { id: bass.id, username: bass.username, avatarUrl: bass.avatarUrl, isOnline: true, isMatch: true },
  { id: dj.id, username: dj.username, avatarUrl: dj.avatarUrl, isOnline: false, isMatch: true },
  { id: 'bot_luna', username: 'Luna Beats', avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=LunaBeats', isOnline: true },
];

export const offlineConversations: Conversation[] = [
  {
    userId: bass.id,
    username: bass.username,
    avatarUrl: bass.avatarUrl,
    lastMessage: 'Je suis sur la carte, je te rejoins !',
    lastTimestamp: now - 3500000,
    isFromMe: true,
    isOnline: true,
    isMatch: true,
  },
  {
    userId: dj.id,
    username: dj.username,
    avatarUrl: dj.avatarUrl,
    lastMessage: 'Bienvenue sur MeloSong 🎵',
    lastTimestamp: now - 7200000,
    isFromMe: false,
    isMatch: true,
  },
];

export const offlineMatches: MusicMatch[] = [
  {
    id: 'match_bass',
    createdAt: now - 86400000,
    otherUser: { id: bass.id, username: bass.username, avatarUrl: bass.avatarUrl },
  },
  {
    id: 'match_dj',
    createdAt: now - 172800000,
    otherUser: { id: dj.id, username: dj.username, avatarUrl: dj.avatarUrl },
  },
];

export const offlineNotifications: AppNotification[] = [
  {
    id: 'notif1',
    type: 'live_started',
    senderId: dj.id,
    senderName: dj.username,
    senderAvatarUrl: dj.avatarUrl,
    message: 'DJ Melody est en live — Deep House Paris',
    read: false,
    createdAt: now - 300000,
    liveId: 'salon_dj',
  },
  {
    id: 'notif2',
    type: 'match',
    senderId: bass.id,
    senderName: bass.username,
    senderAvatarUrl: bass.avatarUrl,
    message: 'Nouveau match musical avec BassHunter',
    read: false,
    createdAt: now - 86400000,
    matchId: 'match_bass',
  },
];

export const offlineFollowingIds = new Set([dj.id, bass.id]);
export const offlineBlockedIds = new Set<string>();
export const offlineOnlineIds = new Set([bass.id, 'bot_luna']);
export const offlineReelHearts = new Set<string>();
export const offlineReelShares = new Set<string>();
export const offlineReelComments: Record<string, { id: string; reelId: string; userId: string; username: string; avatarUrl?: string; content: string; createdAt: number }[]> = {};
export const offlineReelViews = new Map<string, number>();
export const offlineHostRatings: Record<string, { average: number; count: number; userRating?: number }> = {
  [dj.id]: { average: 4.8, count: 12, userRating: 5 },
  [bass.id]: { average: 4.2, count: 8, userRating: 4 },
};

export function cloneSalon(salon: Salon): Salon {
  return {
    ...salon,
    playbackState: { ...salon.playbackState },
    allowedUserIds: salon.allowedUserIds ? [...salon.allowedUserIds] : undefined,
  };
}
