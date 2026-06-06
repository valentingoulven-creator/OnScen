export type MusicPlatform = 'spotify' | 'youtube';

export type ListeningRole = 'auditeur' | 'host' | 'les_deux';

export type RelationshipStatus = 'celibataire' | 'en_couple';

/** Type de profil / activité (bar, DJ, compositeur, etc.) — distinct du rôle d'écoute Soundly. */
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

/** Liaison OAuth (ou msdev simulée) — source de vérité pour l’hébergement salon */
export interface PlatformAccount {
  platform: MusicPlatform;
  externalUserId: string;
  connectedAt: number;
  accessToken?: string;
  refreshToken?: string;
  displayName?: string;
}

export interface User {
  id: string;
  username: string;
  /** Hex (#rrggbb) ou `wave` (dégradé Soundly). */
  usernameColor?: string;
  /** Couleur de départ du dégradé wave (hex, si usernameColor === wave). */
  usernameWaveFrom?: string;
  /** Couleur de fin du dégradé wave (hex, si usernameColor === wave). */
  usernameWaveTo?: string;
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
  profileType?: ProfileType;
  relationshipStatus?: RelationshipStatus;
  /** Âge renseigné (13–120) ; absent si non renseigné. */
  age?: number;
  /** Afficher l'âge sur le profil public (défaut : false). */
  showAge?: boolean;
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
  acceptedTermsAt?: number;
  acceptedTermsVersion?: string;
  /** active par défaut ; pending = attente admin (tunnel public) ; blocked = accès refusé */
  accountStatus?: 'active' | 'pending' | 'blocked';
  /** Gestion des accès ngrok / tunnel public */
  isAdmin?: boolean;
  /** Compteur « vous suivent » affiché (msdev démo) — remplace le décompte réel si défini. */
  favoritesCountOverride?: number;
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
  /** Préférence d'affichage imposée par le host : true = vidéo, false = audio seul. */
  showVideo?: boolean;
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
  /** Utilisateurs VIP pouvant modérer le chat du salon. */
  vipModeratorIds?: string[];
}

export interface SalonBan {
  permanent: boolean;
  until?: number;
  bannedAt: number;
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
  /** Couleur du pseudo à l’envoi (hex ou wave). */
  senderUsernameColor?: string;
  senderUsernameWaveFrom?: string;
  senderUsernameWaveTo?: string;
  content: string;
  timestamp: number;
  /** Pièce jointe (image ou fichier encodé en base64 data URL). */
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
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
  /** Réactions emoji : emoji → tableau d'userId ayant réagi. */
  reactions?: Record<string, string[]>;
  /** Pièce jointe encodée en base64 data URL. */
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMimeType?: string;
}

export interface MessageGroup {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  createdAt: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  timestamp: number;
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

export interface UserMute {
  muterId: string;
  mutedId: string;
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
  type: 'match' | 'live_started' | 'live_don' | 'favorite_online' | 'dm_message' | 'group_message';
  message: string;
  read: boolean;
  createdAt: number;
  matchId?: string;
  liveId?: string;
  salonId?: string;
  /** Expéditeur du DM (pour ouvrir la conversation). */
  peerUserId?: string;
  /** Groupe de messages (notification group_message). */
  groupId?: string;
}

export interface UserFavorite {
  fanId: string;
  hostId: string;
  notificationsEnabled: boolean;
  createdAt: number;
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

/** Publication fil d'actualité (texte + image optionnelle). */
export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  /** ID de la publication d'origine si c'est un repartage. */
  resharedFromId?: string;
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

export interface FeedPostFavorite {
  postId: string;
  userId: string;
  createdAt: number;
}

/** Story éphémère (24 h) affichée sur la carte. */
export interface StoryMusicTrack {
  title: string;
  artist: string;
  videoId?: string;
  url?: string;
}

export interface Story {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  musicTrack?: StoryMusicTrack;
  taggedUserIds?: string[];
  createdAt: number;
  expiresAt: number;
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
  /** salonId → userId → ban */
  salonBans: new Map<string, Map<string, SalonBan>>(),
  directMessages: [] as DirectMessage[],
  messageGroups: [] as MessageGroup[],
  groupMessages: [] as GroupMessage[],
  /** userId → (groupId → dernier message lu, timestamp) */
  groupReadCursors: new Map<string, Map<string, number>>(),
  /** userId → (otherUserId → dernier message lu, timestamp) */
  dmReadCursors: new Map<string, Map<string, number>>(),
  gifts: [] as Gift[],
  hostRatings: [] as HostRating[],
  userBlocks: [] as UserBlock[],
  userMutes: [] as UserMute[],
  notifications: [] as AppNotification[],
  heartEvents: [] as HeartEvent[],
  matches: [] as MusicMatch[],
  reelLikes: new Map<string, Set<string>>(),
  reelComments: new Map<string, ReelComment[]>(),
  reelShares: new Map<string, Set<string>>(),
  /** Spectateurs uniques par reel */
  reelViews: new Map<string, Set<string>>(),
  userReels: [] as UserReel[],
  feedPosts: [] as FeedPost[],
  /** postId → Set<userId> ayant liké */
  feedPostLikes: new Map<string, Set<string>>(),
  /** postId → commentaires */
  feedPostComments: new Map<string, FeedPostComment[]>(),
  /** userId → Set<postId> en favoris */
  feedPostFavorites: new Map<string, Set<string>>(),
  stories: [] as Story[],
  /** followerId → ensemble des userId suivis */
  userFollows: new Map<string, Set<string>>(),
  /** fanId → Map<hostId, UserFavorite> */
  userFavorites: new Map<string, Map<string, UserFavorite>>(),
  /**
   * Statut de la demande de conversation DM (premier message).
   * Clé : `${senderId}::${receiverId}` (directionnel A→B).
   * Valeurs : 'pending' | 'accepted' | 'refused'
   */
  dmPendingPairs: new Map<string, 'pending' | 'accepted' | 'refused'>(),
};
