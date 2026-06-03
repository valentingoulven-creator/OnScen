export type ListeningRole = 'auditeur' | 'host' | 'les_deux';

export type RelationshipStatus = 'celibataire' | 'en_couple';

export interface UserProfileStats {
  salonsHosted: number;
  livesHosted: number;
}

export interface HostRatingSummary {
  average: number;
  count: number;
  userRating?: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  profilePhotos?: string[];
  isGhostMode: boolean;
  bio?: string;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
  connectedPlatforms?: ('spotify' | 'youtube')[];
  platformLinks?: { platform: 'spotify' | 'youtube'; externalUserId: string; connectedAt: number }[];
  city?: string;
  listeningRole?: ListeningRole;
  relationshipStatus?: RelationshipStatus;
  memberSince?: number;
  stats?: UserProfileStats;
  hostRating?: HostRatingSummary;
  isFollowing?: boolean;
  /** Propriétaire du profil uniquement */
  shareDistance?: boolean;
  locationPrecision?: 'precise' | 'city';
}

export interface PlaybackState {
  platform: 'spotify' | 'youtube';
  trackId: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  isPlaying: boolean;
  progressMs: number;
  updatedAt: number;
  startedAt?: number;
  externalUrl?: string;
}

export interface ResolvedSalonTrack {
  platform: 'spotify' | 'youtube';
  title: string;
  artist: string;
  trackId?: string;
  externalUrl: string;
  searchUrl: string;
  matchType: 'exact' | 'mock' | 'search';
  hostPlatform: 'spotify' | 'youtube';
  playbackPositionMs: number;
}

export interface AppNotification {
  id: string;
  type: 'match' | 'live_started' | 'live_don';
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  message: string;
  read: boolean;
  createdAt: number;
  matchId?: string;
  liveId?: string;
}

export interface MusicMatch {
  id: string;
  createdAt: number;
  otherUser: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface MatchStatus {
  matched: boolean;
  match: MusicMatch | null;
  theySentHeart: boolean;
  iSentHeart: boolean;
}

export interface NearbyPerson {
  id: string;
  username: string;
  avatarUrl?: string;
  listeningRole?: ListeningRole;
  city?: string;
  distanceKm?: number;
  isBot?: boolean;
  salonId?: string;
  salonTitle?: string;
  isLive?: boolean;
  hostRatingAverage?: number;
  hostRatingCount?: number;
  listeningPlatform?: 'spotify' | 'youtube';
  latitude?: number;
  longitude?: number;
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
  platform: 'spotify' | 'youtube';
  playbackState: PlaybackState;
  latitude: number;
  longitude: number;
  listenersCount: number;
  isLive?: boolean;
  allowQueue: boolean;
  isBot?: boolean;
  accessMode?: 'public' | 'invite';
  isPublic?: boolean;
  canJoin?: boolean;
  isHost?: boolean;
  allowedUserIds?: string[];
  allowedCount?: number;
  queue?: SalonQueueItem[];
  pendingProposalsCount?: number;
}

export interface Live {
  id: string;
  salonId?: string;
  hostId: string;
  hostName: string;
  title: string;
  platform: 'spotify' | 'youtube';
  playbackState: PlaybackState;
  latitude: number;
  longitude: number;
  viewersCount: number;
  isActive: boolean;
  distanceKm?: number;
  cameraActive?: boolean;
  vipModeratorIds?: string[];
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

/** Ligne de réaction live dans le fil du chat (cadeau / emoji) */
export interface LiveChatReaction {
  id: string;
  senderId?: string;
  senderName: string;
  giftType: string;
  amount?: number;
  timestamp: number;
  count?: number;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  accepted?: boolean;
  hiddenFor?: string[];
}

export interface Conversation {
  userId: string;
  username: string;
  avatarUrl?: string;
  lastMessage: string;
  lastTimestamp: number;
  isFromMe: boolean;
  isOnline?: boolean;
  isMatch?: boolean;
}

export interface DmContact {
  id: string;
  username: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isBlockedByMe?: boolean;
  isMatch?: boolean;
}

export interface ReelStats {
  heartCount: number;
  commentCount: number;
  shareCount: number;
  viewCount?: number;
  likedByMe: boolean;
  sharedByMe: boolean;
  commentedByMe: boolean;
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
