import type { FeedEventType } from './lib/eventType';

export type { FeedEventType };

export type MusicPlatform = 'spotify' | 'youtube';
export type ConnectPlatform = MusicPlatform | 'instagram';

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
  /** Droit admin persisté (`user.isAdmin`), distinct des comptes dev par pseudo/e-mail. */
  adminFlag?: boolean;
  memberSince?: number;
  lastSeenAt: number;
  profileType?: ProfileType;
  city?: string;
  meloCoins?: number;
  listeningRole?: ListeningRole;
  bio?: string;
  bioPreview?: string;
  followersCount?: number;
  photosCount?: number;
  /** Champs admin (contournent la confidentialité publique). */
  birthDate?: string;
  age?: number;
  hideBirthDateOnProfile?: boolean;
  showAge?: boolean;
  relationshipStatus?: RelationshipStatus;
  relationshipStatusCustom?: string;
  isGhostMode?: boolean;
  shareDistance?: boolean;
  locationPrecision?: 'precise' | 'city';
  privateReelsCount?: number;
  publicReelsCount?: number;
  instagramHandle?: string;
}

export type AdminUserSort = 'lastSeen' | 'memberSince' | 'username' | 'status';

export interface AdminSpotifyConnectionCounts {
  premium: number;
  basic: number;
}

export interface AccessAdminUsersResponse {
  users: AccessManagedUser[];
  total: number;
  counts: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    spotify: AdminSpotifyConnectionCounts;
  };
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminCreatorInfo {
  id: string;
  username: string;
  email: string;
  accountStatus: AccountStatus;
  city?: string;
  isGhostMode: boolean;
  profileType?: ProfileType;
}

export type AdminContentFilter = 'all' | 'blocked' | 'active';

export interface AdminContentCounts {
  total: number;
  blocked: number;
  active: number;
}

export interface AdminSalonRow {
  id: string;
  title: string;
  platform: MusicPlatform;
  accessMode: 'public' | 'invite';
  isPublic: boolean;
  isGhostMode: boolean;
  hostGhostMode: boolean;
  listenersCount: number;
  latitude: number;
  longitude: number;
  createdAt: number;
  adminBlocked: boolean;
  adminBlockedAt?: number;
  isLive: boolean;
  hostId: string;
  hostName: string;
  creator: AdminCreatorInfo | null;
  allowQueue: boolean;
  allowedCount?: number;
  currentTrack: { title: string; artist: string; isPlaying: boolean; platform: MusicPlatform };
  city?: string;
}

export interface AdminLiveRow {
  id: string;
  title: string;
  platform: MusicPlatform;
  isActive: boolean;
  viewersCount: number;
  startedAt: number;
  salonId?: string;
  salonTitle?: string;
  adminBlocked: boolean;
  adminBlockedAt?: number;
  hostId: string;
  hostName: string;
  creator: AdminCreatorInfo | null;
  cameraActive: boolean;
  cameraMode?: 'camera' | 'file';
  hostGhostMode: boolean;
  latitude: number;
  longitude: number;
  city?: string;
  currentTrack: { title: string; artist: string; isPlaying: boolean; platform: MusicPlatform };
}

export interface AdminEventRow {
  id: string;
  content: string;
  eventDate?: string;
  eventLocation?: string;
  eventType?: FeedEventType;
  createdAt: number;
  adminBlocked: boolean;
  adminBlockedAt?: number;
  userId: string;
  creator: AdminCreatorInfo | null;
  likeCount: number;
  commentCount: number;
  hasImage: boolean;
  hasVideo: boolean;
}

export interface AdminReelRow {
  id: string;
  title: string;
  artist: string;
  genre: string;
  caption: string;
  posterUrl: string;
  videoUrl?: string;
  mediaType: 'video' | 'image';
  visibility: 'public' | 'private';
  isPrivate: boolean;
  createdAt: number;
  authorId: string;
  creator: AdminCreatorInfo | null;
  adminBlocked: boolean;
  adminBlockedAt?: number;
  viewCount: number;
  heartCount: number;
  commentCount: number;
  shareCount: number;
}

export interface AdminContentListResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  counts: AdminContentCounts;
  salons?: AdminSalonRow[];
  lives?: AdminLiveRow[];
  events?: AdminEventRow[];
  reels?: AdminReelRow[];
}

export interface CloudflareUsageReport {
  configured: boolean;
  fetchedAt: string;
  periodStart: string;
  periodEnd: string;
  minutesDelivered: number;
  minutesDeliveredSource: 'graphql' | 'unavailable';
  storageMinutes: number;
  storageMinutesSource: 'videos_api' | 'unavailable';
  liveInputsTotal: number;
  liveInputsActive: number;
  estimatedCostUsd: { delivery: number; storage: number; total: number };
  estimatedCostEur: { delivery: number; storage: number; total: number };
  usdToEurRate: number;
  warnings: string[];
}

export interface DonationsSummaryPeriod {
  totalDonationsCents: number;
  platformFeesCents: number;
  creatorPayoutsCents: number;
  count: number;
  simulationCount: number;
  stripeCount: number;
}

export interface DonationsSummaryReport {
  fetchedAt: string;
  platformFeePercent: number;
  paymentTermsDocKey: string;
  simulationMode: boolean;
  allTime: DonationsSummaryPeriod;
  thisMonth: DonationsSummaryPeriod;
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
  | 'melomane'
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
  /** Badge Dev visible publiquement (soundy_dev, ACCESS_ADMIN). */
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
    platform: ConnectPlatform;
    externalUserId: string;
    connectedAt: number;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
    topArtists?: string[];
    isRealOAuth?: boolean;
  }[];
  city?: string;
  listeningRole?: ListeningRole;
  profileType?: ProfileType;
  relationshipStatus?: RelationshipStatus;
  /** Texte libre si relationshipStatus === autre. */
  relationshipStatusCustom?: string;
  /** Date de naissance ISO (YYYY-MM-DD). */
  birthDate?: string;
  /** Masquer la date aux autres (défaut true). Propriétaire uniquement en API. */
  hideBirthDateOnProfile?: boolean;
  /** Âge dérivé (13–120) ; fallback legacy sans birthDate. */
  age?: number;
  /** @deprecated Préférer hideBirthDateOnProfile. */
  showAge?: boolean;
  memberSince?: number;
  stats?: UserProfileStats;
  /** Nombre d'utilisateurs ayant mis ce profil en favoris (public). */
  favoritesCount?: number;
  hostRating?: HostRatingSummary;
  isFollowing?: boolean;
  /** Le profil visité suit le visiteur (follow inverse) */
  isFollowingMe?: boolean;
  /** Le visiteur est abonné supporter de ce créateur */
  isSupporter?: boolean;
  supporterTier?: string;
  /** Nombre d'abonnés actifs (profil créateur) */
  subscriberCount?: number;
  /** Le créateur peut recevoir dons / abonnements (18+). */
  monetizationEligible?: boolean;
  /** Compte validé (actif) — éligibilité cœur / interactions. */
  accountValidated?: boolean;
  /** Au moins 18 ans (champ serveur, indépendant de showAge). */
  meetsHeartAge?: boolean;
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
  /** Réseaux sociaux publics (optionnels) */
  instagramHandle?: string;
  youtubeChannel?: string;
  spotifyUrl?: string;
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

export interface SpotifySearchResult {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumArtUrl: string;
  externalUrl: string;
}

export interface YoutubePlaylistSummary {
  playlistId: string;
  title: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

export interface SpotifyPlaylistSummary {
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
    | 'salon_invite'
    | 'dm_message'
    | 'group_message'
    | 'heart'
    | 'content_heart'
    | 'follow'
    | 'event_created'
    | 'mention'
    | 'support_contact'
    | 'support_reply';
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
  supportMessageId?: string;
}

export type SupportContactStatus = 'open' | 'replied' | 'resolved';

export interface SupportThreadMessage {
  id: string;
  role: 'user' | 'admin';
  body: string;
  createdAt: number;
  authorUserId: string;
}

export interface SupportContactMessage {
  id: string;
  fromUserId: string;
  fromUsername: string;
  body: string;
  createdAt: number;
  status: SupportContactStatus;
  adminReply?: string;
  repliedAt?: number;
  userReply?: string;
  userRepliedAt?: number;
  threadId: string;
  thread?: SupportThreadMessage[];
}

export interface MusicMatch {
  id: string;
  createdAt: number;
  otherUser: {
    id: string;
    username: string;
    usernameColor?: string;
    usernameWaveFrom?: string;
    usernameWaveTo?: string;
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
  isDev?: boolean;
  allowedUserIds?: string[];
  allowedCount?: number;
  vipModeratorIds?: string[];
  queue?: SalonQueueItem[];
  pendingProposalsCount?: number;
  /** Horodatage de création du salon (ms). Utilisé pour la limite de durée (2 h). */
  createdAt?: number;
}

export interface SalonParticipant {
  id: string;
  username: string;
  usernameColor?: string;
  isVip: boolean;
  isDev?: boolean;
}

/** Spectateur connecté au live (socket room live_*). */
export type LiveParticipant = SalonParticipant;

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
  isDev?: boolean;
  /** L'hôte du live peut recevoir des dons (18+). */
  hostMonetizationEligible?: boolean;
  /** Code ISO pays du live (dérivé coords / ville hôte). */
  countryCode?: string;
  /** Libellé pays en français. */
  countryName?: string;
  /** Mode diffusion : webrtc (mesh), livekit (navigateur) ou cloudflare (HLS/CDN). */
  streamMode?: 'webrtc' | 'cloudflare' | 'livekit';
  /** URL manifest HLS Cloudflare (spectateurs). */
  cloudflarePlaybackUrl?: string;
  cloudflareLiveInputId?: string;
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
  senderIsDev?: boolean;
  content: string;
  timestamp: number;
  /** Pièce jointe (image ou fichier encodé en base64 data URL). */
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
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
  /** Réactions emoji : emoji → tableau d'userId. */
  reactions?: Record<string, string[]>;
  /** Pièce jointe (data URL base64 ou URL serveur). */
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
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
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
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
  displayName?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isBlockedByMe?: boolean;
  isMutedByMe?: boolean;
  isMatch?: boolean;
  isMutualFollow?: boolean;
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

export type CommentAlign = 'left' | 'center' | 'right' | 'full';

export interface FeedPostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: number;
  textAlign?: CommentAlign;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: number;
  author: FeedPostAuthor;
  likeCount: number;
  likedByMe: boolean;
  resharedByMe?: boolean;
  commentCount: number;
  favoriteByMe: boolean;
  recentComments: FeedPostComment[];
  resharedFromId?: string;
  resharedFrom?: FeedPost;
  authorHasActiveStory?: boolean;
  authorActiveStoryId?: string;
  /** Champs événement */
  isEvent?: boolean;
  eventDate?: string;
  eventLocation?: string;
  /** Type d'événement : danse, chant ou autre (défaut autre). */
  eventType?: FeedEventType;
}

/** Marqueur événement sur la carte (publication fil + coords résolues). */
export interface MapEventMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  eventDate?: string;
  eventLocation?: string;
  eventType?: FeedEventType;
  authorId?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  authorUsernameColor?: string;
  authorUsernameWaveFrom?: string;
  authorUsernameWaveTo?: string;
}

/** Regroupement carte : un pin par ville, liste d'événements dans le panneau latéral. */
export interface MapEventCityCluster {
  cityKey: string;
  cityLabel: string;
  latitude: number;
  longitude: number;
  events: MapEventMarker[];
  count: number;
}

export interface StoryMusicTrack {
  title: string;
  artist: string;
  videoId?: string;
  url?: string;
}

export interface StoryTaggedUser {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}

/** Story éphémère (24 h) sur la carte. */
export interface MapStory {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  musicTrack?: StoryMusicTrack;
  taggedUsers?: StoryTaggedUser[];
  createdAt: number;
  expiresAt: number;
  /** 'public' = tout le monde, 'followers' = abonnés mutuels uniquement. Défaut : 'followers'. */
  visibility?: 'public' | 'followers';
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
    usernameColor?: string;
    usernameWaveFrom?: string;
    usernameWaveTo?: string;
  };
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

export interface TrendingUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  totalParticipants: number;
  rank: number;
  liveCount: number;
  salonCount: number;
}
