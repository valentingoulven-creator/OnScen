export type AccountStatus = 'active' | 'pending' | 'blocked';

export type AccessRegistrationMode = 'open' | 'invite_only' | 'admin_approval' | 'closed';

export interface PublicAccessConfig {
  enabled: boolean;
  registrationMode: AccessRegistrationMode;
  inviteRequired: boolean;
  registrationClosed: boolean;
  adminApprovalRequired: boolean;
}

export interface AccessInviteCode {
  id: string;
  code: string;
  label?: string;
  createdAt: number;
  maxUses: number;
  useCount: number;
  expiresAt?: number;
  disabled: boolean;
}

export interface AccessManagedUser {
  id: string;
  username: string;
  email: string;
  accountStatus: AccountStatus;
  isAdmin: boolean;
  memberSince?: number;
  lastSeenAt: number;
}

export type ListeningRole = 'auditeur' | 'host' | 'les_deux';

export type RelationshipStatus = 'celibataire' | 'en_couple' | 'autre';

export type ProfileType =
  | 'bar'
  | 'restaurant'
  | 'cafe'
  | 'club'
  | 'salle_concert'
  | 'festival'
  | 'dj'
  | 'compositeur'
  | 'rapper'
  | 'musicien'
  | 'chanteur'
  | 'producteur'
  | 'label'
  | 'promoteur'
  | 'autre';

export interface UserProfileStats {
  salonsHosted: number;
  livesHosted: number;
}

/** Morceau diffusé ou écouté en salon / live (profil public). */
export interface CurrentListening {
  title: string;
  artist: string;
  albumArtUrl?: string;
  platform: 'spotify' | 'youtube';
  isPlaying?: boolean;
}

export interface HostRatingSummary {
  average: number;
  count: number;
  userRating?: number;
}

export interface User {
  id: string;
  username: string;
  /** Hex (#rrggbb) ou `wave` (dégradé Soundly). */
  usernameColor?: string;
  /** Couleur de départ du dégradé wave (hex). */
  usernameWaveFrom?: string;
  /** Couleur de fin du dégradé wave (hex). */
  usernameWaveTo?: string;
  email?: string;
  accountStatus?: 'active' | 'pending' | 'blocked';
  isAdmin?: boolean;
  isDev?: boolean;
  avatarUrl?: string;
  profilePhotos?: string[];
  isGhostMode: boolean;
  bio?: string;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
  connectedPlatforms?: ('spotify' | 'youtube')[];
  platformLinks?: {
    platform: 'spotify' | 'youtube';
    externalUserId: string;
    connectedAt: number;
    displayName?: string;
  }[];
  city?: string;
  listeningRole?: ListeningRole;
  profileType?: ProfileType;
  relationshipStatus?: RelationshipStatus;
  relationshipStatusCustom?: string;
  memberSince?: number;
  stats?: UserProfileStats;
  /** Nombre d'utilisateurs ayant mis ce profil en favoris (public). */
  favoritesCount?: number;
  hostRating?: HostRatingSummary;
  isFollowing?: boolean;
  /** Anime un live actif */
  isLive?: boolean;
  /** Room live à rejoindre (souvent = salonId si live lié au salon) */
  liveId?: string;
  liveViewersCount?: number;
  /** Salon d'écoute actif de l'hôte */
  salonId?: string;
  salonTitle?: string;
  /** Morceau en cours (salon ou live animé). */
  currentListening?: CurrentListening;
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
  /** Préférence d'affichage imposée par le host : true = vidéo, false = audio seul. */
  showVideo?: boolean;
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

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  externalUrl: string;
}

export interface YoutubePlaylistSummary {
  playlistId: string;
  title: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

export interface MsdevDualUserSlot {
  slot: 'A' | 'B';
  ip: string;
  url: string;
  email: string;
  username: string;
  label: string;
  role: 'host' | 'listener';
}

export interface MsdevDualIpConfig {
  enabled: boolean;
  port: number;
  clientIp: string;
  matchedSlot: 'A' | 'B' | null;
  users: MsdevDualUserSlot[];
}

export interface AppNotification {
  id: string;
  type:
    | 'match'
    | 'live_started'
    | 'live_don'
    | 'favorite_online'
    | 'dm_message'
    | 'group_message'
    | 'heart'
    | 'content_heart'
    | 'follow'
    | 'event_created'
    | 'mention';
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  message: string;
  read: boolean;
  createdAt: number;
  matchId?: string;
  liveId?: string;
  salonId?: string;
  peerUserId?: string;
  groupId?: string;
  postId?: string;
  reelId?: string;
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
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  listeningRole?: ListeningRole;
  city?: string;
  distanceKm?: number;
  isBot?: boolean;
  salonId?: string;
  salonTitle?: string;
  isLive?: boolean;
  liveId?: string;
  liveViewersCount?: number;
  /** Auditeurs dans le salon (hôte avec salon). */
  listenersCount?: number;
  hostRatingAverage?: number;
  hostRatingCount?: number;
  listeningPlatform?: 'spotify' | 'youtube';
  currentListening?: CurrentListening;
  latitude?: number;
  longitude?: number;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
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
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
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
  isVip?: boolean;
  allowedUserIds?: string[];
  allowedCount?: number;
  vipModeratorIds?: string[];
  queue?: SalonQueueItem[];
  pendingProposalsCount?: number;
  /** Horodatage de création du salon (ms). Utilisé pour la limite de durée (2 h). */
  createdAt?: number;
  /** Lien Jam Spotify (open.spotify.com/socialsession/…) si l'hôte l'a partagé. */
  spotifyJamUrl?: string;
}

export interface SalonBan {
  permanent: boolean;
  until?: number;
  bannedAt: number;
}

export interface Live {
  id: string;
  salonId?: string;
  hostId: string;
  hostName: string;
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
  title: string;
  platform: 'spotify' | 'youtube';
  playbackState: PlaybackState;
  latitude: number;
  longitude: number;
  viewersCount: number;
  isActive: boolean;
  /** Horodatage de démarrage du live (ms). Utilisé pour la limite de durée (8 h). */
  startedAt?: number;
  distanceKm?: number;
  cameraActive?: boolean;
  cameraMode?: 'camera' | 'file';
  vipModeratorIds?: string[];
  /** L'hôte du live peut recevoir des dons (18+). */
  hostMonetizationEligible?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  roomType: 'salon' | 'live';
  senderId: string;
  senderName: string;
  senderUsernameColor?: string;
  senderUsernameWaveFrom?: string;
  senderUsernameWaveTo?: string;
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
  senderName?: string;
  senderAvatarUrl?: string;
}

export interface Conversation {
  kind?: 'dm' | 'group';
  userId?: string;
  groupId?: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  memberCount?: number;
  lastSenderName?: string;
  lastMessage: string;
  lastTimestamp: number;
  isFromMe: boolean;
  isOnline?: boolean;
  isMatch?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  /** true si cet utilisateur a envoyé une demande en attente d'acceptation (B reçoit une demande de A). */
  isPendingRequest?: boolean;
  /** true si notre demande envoyée est en attente d'acceptation. */
  isPendingSent?: boolean;
}

export interface DmRequest {
  senderId: string;
  username: string;
  avatarUrl?: string;
  preview: string;
  timestamp: number;
}

export interface GroupMember {
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export interface MessageGroupDetail {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  memberCount: number;
  createdAt: number;
  members: GroupMember[];
  unreadCount?: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  timestamp: number;
  hiddenFor?: string[];
  senderName?: string;
  senderAvatarUrl?: string;
  groupName?: string;
}

export interface LegalPublisherConfig {
  publisherName: string;
  legalForm: string;
  address: string;
  siren: string;
  rcs: string;
  capital: string;
  publicationDirector: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  hostCountry: string;
  mediatorName: string;
  mediatorUrl: string;
  dpoEmail: string;
  contactEmail: string;
  privacyEmail: string;
  productionDomain: string;
}

export interface UserSearchHit {
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  city?: string;
  listeningRole?: ListeningRole;
  isLive?: boolean;
  liveId?: string;
  liveViewersCount?: number;
  salonId?: string;
  salonTitle?: string;
}

export interface DmContact {
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isBlockedByMe?: boolean;
  isMutedByMe?: boolean;
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

export interface FeedPostAuthor {
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  profileType?: ProfileType;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
}

export interface FeedPostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  author: FeedPostAuthor;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  favoriteByMe: boolean;
  recentComments: FeedPostComment[];
  resharedFromId?: string;
  resharedFrom?: FeedPost;
}

export interface MusicNewsItem {
  id: string;
  type: 'news' | 'promo' | 'trending';
  category: 'une' | 'musique' | 'promo' | 'tendance';
  title: string;
  source?: string;
  excerpt: string;
  imageUrl?: string;
  artist?: string;
  publishedAt: number;
  url?: string;
  badge?: string;
  isPromo?: boolean;
  trending?: boolean;
  trendingRank?: number;
  genres?: string[];
}
