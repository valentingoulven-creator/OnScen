export type MusicPlatform = 'spotify' | 'youtube';

export type ListeningRole = 'auditeur' | 'host' | 'les_deux';

export type RelationshipStatus = 'celibataire' | 'en_couple';

/** Liaison OAuth (ou msdev simulée) — source de vérité pour l’hébergement salon */
export interface PlatformAccount {
  platform: MusicPlatform;
  externalUserId: string;
  connectedAt: number;
  accessToken?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  profilePhotos?: string[];
  meloCoins: number;
  isGhostMode: boolean;
  bio?: string;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
  connectedPlatforms?: MusicPlatform[];
  platformAccounts?: PlatformAccount[];
  city?: string;
  listeningRole?: ListeningRole;
  relationshipStatus?: RelationshipStatus;
  memberSince?: number;
  latitude?: number;
  longitude?: number;
  blurredLatitude?: number;
  blurredLongitude?: number;
  /** Partager la distance (km) avec les autres utilisateurs. Défaut : true. */
  shareDistance?: boolean;
  /** précis = position floutée ~50 m ; city = centre-ville uniquement pour les autres. */
  locationPrecision?: 'precise' | 'city';
  lastSeenAt: number;
}

export interface PlaybackState {
  platform: MusicPlatform;
  trackId: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  isPlaying: boolean;
  progressMs: number;
  /** Horodatage de la dernière mise à jour de progressMs (pause ou seek). */
  updatedAt: number;
  /** Horodatage wall-clock au moment de la reprise (lecture en cours). */
  startedAt?: number;
  /** Lien direct du morceau côté hôte (Spotify / YouTube). */
  externalUrl?: string;
}

export interface SalonQueueItem {
  id: string;
  title: string;
  artist: string;
  trackId?: string;
  externalUrl?: string;
  albumArtUrl?: string;
  addedById: string;
  addedByName: string;
  source: 'host' | 'proposal';
  proposalId?: string;
  addedAt: number;
}

export type SalonProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface SalonTrackProposal {
  id: string;
  salonId: string;
  proposerId: string;
  proposerName: string;
  title: string;
  artist: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  status: SalonProposalStatus;
  createdAt: number;
}

export interface Salon {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  title: string;
  platform: MusicPlatform;
  playbackState: PlaybackState;
  latitude: number;
  longitude: number;
  blurredLatitude: number;
  blurredLongitude: number;
  listenersCount: number;
  isGhostMode: boolean;
  isPublic: boolean;
  accessMode: 'public' | 'invite';
  allowedUserIds: string[];
  allowQueue: boolean;
  createdAt: number;
}

export interface Live {
  id: string;
  /** Lié à un salon d'écoute si présent ; absent pour un live autonome. */
  salonId?: string;
  hostId: string;
  hostName: string;
  title: string;
  platform: MusicPlatform;
  playbackState: PlaybackState;
  latitude: number;
  longitude: number;
  blurredLatitude: number;
  blurredLongitude: number;
  viewersCount: number;
  isActive: boolean;
  startedAt: number;
  /** Host a activé la caméra (aperçu local hôte ; pas de flux WebRTC en msdev). */
  cameraActive?: boolean;
  /** Utilisateurs VIP pouvant modérer le chat public du live. */
  vipModeratorIds?: string[];
}

export type LiveBanScope = 'chat' | 'live';

export interface LiveBan {
  /** chat = ne peut plus écrire ; live = expulsé du live (visionnage inclus). */
  scope: LiveBanScope;
  until?: number;
  permanent: boolean;
  bannedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  roomType: 'salon' | 'live';
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  accepted: boolean;
  /** Utilisateurs pour lesquels ce message est masqué (suppression locale). */
  hiddenFor?: string[];
}

export interface Gift {
  id: string;
  liveId: string;
  senderId: string;
  senderName: string;
  giftType: string;
  amount: number;
  timestamp: number;
}

export interface UserBlock {
  blockerId: string;
  blockedId: string;
  createdAt: number;
}

export interface HostRating {
  id: string;
  hostId: string;
  raterId: string;
  stars: number;
  salonId?: string;
  liveId?: string;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  type: 'match' | 'live_started' | 'live_don';
  message: string;
  read: boolean;
  createdAt: number;
  matchId?: string;
  liveId?: string;
}

export interface HeartEvent {
  fromId: string;
  toId: string;
  createdAt: number;
}

export interface MusicMatch {
  id: string;
  userIdA: string;
  userIdB: string;
  createdAt: number;
}

export interface ReelComment {
  id: string;
  reelId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
}

export type ReelVisibility = 'public' | 'private';

export interface UserReel {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mediaType: 'video' | 'image';
  videoUrl?: string;
  posterUrl: string;
  /** Durée vidéo en secondes, si fournie à la création */
  durationSec?: number;
  authorId: string;
  createdAt: number;
  /** private = profil uniquement ; absent = public (rétrocompat) */
  visibility?: ReelVisibility;
}

export const db = {
  users: new Map<string, User>(),
  salons: new Map<string, Salon>(),
  lives: new Map<string, Live>(),
  salonChats: new Map<string, ChatMessage[]>(),
  salonQueues: new Map<string, SalonQueueItem[]>(),
  salonProposals: new Map<string, SalonTrackProposal[]>(),
  liveChats: new Map<string, ChatMessage[]>(),
  /** liveId → userId → ban */
  liveBans: new Map<string, Map<string, LiveBan>>(),
  directMessages: [] as DirectMessage[],
  gifts: [] as Gift[],
  hostRatings: [] as HostRating[],
  userBlocks: [] as UserBlock[],
  notifications: [] as AppNotification[],
  heartEvents: [] as HeartEvent[],
  matches: [] as MusicMatch[],
  reelLikes: new Map<string, Set<string>>(),
  reelComments: new Map<string, ReelComment[]>(),
  reelShares: new Map<string, Set<string>>(),
  /** Spectateurs uniques par reel */
  reelViews: new Map<string, Set<string>>(),
  userReels: [] as UserReel[],
  /** followerId → ensemble des userId suivis */
  userFollows: new Map<string, Set<string>>(),
};
