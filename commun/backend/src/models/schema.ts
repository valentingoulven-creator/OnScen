export type MusicPlatform = 'youtube';

/** Plateformes liées au profil (streaming + réseaux sociaux). */
export type ConnectPlatform = MusicPlatform | 'instagram';

export type ListeningRole = 'auditeur' | 'host' | 'les_deux';

export type RelationshipStatus = 'celibataire' | 'en_couple' | 'autre';

/** Type de profil / activité (bar, DJ, compositeur, etc.) — distinct du rôle d'écoute Soundy. */
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

/** Liaison OAuth (ou msdev simulée) — source de vérité pour l’hébergement salon */
export interface PlatformAccount {
  platform: ConnectPlatform;
  externalUserId: string;
  connectedAt: number;
  accessToken?: string;
  refreshToken?: string;
  /** Unix timestamp (ms) at which the access token expires (set from expires_in on OAuth grant/refresh). */
  accessTokenExpiresAt?: number;
  displayName?: string;
  /** Avatar / chaîne (URL publique, renvoyée au propriétaire via platformLinks). */
  avatarUrl?: string;
  /** E-mail (scope OAuth) — jamais exposé aux autres utilisateurs. */
  email?: string;
  topArtists?: string[];
  oauthScopes?: string;
}

export interface User {
  id: string;
  username: string;
  /** Hex (#rrggbb) ou `wave` (dégradé Soundy). */
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
  /** Masquer la bio aux visiteurs (défaut : false). */
  hideBioOnProfile?: boolean;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
  connectedPlatforms?: MusicPlatform[];
  platformAccounts?: PlatformAccount[];
  city?: string;
  listeningRole?: ListeningRole;
  profileType?: ProfileType;
  relationshipStatus?: RelationshipStatus;
  /** Texte libre si relationshipStatus === autre. */
  relationshipStatusCustom?: string;
  /** Date de naissance ISO (YYYY-MM-DD). */
  birthDate?: string;
  /** Masquer la date de naissance aux autres visiteurs (défaut : true). */
  hideBirthDateOnProfile?: boolean;
  /** Âge dérivé de birthDate (13–120) ; absent si non renseigné. */
  age?: number;
  /** @deprecated Préférer hideBirthDateOnProfile (conservé pour rétrocompat). */
  showAge?: boolean;
  memberSince?: number;
  latitude?: number;
  longitude?: number;
  blurredLatitude?: number;
  blurredLongitude?: number;
  /** Partager la distance (km) avec les autres utilisateurs. Défaut : true. */
  shareDistance?: boolean;
  /** Accepter les messages privés de tout utilisateur. Défaut : true. */
  allowPrivateMessages?: boolean;
  /** false = refuser d'être tagué sur les événements d'autres organisateurs. Défaut : true. */
  allowExternalEventTags?: boolean;
  /** précis = position floutée ~50 m ; city = centre-ville uniquement pour les autres. */
  locationPrecision?: 'precise' | 'city';
  /** Dernière position GPS envoyée via POST /geo/update (distinct du backfill ville). */
  geoUpdatedAt?: number;
  lastSeenAt: number;
  acceptedTermsAt?: number;
  acceptedTermsVersion?: string;
  /** active par défaut ; pending = attente admin (tunnel public) ; blocked = accès refusé */
  accountStatus?: 'active' | 'pending' | 'blocked';
  /** false tant que le profil d'inscription n'est pas complété (genres, type, etc.) */
  onboardingCompleted?: boolean;
  /** Gestion des accès ngrok / tunnel public */
  isAdmin?: boolean;
  /** Rôle staff : admin (opérationnel) ou dev (panel complet). */
  staffRole?: 'admin' | 'dev';
  /** Fin de suspension temporaire (UNIX ms) — absent = suspension permanente. */
  blockedUntil?: number;
  /** Motif interne admin (non affiché à l'utilisateur). */
  blockedReason?: string;
  /** Horodatage de la dernière suspension (UNIX ms). */
  blockedAt?: number;
  /** Compteur « vous suivent » affiché (msdev démo) — remplace le décompte réel si défini. */
  favoritesCountOverride?: number;
  /** Réseaux sociaux publics (optionnels) */
  instagramHandle?: string;
  youtubeChannel?: string;
  /** Compte Stripe Connect (acct_…) pour recevoir les pourboires live en production. */
  stripeConnectAccountId?: string;
  /** Horodatage d'acceptation des règles de diffusion live Soundy (UNIX ms). */
  liveTermsAcceptedAt?: number;
  /** Attestation utilisateur d'avoir au moins 13 ans à l'inscription (UNIX ms). */
  ageConfirmedAt?: number;
  /** Vérification e-mail (inscription). */
  emailVerified?: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: number;
  /** Réinitialisation de mot de passe. */
  resetToken?: string;
  resetTokenExpiry?: number;
  /** Double authentification TOTP (Google Authenticator / Authy). */
  twoFactorEnabled?: boolean;
  /**
   * Secret TOTP. Préfixé de `pending:` pendant la phase de configuration (avant confirmation).
   * Chiffré AES-256-GCM une fois confirmé (format `iv:tag:ciphertext` en hex).
   * Absent si 2FA désactivée.
   */
  totpSecret?: string;
  /** Codes de secours bcrypt-hachés (usage unique). */
  twoFactorBackupCodes?: string[];
  /** Incrémenté à chaque changement de mot de passe — invalide les JWT antérieurs. */
  tokenVersion?: number;
  /** true = l'utilisateur doit changer son mot de passe avant d'utiliser l'app (compte admin initial, etc.). */
  mustChangePassword?: boolean;
  /** Live input Cloudflare Stream persistant pour OBS (clé RTMP unique par compte). */
  cloudflareObsLiveInputId?: string;
  /** Préférences création salon — voir lib/salonCreateSetup.ts */
  salonCreateSetup?: {
    title?: string;
    accessMode?: 'public' | 'invite';
    allowQueue?: boolean;
    genres?: string[];
    startLatitude?: number;
    startLongitude?: number;
    startLocationLabel?: string;
    startLocationSource?: 'my_position' | 'city' | 'address';
    configuredAt?: number;
  };
  /** Préférences de démarrage live — voir lib/liveMediaSetup.ts */
  liveMediaSetup?: {
    videoDeviceId?: string;
    audioDeviceId?: string;
    startLatitude?: number;
    startLongitude?: number;
    startLocationLabel?: string;
    startLocationSource?: 'my_position' | 'city' | 'address';
    liveTitle?: string;
    contentCategory?: 'music' | 'dance' | 'artistic';
    chatConfig?: {
      noLinksForParticipants?: boolean;
      slowModeSeconds?: number;
      subscribersOnly?: boolean;
    };
    hostSessionDraft?: {
      goals: Array<{ id: string; type: string; target: number; label: string }>;
      rewards: Array<Record<string, unknown>>;
    };
    useObs?: boolean;
    configuredAt?: number;
  };
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
  /** Lien direct du morceau côté hôte (YouTube). */
  externalUrl?: string;
  /** Préférence d'affichage imposée par le host : true = vidéo, false = audio seul. */
  showVideo?: boolean;
  /** Horodatage ms de la dernière récupération métadonnées YouTube Data API (conformité ToS 24 h). */
  metadataFetchedAt?: number;
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
  /** Horodatage ms de la dernière récupération métadonnées YouTube Data API. */
  metadataFetchedAt?: number;
}

export type SalonProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface SalonTrackProposal {
  id: string;
  salonId: string;
  proposerId: string;
  proposerName: string;
  title: string;
  artist: string;
  youtubeUrl?: string;
  status: SalonProposalStatus;
  createdAt: number;
  upvotes?: string[];
}

/**
 * One entry per (proposalId × voterId) pair for the current week.
 * Keyed by `${proposalId}__${voterId}` so a voter can only count once per song.
 * Old entries (votedAt < current week Monday 00:00) are ignored at query time and
 * cleaned up lazily on each new recording.
 */
export interface WeeklySongVote {
  /** `${proposalId}__${voterId}` — one active record per voter per proposal */
  id: string;
  votedAt: number;
  /** Monday 00:00 (UTC-local) timestamp of the week this vote was cast. */
  weekStart: number;
  voterId: string;
  salonId: string;
  proposalId: string;
  songTitle: string;
  songArtist: string;
  youtubeUrl?: string;
  proposerName: string;
  /** Discographie — absent for salon proposal votes. */
  sourceType?: 'salon' | 'composition' | 'reel';
  compositionId?: string;
  compositionOwnerId?: string;
  reelId?: string;
  reelOwnerId?: string;
  fileUrl?: string;
}

/** Upvote on a user composition (Discographie track). */
export interface CompositionUpvote {
  compositionId: string;
  userId: string;
  votedAt: number;
}

/** Listen event on a user composition (weekly popularity charts). */
export interface CompositionPlay {
  id: string;
  compositionId: string;
  listenerId: string;
  playedAt: number;
  weekStart: number;
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
  /** Genres musicaux du salon (filtre carte / affinités). */
  genres?: string[];
  /** Utilisateurs VIP pouvant modérer le chat du salon. */
  vipModeratorIds?: string[];
  /** Masqué par modération admin (carte et listes publiques). */
  adminBlocked?: boolean;
  adminBlockedAt?: number;
}

export interface SalonBan {
  permanent: boolean;
  until?: number;
  bannedAt: number;
}

export interface LiveChatConfig {
  /** Supprime automatiquement les liens des non-modérateurs. */
  noLinksForParticipants?: boolean;
  /** Mode lent : délai minimum en secondes entre deux messages d'un même participant. */
  slowModeSeconds?: number;
  /** Réserve le chat aux abonnés du créateur uniquement. */
  subscribersOnly?: boolean;
}

/** Option de pourboire configurée par l'hôte (catalogue récompenses). */
export interface LiveDonationOption {
  id: string;
  label: string;
  amount: number;
  /** Type de récompense (emoji côté client). */
  rewardType?: string;
}

/** Goal public publié par l'hôte (progression calculée côté client). */
export interface LivePublicGoal {
  id: string;
  type: 'amount' | 'dons' | 'likes' | 'viewers' | 'duration';
  target: number;
  label: string;
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
  /** Horodatage de fin (live archivé). */
  endedAt?: number;
  /** Host a activé la caméra ou un fichier vidéo local. */
  cameraActive?: boolean;
  /** Type de flux visuel hôte : caméra (relayée WebRTC) ou fichier local (aperçu hôte uniquement). */
  cameraMode?: 'camera' | 'file';
  /** Utilisateurs VIP pouvant modérer le chat public du live. */
  vipModeratorIds?: string[];
  /** Configuration du chat live (modération auto). */
  chatConfig?: LiveChatConfig;
  /** Masqué par modération admin (carte et listes publiques). */
  adminBlocked?: boolean;
  adminBlockedAt?: number;
  /** Mode de diffusion vidéo : mesh WebRTC, LiveKit Cloud ou Cloudflare Stream (HLS/CDN). */
  streamMode?: 'webrtc' | 'cloudflare' | 'livekit';
  /** UID Cloudflare Live Input (ingest + playback). */
  cloudflareLiveInputId?: string;
  /** URL manifest HLS pour les spectateurs. */
  cloudflarePlaybackUrl?: string;
  /** Sous-domaine customer-xxx.cloudflarestream.com (dérivé ou env). */
  cloudflareCustomerSubdomain?: string;
  /** URL HLS de rediffusion (conservée après arrêt du live Cloudflare). */
  cloudflareVodPlaybackUrl?: string;
  /** Pic de spectateurs simultanés pendant le live. */
  peakViewersCount?: number;
  /** Menu pourboires personnalisé par l'hôte (catalogue récompenses). */
  donationOptions?: LiveDonationOption[];
  /** Goals actifs publiés par l'hôte (progression via stats live). */
  donationGoals?: LivePublicGoal[];
  /** Pourboires activés sur ce live (false si l'hôte a choisi « sans RIB » au lancement). */
  tipsEnabled?: boolean;
  /** Catégorie de contenu : musique, danse ou artistique. */
  contentCategory?: 'music' | 'dance' | 'artistic';
  /** Délai vidéo pour les spectateurs (secondes). 0 = temps réel. */
  videoDelaySeconds?: number;
  /** Format d'image du flux hôte (16:9, 9:16, 4:3) — cadre spectateurs. */
  videoAspectRatio?: '16:9' | '9:16' | '4:3';
  /** msdev : flux HLS public simulé pour démos présentation (sans OBS réel). */
  presentationDemoStream?: boolean;
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
  /** Badge Dev visible dans le chat (compte développeur). */
  senderIsDev?: boolean;
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

export type GroupMessageKind = 'user' | 'system';

export type GroupSystemEvent =
  | 'group_created'
  | 'group_renamed'
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'admin_transferred';

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  timestamp: number;
  /** Utilisateurs pour lesquels ce message est masqué (suppression locale). */
  hiddenFor?: string[];
  /** Message utilisateur (défaut) ou notification système (renommage, membres, admin). */
  kind?: GroupMessageKind;
  systemEvent?: GroupSystemEvent;
  systemMeta?: {
    actorName: string;
    targetName?: string;
    oldName?: string;
    newName?: string;
  };
}

export interface Gift {
  id: string;
  liveId: string;
  senderId: string;
  senderName: string;
  giftType: string;
  amount: number;
  timestamp: number;
  /** simulation (msdev) ou stripe (prod) — absent pour réactions gratuites historiques */
  paymentMode?: 'simulation' | 'stripe';
  paymentIntentId?: string;
}

export interface DonationPayment {
  id: string;
  paymentIntentId: string;
  liveId: string;
  senderId: string;
  hostId?: string;
  amountCents: number;
  platformFeeCents?: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  createdAt: number;
  /** Remboursement admin (Stripe Refund object id). */
  refundId?: string;
  refundedAmountCents?: number;
  refundedAt?: number;
  refundedBy?: string;
  refundReason?: string;
}

/** Abonnement mensuel à un créateur ou à Soundy+ (plateforme). */
export interface CreatorSubscription {
  id: string;
  subscriberId: string;
  /** userId du créateur, ou `platform` pour Soundy+ */
  creatorId: string;
  tierId: string;
  tierLabel: string;
  amountCents: number;
  targetType: 'creator' | 'platform';
  status: 'active' | 'canceled' | 'past_due';
  paymentMode: 'simulation' | 'stripe';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodEnd: number;
  createdAt: number;
  updatedAt: number;
  /** Horodatage du dernier `invoice.payment_failed` reçu (dunning applicatif). */
  paymentFailedAt?: number;
  /** Remboursement admin (Stripe Refund object id) sur la dernière facture payée. */
  refundId?: string;
  refundedAmountCents?: number;
  refundedAt?: number;
  refundedBy?: string;
  refundReason?: string;
}

export interface SubscriptionCheckout {
  id: string;
  sessionId: string;
  subscriberId: string;
  creatorId: string;
  tierId: string;
  targetType: 'creator' | 'platform';
  status: 'pending' | 'completed' | 'expired';
  createdAt: number;
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

export type SupportContactStatus = 'open' | 'replied' | 'resolved';

export interface SupportThreadMessage {
  id: string;
  role: 'user' | 'admin';
  body: string;
  createdAt: number;
  authorUserId: string;
}

/** Emplacement d'affichage d'un sponsor dans l'application. */
export type SponsorPlacement =
  | 'map_banner'
  | 'map_sidebar_events'
  | 'feed_inline'
  | 'stories_banner'
  | 'stories_sponsored'
  | 'reels_sponsored'
  | 'salon_theater';

/** Configuration globale des sponsors (admin). */
export interface SponsorPlatformConfig {
  reelsSponsorEnabled: boolean;
  reelsSponsorEveryN: number;
  storiesSponsorEnabled: boolean;
  storiesSponsorEveryN: number;
}

export type SponsorAccent = 'purple' | 'pink' | 'amber' | 'cyan' | 'rose';

export type SponsorKind = 'promo' | 'sponsored';

/** Visibilité géographique d'un bandeau carte. */
export type SponsorMapVisibilityScope = 'france' | 'region';

/** Mode d'affichage du bandeau carte. */
export type SponsorBannerDisplayMode = 'full' | 'image_only';

/** Sponsor / bandeau publicitaire géré depuis l'administration. */
export interface Sponsor {
  id: string;
  /** Nom affiché (ex. « Deezer », « Soundy »). */
  name: string;
  logoUrl?: string;
  /** Image de fond du bandeau carte (map_banner uniquement). */
  bannerImageUrl?: string;
  linkUrl?: string;
  placement: SponsorPlacement;
  active: boolean;
  /** Ordre d'affichage (plus petit = prioritaire). */
  priority: number;
  startsAt?: number;
  endsAt?: number;
  title: string;
  subtitle: string;
  cta: string;
  accent?: SponsorAccent;
  kind: SponsorKind;
  /** Bandeau carte : texte + dégradé (full) ou image seule cliquable (image_only). */
  bannerDisplayMode?: SponsorBannerDisplayMode;
  /** Action interne (salon, live) si pas de lien externe. */
  actionId?: 'salon' | 'live';
  /** Durée d'affichage dans le carrousel (secondes, défaut 8). */
  displayDurationSec?: number;
  /** URL vidéo (reels sponsorisés). */
  videoUrl?: string;
  /** Vignette / poster (reels sponsorisés). */
  posterUrl?: string;
  /** Bandeau carte : France entière ou zone régionale (map_banner uniquement). */
  mapVisibilityScope?: SponsorMapVisibilityScope;
  /** Nom de la ville/région cible (scope region). */
  mapTargetRegionName?: string;
  /** Coordonnées cible pour le filtrage régional (scope region). */
  mapTargetLat?: number;
  mapTargetLng?: number;
  /** Sidebar carte : publication événement (map_sidebar_events). */
  linkedEventPostId?: string;
  /** Flux Reels : reel source (reels_sponsored, Dev). */
  linkedReelId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Message utilisateur → équipe Soundy (support). */
export interface SupportContactMessage {
  id: string;
  fromUserId: string;
  body: string;
  createdAt: number;
  status: SupportContactStatus;
  adminReply?: string;
  repliedAt?: number;
  repliedByUserId?: string;
  userReply?: string;
  userRepliedAt?: number;
  threadId?: string;
  thread?: SupportThreadMessage[];
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  type:
    | 'match'
    | 'live_started'
    | 'live_don'
    | 'favorite_online'
    | 'salon_invite'
    | 'salon_created'
    | 'dm_message'
    | 'group_message'
    | 'heart'
    | 'content_heart'
    | 'follow'
    | 'event_created'
    | 'event_tagged'
    | 'story_tagged'
    | 'mention'
    | 'support_contact'
    | 'support_reply'
    | 'support_resolved'
    | 'subscription_payment_failed';
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
  /** Publication du fil d'actualité (like ou événement). */
  postId?: string;
  /** Story où l'utilisateur a été tagué. */
  storyId?: string;
  /** Reel liké. */
  reelId?: string;
  /** Message support (admin ou utilisateur). */
  supportMessageId?: string;
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
  /** Piste audio séparée (morceau Discographie Soundy) — vidéo muette côté lecteur. */
  audioUrl?: string;
  /** Morceau source lorsque le son provient de la discographie utilisateur. */
  compositionId?: string;
  /** Lien externe optionnel associé au reel (URL validée à la création). */
  link?: string;
  /** Masqué par modération admin (flux et profils publics). */
  adminBlocked?: boolean;
  adminBlockedAt?: number;
}

/** Album de compositions uploadées par l'utilisateur (onglet Discographie). */
export interface UserAlbum {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  createdAt: number;
  updatedAt: number;
}

/** Morceau original uploadé par l'utilisateur (onglet Discographie du profil). */
export interface UserComposition {
  id: string;
  userId: string;
  /** Album parent ; absent = morceau sans album. */
  albumId?: string;
  title: string;
  artist?: string;
  fileUrl: string;
  durationSec?: number;
  createdAt: number;
}

/** Publication fil d'actualité (texte + image ou vidéo optionnelle). */
export interface FeedPost {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: number;
  /** ID de la publication d'origine si c'est un repartage. */
  resharedFromId?: string;
  /** Si true, la publication est un événement. */
  isEvent?: boolean;
  /** Date ISO 8601 de l'événement (ex: "2026-06-14T20:00:00.000Z"). Première date si plusieurs. */
  eventDate?: string;
  /** Dates ISO 8601 de l'événement (plusieurs séances). */
  eventDates?: string[];
  /** Lieu de l'événement (texte libre). */
  eventLocation?: string;
  /** Type : dance (danse), chant, autre (défaut). */
  eventType?: 'dance' | 'chant' | 'autre';
  /** Heures de fin parallèles à eventDates (null = pas d'heure de fin pour cette date). */
  eventEndTimes?: (string | null)[];
  /** Comptes tagués (DJ, artiste, partenaire…) — ids utilisateurs. */
  eventTaggedUserIds?: string[];
  /** Lien externe (billetterie, site…) — https uniquement. */
  eventLinkUrl?: string;
  /** Masqué par modération admin (fil et carte). */
  adminBlocked?: boolean;
  adminBlockedAt?: number;
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

export interface StoryLink {
  url: string;
  label?: string;
  x: number;
  y: number;
}

export interface Story {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  /** Vidéo story (data URL ou HTTPS). imageUrl sert de poster / vignette anneau. */
  videoUrl?: string;
  /** Durée vidéo en secondes (visionneur). */
  videoDurationSec?: number;
  musicTrack?: StoryMusicTrack;
  taggedUserIds?: string[];
  link?: StoryLink;
  createdAt: number;
  expiresAt: number;
  /** 'public' = tout le monde, 'followers' = abonnés de l'auteur uniquement. Défaut : 'followers'. */
  visibility?: 'public' | 'followers';
}

/**
 * `Map<userId, User>` avec index secondaires (email / pseudo) maintenus automatiquement
 * sur `set`/`delete`/`clear` — évite les scans O(n) de `[...db.users.values()].find(...)`
 * sur les chemins chauds (login, register, reset password, vérification email).
 * Les index couvrent à la fois la valeur exacte stockée et sa forme en minuscules,
 * pour préserver le comportement exact (sensible ou non à la casse) des appelants existants.
 */
class UserIndexMap extends Map<string, User> {
  private readonly byEmailExact = new Map<string, string>();
  private readonly byEmailLower = new Map<string, string>();
  private readonly byUsernameExact = new Map<string, string>();
  private readonly byUsernameLower = new Map<string, string>();

  private unindex(user: User): void {
    if (this.byEmailExact.get(user.email) === user.id) this.byEmailExact.delete(user.email);
    if (this.byEmailLower.get(user.email.toLowerCase()) === user.id) {
      this.byEmailLower.delete(user.email.toLowerCase());
    }
    if (this.byUsernameExact.get(user.username) === user.id) this.byUsernameExact.delete(user.username);
    if (this.byUsernameLower.get(user.username.toLowerCase()) === user.id) {
      this.byUsernameLower.delete(user.username.toLowerCase());
    }
  }

  private reindex(user: User): void {
    this.byEmailExact.set(user.email, user.id);
    this.byEmailLower.set(user.email.toLowerCase(), user.id);
    this.byUsernameExact.set(user.username, user.id);
    this.byUsernameLower.set(user.username.toLowerCase(), user.id);
  }

  override set(key: string, value: User): this {
    const prev = super.get(key);
    if (prev) this.unindex(prev);
    super.set(key, value);
    this.reindex(value);
    return this;
  }

  override delete(key: string): boolean {
    const prev = super.get(key);
    if (prev) this.unindex(prev);
    return super.delete(key);
  }

  override clear(): void {
    this.byEmailExact.clear();
    this.byEmailLower.clear();
    this.byUsernameExact.clear();
    this.byUsernameLower.clear();
    super.clear();
  }

  /**
   * Filet de sécurité : si l'entrée indexée ne correspond plus au champ réel de l'utilisateur
   * (ex. mutation directe `user.email = ...` sans repasser par `.set()`), on retombe sur un
   * scan complet — plus lent mais toujours correct — et on répare l'index au passage.
   */
  private fallbackScan(predicate: (u: User) => boolean): User | undefined {
    for (const user of this.values()) {
      if (predicate(user)) {
        this.reindex(user);
        return user;
      }
    }
    return undefined;
  }

  findByEmailExact(email: string): User | undefined {
    const id = this.byEmailExact.get(email);
    const hit = id ? this.get(id) : undefined;
    if (hit && hit.email === email) return hit;
    return this.fallbackScan((u) => u.email === email);
  }

  findByEmailLower(email: string): User | undefined {
    const lower = email.toLowerCase();
    const id = this.byEmailLower.get(lower);
    const hit = id ? this.get(id) : undefined;
    if (hit && hit.email.toLowerCase() === lower) return hit;
    return this.fallbackScan((u) => u.email.toLowerCase() === lower);
  }

  findByUsernameExact(username: string): User | undefined {
    const id = this.byUsernameExact.get(username);
    const hit = id ? this.get(id) : undefined;
    if (hit && hit.username === username) return hit;
    return this.fallbackScan((u) => u.username === username);
  }

  findByUsernameLower(username: string): User | undefined {
    const lower = username.toLowerCase();
    const id = this.byUsernameLower.get(lower);
    const hit = id ? this.get(id) : undefined;
    if (hit && hit.username.toLowerCase() === lower) return hit;
    return this.fallbackScan((u) => u.username.toLowerCase() === lower);
  }
}

export const db = {
  users: new UserIndexMap(),
  salons: new Map<string, Salon>(),
  lives: new Map<string, Live>(),
  /** hostId → id du live actif courant (index O(1) — évite un scan de `lives` à chaque démarrage). */
  activeLiveByHost: new Map<string, string>(),
  salonChats: new Map<string, ChatMessage[]>(),
  salonQueues: new Map<string, SalonQueueItem[]>(),
  salonProposals: new Map<string, SalonTrackProposal[]>(),
  /** Weekly upvote ledger — one entry per (proposalId × voterId). */
  weeklyVotes: [] as WeeklySongVote[],
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
  donationPayments: [] as DonationPayment[],
  creatorSubscriptions: [] as CreatorSubscription[],
  subscriptionCheckouts: [] as SubscriptionCheckout[],
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
  albums: [] as UserAlbum[],
  compositions: [] as UserComposition[],
  compositionUpvotes: [] as CompositionUpvote[],
  compositionPlays: [] as CompositionPlay[],
  feedPosts: [] as FeedPost[],
  /** postId → Set<userId> ayant liké */
  feedPostLikes: new Map<string, Set<string>>(),
  /** postId → Set<userId> upvote (événements uniquement) */
  feedPostUpvotes: new Map<string, Set<string>>(),
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
  supportContactMessages: [] as SupportContactMessage[],
  sponsors: [] as Sponsor[],
  /** IDs of DEFAULT_SPONSORS explicitly deleted by an admin — skipped by ensureDefaultSponsors(). */
  deletedDefaultSponsorIds: new Set<string>(),
  sponsorPlatformConfig: {
    reelsSponsorEnabled: true,
    reelsSponsorEveryN: 5,
    storiesSponsorEnabled: true,
    storiesSponsorEveryN: 4,
  } as SponsorPlatformConfig,
};
