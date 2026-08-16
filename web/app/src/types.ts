import type { FeedEventType } from './lib/eventType';

export type { FeedEventType };

export type MusicPlatform = 'youtube';
export type ConnectPlatform = MusicPlatform | 'instagram';

export type AccountStatus = 'active' | 'pending' | 'blocked';

export type StaffRole = 'admin' | 'dev';

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
  avatarUrl?: string;
  accountStatus: AccountStatus;
  isAdmin: boolean;
  /** Rôle staff : admin (opérationnel) ou dev (panel complet). */
  staffRole?: StaffRole;
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
  platformPlanId?: 'free' | 'onscen_plus' | 'onscen_ultra';
  platformPlanLabel?: string;
  followingCount?: number;
  salonsHosted?: number;
  activeLivesHosted?: number;
  totalLivesHosted?: number;
  blockedUntil?: number;
  blockedReason?: string;
  blockedAt?: number;
  emailVerified?: boolean;
  stripeConnectReady?: boolean;
  connectedPlatformsCount?: number;
  onboardingCompleted?: boolean;
}

export interface AdminUserSocialBrief {
  id: string;
  username: string;
  email: string;
  accountStatus: AccountStatus;
}

export interface AdminUserSocialResponse {
  followers: AdminUserSocialBrief[];
  following: AdminUserSocialBrief[];
  followersTotal: number;
  followingTotal: number;
}

export type AdminUserSort = 'lastSeen' | 'memberSince' | 'username' | 'status';

export type AdminUserStaffFilter = 'all' | 'staff' | 'admin' | 'dev';
export type AdminUserPlanFilter = 'all' | 'free' | 'onscen_plus' | 'onscen_ultra';

export interface AdminUserAuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminUserAuditResponse {
  entries: AdminUserAuditEntry[];
  available: boolean;
}

/** Restauration de compte — spec commun/docs/RESTORE-COMPTE-ADMIN.md. */
export interface UserSnapshotMeta {
  id: string;
  userId: string;
  createdAt: number;
  createdBy?: string;
  reason?: string;
  sizeBytes: number;
  formatVersion: number;
  itemCounts: {
    feedPosts: number;
    reels: number;
    stories: number;
    albums: number;
    compositions: number;
  };
}

export interface AccessAdminUsersResponse {
  users: AccessManagedUser[];
  total: number;
  counts: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
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

export type SponsorPlacement =
  | 'map_banner'
  | 'map_sidebar_events'
  | 'feed_inline'
  | 'stories_banner'
  | 'stories_sponsored'
  | 'reels_sponsored'
  | 'salon_theater';
export type SponsorAccent = 'purple' | 'pink' | 'amber' | 'cyan' | 'rose';
export type SponsorKind = 'promo' | 'sponsored';
export type SponsorFilter = 'all' | 'active' | 'inactive';
export type SponsorMapVisibilityScope = 'france' | 'region';
export type SponsorBannerDisplayMode = 'full' | 'image_only';

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  /** Image de fond du bandeau carte (map_banner uniquement). */
  bannerImageUrl?: string;
  linkUrl?: string;
  placement: SponsorPlacement;
  active: boolean;
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
  actionId?: 'salon' | 'live';
  /** Durée d'affichage dans le carrousel (secondes). */
  displayDurationSec?: number;
  /** URL vidéo (reels sponsorisés). */
  videoUrl?: string;
  /** Vignette / poster (reels sponsorisés). */
  posterUrl?: string;
  /** Bandeau carte : France entière ou zone régionale. */
  mapVisibilityScope?: SponsorMapVisibilityScope;
  mapTargetRegionName?: string;
  mapTargetLat?: number;
  mapTargetLng?: number;
  /** Sidebar carte : id publication événement (map_sidebar_events). */
  linkedEventPostId?: string;
  linkedReelId?: string;
  createdAt: number;
  updatedAt: number;
  /** Estimation admin (liste / détail) — utilisateurs actifs 30 j susceptibles de voir le sponsor. */
  audienceEstimate?: SponsorAudienceEstimate;
}

export type SponsorAudienceBasis = 'active_30d_all' | 'active_30d_region' | 'active_30d_rotation';

export interface SponsorAudienceEstimate {
  estimatedUsers: number;
  eligibleUsers: number;
  basis: SponsorAudienceBasis;
  regionRadiusKm?: number;
  rotationEveryN?: number;
}

export interface SponsorPlatformConfig {
  reelsSponsorEnabled: boolean;
  reelsSponsorEveryN: number;
  storiesSponsorEnabled: boolean;
  storiesSponsorEveryN: number;
}

export interface ReelsSponsorsResponse {
  items: ReelsSponsorAd[];
  config: Pick<SponsorPlatformConfig, 'reelsSponsorEnabled' | 'reelsSponsorEveryN'>;
}

export interface StoriesSponsorsResponse {
  items: ReelsSponsorAd[];
  config: Pick<SponsorPlatformConfig, 'storiesSponsorEnabled' | 'storiesSponsorEveryN'>;
}

export interface ReelsSponsorAd {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent: SponsorAccent;
  sponsor?: string;
  kind?: SponsorKind;
  logoUrl?: string;
  displayDurationSec?: number;
  videoUrl?: string;
  posterUrl?: string;
}

export interface SponsorCounts {
  total: number;
  active: number;
  inactive: number;
}

export interface AdminSponsorsListResponse {
  items: Sponsor[];
  total: number;
  counts: SponsorCounts;
}

export interface MapAdItem {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent?: SponsorAccent;
  sponsor?: string;
  kind?: SponsorKind;
  logoUrl?: string;
  bannerImageUrl?: string;
  bannerDisplayMode?: SponsorBannerDisplayMode;
  actionId?: 'salon' | 'live';
  displayDurationSec?: number;
  videoUrl?: string;
  posterUrl?: string;
}

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
  genres: string[];
  chatMessageCount: number;
  queueLength: number;
  banCount: number;
  vipModeratorCount: number;
  linkedLiveViewers?: number;
  linkedLivePeakViewers?: number;
  linkedLiveDonationsCount: number;
  linkedLiveDonationsTotalEur: number;
  linkedLiveDurationMs?: number;
}

export interface AdminLiveRow {
  id: string;
  title: string;
  platform: MusicPlatform;
  isActive: boolean;
  viewersCount: number;
  peakViewersCount: number;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  salonId?: string;
  salonTitle?: string;
  salonListenersCount?: number;
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
  chatMessageCount: number;
  banCount: number;
  vipModeratorCount: number;
  donationsCount: number;
  donationsTotalEur: number;
  streamMode?: 'webrtc' | 'cloudflare' | 'livekit';
  tipsEnabled: boolean;
  contentCategory?: 'music' | 'dance' | 'artistic';
  donationOptionsCount: number;
}

export interface AdminEventRow {
  id: string;
  content: string;
  eventDate?: string;
  eventDates?: string[];
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

export interface StripePlatformStatusReport {
  fetchedAt: string;
  stripeConfigured: boolean;
  simulationMode: boolean;
  keyMode: 'live' | 'test' | 'unknown';
  platformFeePercent: number;
  connected: boolean;
  accountId: string | null;
  businessName: string | null;
  email: string | null;
  country: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  availableBalanceEur: number | null;
  pendingBalanceEur: number | null;
  dashboardUrl: string;
  applicationFeesUrl: string;
  setupHint: string | null;
  error: string | null;
}

export type IntegrationAccountSource = 'live' | 'derived' | 'declared';

export interface IntegrationAccount {
  email: string | null;
  name: string | null;
  project: string | null;
  source: IntegrationAccountSource;
}

export interface StripeConfigStatus {
  configured: boolean;
  mode: 'live' | 'test' | 'unknown';
  secretKeyMasked: string | null;
  publishableKeyMasked: string | null;
  webhookSecretConfigured: boolean;
  webhookSecretMasked: string | null;
  donationsEnabled: boolean;
  subscriptionsEnabled: boolean;
  envFileFound: boolean;
  hotReload: true;
  account?: IntegrationAccount | null;
}

export type StripeConfigFieldErrorField = 'secretKey' | 'publishableKey' | 'webhookSecret' | 'mode';

export interface StripeConfigFieldError {
  field: StripeConfigFieldErrorField;
  message: string;
}

// ── Intégrations / clés API tierces génériques (admin → Intégrations) ──────
// Même principe que StripeConfigStatus (write-only, masqué) mais générique à
// tout provider déclaré côté backend (registre externalSecretsRegistry.ts).

export type ExternalSecretFieldKind = 'secret' | 'public';
export type ExternalSecretFieldFormat = 'token' | 'id' | 'httpUrl' | 'wsUrl' | 'mailtoOrUrl' | 'freeText';

export interface ExternalSecretFieldStatus {
  key: string;
  kind: ExternalSecretFieldKind;
  format: ExternalSecretFieldFormat;
  required: boolean;
  placeholder?: string;
  configured: boolean;
  /** Valeur en clair — uniquement pour les champs "public" configurés. */
  value: string | null;
  /** Aperçu masqué — uniquement pour les champs "secret" configurés. */
  masked: string | null;
}

export type ExternalSecretIssueType =
  | 'partial_config'
  | 'placeholder_value'
  | 'invalid_format'
  | 'test_mode_in_production';
export type ExternalSecretIssueSeverity = 'critical' | 'warning' | 'info';

export interface ExternalSecretIssue {
  type: ExternalSecretIssueType;
  severity: ExternalSecretIssueSeverity;
  /** Nom de la variable concernée — jamais sa valeur. */
  field: string;
  messageKey: string;
}

export type ExternalSecretCategory =
  | 'connexion'
  | 'payments'
  | 'lives'
  | 'security'
  | 'storage'
  | 'comms'
  | 'admin';

export interface ExternalSecretProviderStatus {
  id: string;
  configured: boolean;
  helpUrl?: string;
  fields: ExternalSecretFieldStatus[];
  issues: ExternalSecretIssue[];
  account?: IntegrationAccount | null;
  readOnly?: boolean;
  category?: ExternalSecretCategory;
}

export interface ExternalSecretsStatusResponse {
  providers: ExternalSecretProviderStatus[];
  envFileFound: boolean;
}

export type DeployEnvironmentId = 'dev' | 'preprod' | 'prod';
export type EnvironmentHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface EnvironmentStatusResponse {
  id: string;
  label: string;
  siteUrl: string;
  status: EnvironmentHealthStatus;
  db?: 'ok' | 'error' | 'disabled';
  services?: Record<string, string> | null;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
}

export interface StatsTopReel {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  viewCount: number;
}

export interface StatsTopSalon {
  id: string;
  title: string;
  hostName: string;
  listenersCount: number;
}

export interface StatsTopLive {
  id: string;
  title: string;
  hostName: string;
  viewersCount: number;
}

export interface StatsOverviewResponse {
  generatedAt: string;
  users: {
    total: number;
    onlineNow: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    newLast7Days: number;
    newLast30Days: number;
    inactive30Days: number;
    withGeoOrCity: number;
    pendingAccounts: number;
    blockedAccounts: number;
    activeTodayLastSeen: number;
    activeWeekLastSeen: number;
    activeMonthLastSeen: number;
    activeTodayTracked: number;
    activeWeekTracked: number;
    activeMonthTracked: number;
  };
  content: {
    totalReels: number;
    activeSalonsNow: number;
    totalSalonsCreated: number;
    activeLivesNow: number;
    totalLivesStarted: number;
    totalEvents: number;
    totalUpvotes: number;
    totalAlbums: number;
    totalCompositions: number;
  };
  music: {
    compositionUpvotes: number;
    eventUpvotes: number;
    compositionPlaysTotal: number;
    compositionPlays7d: number;
  };
  engagement: {
    followRelations: number;
    usersFollowingSomeone: number;
    feedPostLikes: number;
    feedPostComments: number;
    feedPostFavorites: number;
    totalMatches: number;
    reelLikes: number;
    reelComments: number;
    directMessages: number;
    activeCreatorSubscriptions: number;
    activePlatformSubscriptions: number;
  };
  community: {
    totalStories: number;
    supportThreadsTotal: number;
    supportOpen: number;
  };
  moderation: {
    reportsTotal: number;
    reportsPending: number;
  };
  sponsors: {
    total: number;
    activeNow: number;
    activeByPlacement: Record<string, number>;
    impressionsTotal: number;
    clicksTotal: number;
    ctrTotal: number;
    impressions7d: number;
    clicks7d: number;
    ctr7d: number;
    impressions30d: number;
    clicks30d: number;
    ctr30d: number;
    byPlacementMetrics: {
      placement: string;
      impressions30d: number;
      clicks30d: number;
      ctr30d: number;
    }[];
    topByImpressions30d: {
      sponsorId: string;
      sponsorName: string;
      impressions30d: number;
      clicks30d: number;
      ctr30d: number;
    }[];
  };
  retention: {
    cohorts: {
      cohortWeek: string;
      registered: number;
      week1Retained: number;
      week4Retained: number;
      week1Rate: number;
      week4Rate: number;
      week1Mature: boolean;
      week4Mature: boolean;
      week1RetainedLogin: number;
      week4RetainedLogin: number;
      week1RateLogin: number;
      week4RateLogin: number;
    }[];
  };
  monetization: {
    estimatedMrrCents: number;
    estimatedMrrCreatorCents: number;
    estimatedMrrPlatformCents: number;
    stripeMrrCents: number;
    simulationMrrCents: number;
    activeSubscriptions: number;
    activeCreatorSubscriptions: number;
    activePlatformSubscriptions: number;
    subscriptionsStripe: number;
    subscriptionsSimulation: number;
    tipsMonthCents: number;
    tipsAllTimeCents: number;
    tipsMonthStripeCents: number;
    tipsMonthSimulationCents: number;
    platformFeesMonthCents: number;
    platformFeesAllTimeCents: number;
    platformFeesMonthStripeCents: number;
    platformRevenueMonthEstimateCents: number;
    platformRevenueMonthStripeCents: number;
    stripeReconciledMrrCents: number;
    stripeReconciledPlatformMrrCents: number;
    stripeMrrReconcileDeltaCents: number;
    subscriptionInvoicesPaidMonthCents: number;
    subscriptionPlatformFeesMonthCents: number;
    platformFeePercent: number;
    donationsSimulationMode: boolean;
  };
  analytics30d: {
    logins: number;
    messagesSent: number;
    salonsCreated: number;
    livesStarted: number;
    reelsViewed: number;
    matchesCreated: number;
    favoritesAdded: number;
    reelsCreated: number;
  };
  topReels: StatsTopReel[];
  topSalons: StatsTopSalon[];
  topLives: StatsTopLive[];
}

export interface ExternalSecretFieldError {
  field: string;
  message: string;
}

export type ProdSaasEnvironment = 'production' | 'preproduction' | 'msdev' | 'development';
export type ProdSaasServiceStatus = 'configured' | 'missing' | 'external' | 'disabled';

export interface ProdSaasExternalLink {
  label: string;
  url: string;
  note?: string;
}

export interface ProdSaasLinkGroup {
  id: string;
  links: ProdSaasExternalLink[];
}

export type ProdSaasAlertSeverity = 'critical' | 'warning' | 'info';

export interface ProdSaasAlert {
  id: string;
  severity: ProdSaasAlertSeverity;
  messageKey: string;
  params?: Record<string, string>;
}

export interface ProdSaasServiceReport {
  id: string;
  category: string;
  requiredInProd: boolean;
  status: ProdSaasServiceStatus;
  configured: boolean;
  indicativeCost: string;
  note?: string;
  dashboardUrl?: string;
  docsUrl?: string;
  flags?: Record<string, boolean | string>;
}

export interface ProdSaasStatusReport {
  fetchedAt: string;
  environment: ProdSaasEnvironment;
  services: ProdSaasServiceReport[];
  linkGroups: ProdSaasLinkGroup[];
  alerts: ProdSaasAlert[];
}

export interface AdminDonationEntry {
  id: string;
  liveId: string;
  liveTitle: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amountEur: number;
  amountCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  paymentMode: 'simulation' | 'stripe';
  timestamp: number;
}

export interface AdminDonationsHistoryResponse {
  fetchedAt: string;
  simulationMode: boolean;
  platformFeePercent: number;
  total: number;
  items: AdminDonationEntry[];
}

export interface VpsMetricsReport {
  fetchedAt: string;
  platform: string;
  hostname: string;
  env: string;
  source: 'system' | 'partial' | 'mock';
  uptimeSeconds: number;
  latencyMs: number;
  latencySource: 'postgres' | 'internal';
  memory: {
    usedBytes: number;
    totalBytes: number;
    freeBytes: number;
    usedPercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
  };
  cpu: {
    cores: number;
    model: string;
    loadAverage1m: number | null;
    loadAverage5m: number | null;
    loadAverage15m: number | null;
    loadPercent: number | null;
  };
  disk: {
    usedBytes: number | null;
    totalBytes: number | null;
    freeBytes: number | null;
    usedPercent: number | null;
    mountPoint: string | null;
    source: 'statfs' | 'unavailable';
  };
  node: {
    version: string;
    pid: number;
  };
  warnings: string[];
}

export interface SyslogLine {
  ts: string;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  raw: string;
}

export interface SyslogResponse {
  lines: SyslogLine[];
  count: number;
  type: 'pm2' | 'system';
  fetchedAt: string;
}

export interface BackupBucketStatus {
  dir: string;
  exists: boolean;
  count: number;
  latestFile: string | null;
  latestAt: string | null;
  ageHours: number | null;
  totalBytes: number;
  stale: boolean;
  staleThresholdHours: number;
}

export interface BackupsStatusReport {
  fetchedAt: string;
  source: 'filesystem' | 'unavailable';
  root: string;
  retentionDays: {
    db: number;
    uploads: number;
    offsite: number;
  };
  db: BackupBucketStatus;
  uploads: BackupBucketStatus;
  offsiteDb: { dir: string; exists: boolean; count: number };
  offsiteUploads: { dir: string; exists: boolean; count: number };
  cron: {
    source: 'crontab' | 'unavailable';
    db: boolean;
    uploads: boolean;
    offsite: boolean;
  };
  warnings: string[];
}

export interface AppDiagnosticLog {
  id: string;
  createdAt: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  username?: string;
  url?: string;
  userAgent?: string;
  clientId?: string;
  origin?: 'server' | 'local';
}

export interface AppDiagnosticLogsResponse {
  logs: AppDiagnosticLog[];
  count: number;
  total: number;
  persisted: boolean;
  retentionMonths: number;
  fetchedAt: string;
}

export interface AdminBackupFileInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  ageHours: number;
}

export interface AdminBackupsReport {
  scanAvailable: boolean;
  backupDir: string;
  maxBackupAgeHours: number;
  dbBackups: AdminBackupFileInfo[];
  uploadBackups: AdminBackupFileInfo[];
  offsiteConfigured: boolean;
  offsiteDir: string | null;
  offsiteLatest: AdminBackupFileInfo | null;
  warnings: string[];
}

export interface AdminDiagnosticLogStats {
  persisted: boolean;
  total: number;
  byLevel: Record<string, number>;
  recentErrors24h: number;
  lastErrorAt: string | null;
}

export interface AdminSentryReport {
  configured: boolean;
  active: boolean;
  release: string;
  environment: string;
  tracesSampleRate: number;
  dashboardUrl: string;
}

export interface AdminPostGisEntityStats {
  total: number;
  withGeom: number;
}

export interface AdminPostGisReport {
  enabled: boolean;
  version?: string;
  entities?: {
    users: AdminPostGisEntityStats;
    salons: AdminPostGisEntityStats;
    lives: AdminPostGisEntityStats;
  };
}

export interface AdminDbContentHealthReport {
  postgresEnabled: boolean;
  connected: boolean;
  ok: boolean;
  warnings: string[];
  tables: {
    users: number;
    feed_posts: number;
    feed_post_comments: number;
    feed_post_likes: number;
    stories: number;
    user_reels: number;
    user_albums: number;
    user_compositions: number;
    notifications: number;
  };
  memory: {
    feedPosts: number;
    stories: number;
    userReels: number;
    albums: number;
    compositions: number;
  };
  drift: {
    feedPosts: number;
    stories: number;
    userReels: number;
    albums: number;
    compositions: number;
  };
}

export interface AdminDiagnosticsReport {
  fetchedAt: string;
  environment: string;
  health: {
    status: 'OK' | 'degraded';
    db: 'ok' | 'error' | 'disabled';
    poolOk: boolean;
  };
  sentry: AdminSentryReport;
  postgis: AdminPostGisReport;
  database: AdminDbContentHealthReport;
  diagnosticLogs: AdminDiagnosticLogStats;
  backups: AdminBackupsReport;
  links: {
    healthPath: string;
    healthDbPath: string;
    sentryOrg: string;
  };
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
  platform: 'youtube';
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
  /** Hex (#rrggbb) ou `wave` (dégradé OnScen). */
  usernameColor?: string;
  /** Couleur de départ du dégradé wave (hex). */
  usernameWaveFrom?: string;
  /** Couleur de fin du dégradé wave (hex). */
  usernameWaveTo?: string;
  email?: string;
  /** Compte créé via OAuth (Google/Facebook) — pas de mot de passe local. Propriétaire uniquement. */
  isOAuthAccount?: boolean;
  accountStatus?: 'active' | 'pending' | 'blocked';
  /** false tant que l'onboarding n'est pas complété. Renvoyé au propriétaire uniquement. */
  onboardingCompleted?: boolean;
  isAdmin?: boolean;
  staffRole?: StaffRole;
  /** Badge Dev visible publiquement (onscen_dev, ACCESS_ADMIN). */
  isDev?: boolean;
  avatarUrl?: string;
  profilePhotos?: string[];
  isGhostMode: boolean;
  bio?: string;
  /** Masquer la bio aux visiteurs (défaut : false). */
  hideBioOnProfile?: boolean;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
  connectedPlatforms?: MusicPlatform[];
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
  /** Nombre d'hôtes mis en favoris par ce profil (public). */
  followingCount?: number;
  /** Le visiteur a liké (favori) ce profil. */
  isFavorite?: boolean;
  hostRating?: HostRatingSummary;
  isFollowing?: boolean;
  followNotificationsEnabled?: boolean;
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
  /** Morceau en cours sur le live (si isLive). */
  liveListening?: CurrentListening;
  /** Morceau en cours dans le salon hébergé (si salon actif). */
  salonListening?: CurrentListening;
  /** Morceau en cours (salon ou live animé). */
  currentListening?: CurrentListening;
  /** Propriétaire du profil uniquement */
  shareDistance?: boolean;
  locationPrecision?: 'precise' | 'city';
  /** Accepter les messages privés (propriétaire uniquement). Défaut : true. */
  allowPrivateMessages?: boolean;
  allowExternalEventTags?: boolean;
  /** Réseaux sociaux publics (optionnels) */
  instagramHandle?: string;
  youtubeChannel?: string;
  /** Version CGU acceptée (propriétaire uniquement). */
  acceptedTermsVersion?: string;
  /** true si les CGU courantes doivent être réacceptées (propriétaire). */
  termsReacceptanceRequired?: boolean;
  /** true si un changement de mot de passe est obligatoire (propriétaire, compte admin initial). */
  passwordChangeRequired?: boolean;
  currentTermsVersion?: string;
  /** Compte Stripe Connect (acct_…) pour recevoir les pourboires live. */
  stripeConnectAccountId?: string;
  /** Horodatage d'acceptation des règles de diffusion live OnScen (UNIX ms). */
  liveTermsAcceptedAt?: number;
  /** Double authentification TOTP activée (renvoyé au propriétaire uniquement). */
  twoFactorEnabled?: boolean;
}

export interface PlaybackState {
  platform: 'youtube';
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
  platform: 'youtube';
  title: string;
  artist: string;
  trackId?: string;
  externalUrl: string;
  searchUrl: string;
  matchType: 'exact' | 'mock' | 'search';
  hostPlatform: 'youtube';
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
    | 'album_published'
    | 'track_published'
    | 'reel_published'
    | 'mention'
    | 'support_contact'
    | 'support_reply'
    | 'support_resolved'
    | 'subscription_payment_failed';
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
  albumId?: string;
  compositionId?: string;
  storyId?: string;
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
  fromEmail?: string;
  fromAvatarUrl?: string;
  accountStatus?: AccountStatus;
  fromCity?: string;
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

export interface AdminSupportCounts {
  total: number;
  open: number;
  replied: number;
  resolved: number;
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
  listeningPlatform?: 'youtube';
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
  youtubeUrl?: string;
  status: SalonProposalStatus;
  createdAt: number;
  upvotes?: string[];
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
  platform: 'youtube';
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
  /** Genres musicaux associés au salon. */
  genres?: string[];
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

export interface LiveChatConfig {
  noLinksForParticipants?: boolean;
  slowModeSeconds?: number;
  subscribersOnly?: boolean;
  blockedTerms?: string[];
}

export interface LiveDonationOption {
  id: string;
  label: string;
  amount: number;
  rewardType?: string;
}

export type LivePublicGoalType = 'amount' | 'dons' | 'likes' | 'viewers' | 'duration';

export interface LivePublicGoal {
  id: string;
  type: LivePublicGoalType;
  target: number;
  label: string;
  /** Progression affichée (fixée par l'hôte, optionnel). */
  displayCurrent?: number;
}

/** Barre objectif sur la vidéo live (position + visibilité spectateurs). */
export interface LiveDonationGoalOverlay {
  visibleToViewers: boolean;
  xPct: number;
  yPct: number;
}

/** Annonce épinglée par l'hôte en tête du chat (distinct des animations de dons). */
export interface LivePinnedAnnouncement {
  text: string;
  postedAt: number;
}

/** Sondage / Q&A live publié par l'hôte (vue publique agrégée). */
export interface LivePoll {
  id: string;
  question: string;
  options: { id: string; label: string; count: number }[];
  totalVotes: number;
  closedAt?: number;
  /** Option choisie par le viewer courant (calculée côté serveur au chargement). */
  myVote?: string;
}

export interface Live {
  id: string;
  salonId?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
  title: string;
  /** Description libre du live, modifiable en direct par l'hôte. */
  description?: string;
  /** Contenu signalé sensible/18+ par l'hôte. */
  isSensitive?: boolean;
  /** Rediffusion (VOD) activée après le live. Défaut true. */
  replayEnabled?: boolean;
  pinnedAnnouncement?: LivePinnedAnnouncement;
  activePoll?: LivePoll;
  /** Duo / co-hôte (LiveKit uniquement) : utilisateur autorisé à publier sa caméra aux côtés de l'hôte. */
  coHostId?: string;
  coHostName?: string;
  coHostAvatarUrl?: string;
  coHostInvitePending?: boolean;
  /** Visible uniquement par l'hôte : cible de l'invitation en attente. */
  coHostInviteTargetId?: string;
  platform: 'youtube';
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
  chatConfig?: LiveChatConfig;
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
  /** Menu pourboires personnalisé par l'hôte (si configuré). */
  donationOptions?: LiveDonationOption[];
  /** Goals publiés par l'hôte (progression calculée côté client). */
  donationGoals?: LivePublicGoal[];
  /** Barre objectif sur la vidéo (position + visible spectateurs). */
  donationGoalOverlay?: LiveDonationGoalOverlay;
  /** Pourboires activés sur ce live (false si l'hôte a lancé sans RIB). */
  tipsEnabled?: boolean;
  /** Catégorie de contenu : musique, danse ou artistique. */
  contentCategory?: 'music' | 'dance' | 'artistic';
  /** Délai vidéo spectateurs (secondes). */
  videoDelaySeconds?: number;
  /** Format d'image du flux hôte (cadre spectateurs). */
  videoAspectRatio?: '16:9' | '9:16' | '4:3';
  /** msdev : flux HLS simulé pour démo présentation. */
  presentationDemoStream?: boolean;
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
  hiddenFor?: string[];
  senderName?: string;
  senderAvatarUrl?: string;
  groupName?: string;
  kind?: GroupMessageKind;
  systemEvent?: GroupSystemEvent;
  systemMeta?: {
    actorName: string;
    targetName?: string;
    oldName?: string;
    newName?: string;
  };
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
  /** Dernier message groupe : kind / event pour preview i18n côté client. */
  lastMessageKind?: GroupMessageKind;
  lastSystemEvent?: GroupSystemEvent;
  lastSystemMeta?: GroupMessage['systemMeta'];
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
  isBlockedByThem?: boolean;
  isMutedByMe?: boolean;
  isMatch?: boolean;
  /** Le destinataire accepte les messages privés (fil DM). */
  acceptsPrivateMessages?: boolean;
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
  imageUrls?: string[];
  videoUrl?: string;
  createdAt: number;
  author: FeedPostAuthor;
  likeCount: number;
  likedByMe: boolean;
  upvoteCount?: number;
  upvotedByMe?: boolean;
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
  eventDates?: string[];
  /** Heures de fin parallèles à eventDates (null = pas d'heure de fin pour cette date). */
  eventEndTimes?: (string | null)[];
  eventLocation?: string;
  /** Type d'événement : danse, chant ou autre (défaut autre). */
  eventType?: FeedEventType;
  /** Comptes tagués (DJ, artiste, partenaire…). */
  eventTaggedUsers?: StoryTaggedUser[];
  /** Lien externe (billetterie, site…). */
  eventLinkUrl?: string;
}

/** Marqueur événement sur la carte (publication fil + coords résolues). */
export interface MapEventMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  eventDate?: string;
  eventDates?: string[];
  eventEndTimes?: (string | null)[];
  eventLocation?: string;
  eventType?: FeedEventType;
  eventTaggedUsers?: StoryTaggedUser[];
  authorId?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  authorUsernameColor?: string;
  authorUsernameWaveFrom?: string;
  authorUsernameWaveTo?: string;
  /** Photo de la publication événement (miniature carte/popup — priorité sur l'avatar auteur). */
  imageUrl?: string;
  /** Événement sponsorisé sidebar carte — icône ✨ sur pins / popups. */
  isSponsored?: boolean;
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
  /** Position horizontale relative 0–1 sur l'image (tag visuel). */
  x?: number;
  /** Position verticale relative 0–1 sur l'image (tag visuel). */
  y?: number;
  /** Facteur d'échelle du sticker @ (0,5–2). */
  scale?: number;
}

/** Lien cliquable sur story (sticker, non intégré au JPEG). */
export interface StoryLink {
  url: string;
  /** Texte affiché sur le sticker ; domaine ou « Voir plus » si absent. */
  label?: string;
  /** Position horizontale relative 0–1 sur l'image. */
  x: number;
  /** Position verticale relative 0–1 sur l'image. */
  y: number;
}

/** Story éphémère (24 h) sur la carte. */
export interface MapStory {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoDurationSec?: number;
  musicTrack?: StoryMusicTrack;
  taggedUsers?: StoryTaggedUser[];
  link?: StoryLink;
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

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterUsername: string;
  reporterEmail?: string;
  reporterAccountStatus?: AccountStatus;
  category: string;
  details: string;
  targetUserId?: string;
  targetUsername?: string;
  targetEmail?: string;
  targetAccountStatus?: AccountStatus;
  roomType?: 'salon' | 'live' | 'dm' | 'reel' | 'profile';
  roomId?: string;
  messageId?: string;
  createdAt: number;
  status?: 'pending' | 'reviewed' | 'dismissed';
  reviewedAt?: number;
  priority?: 'urgent' | 'normal';
}

export interface AdminReportCounts {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  urgent: number;
}

export type AiAgentId = 'ceo' | 'dev';

export interface AiAgentDefinition {
  id: AiAgentId;
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CeoDataGap {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium';
  question: string;
  whyItMatters: string;
  suggestedField: string;
}

export interface CeoContextMeta {
  dataGaps: CeoDataGap[];
  founderContextLoaded: boolean;
  founderContextPath: string | null;
  founderContextExample: string;
  aiTeam?: AiTeamRecruitmentAnalysis;
}

export type AiTeamRecPriority = 'critical' | 'high' | 'medium' | 'low' | 'not_now';

export interface AiTeamRecommendation {
  agentId: string;
  name: string;
  suggestedEmoji: string;
  priority: AiTeamRecPriority;
  urgencyScore: number;
  alreadyExists: boolean;
  headline: string;
  whyNow: string[];
  whyCeoAloneIsInsufficient: string[];
  whatYouGain: string[];
  costOfWaiting: string[];
  expectedDeliverables: string[];
  successMetrics30d: string[];
  prerequisites: string[];
  whenNotToHire: string[];
  estimatedApiCostEurMonth: string;
  firstWeekActions: string[];
  exampleQuestions: string[];
}

export interface AiTeamRecruitmentAnalysis {
  philosophy: string;
  currentRoster: { id: string; name: string; emoji: string }[];
  missingRolesCount: number;
  topRecommendation: string | null;
  summaryForFounder: string;
  recommendations: AiTeamRecommendation[];
}

export interface AiAgentsStatus {
  enabled: boolean;
  configured: boolean;
  provider: 'anthropic' | 'openai' | null;
  model: string | null;
  agents: AiAgentDefinition[];
  usage?: AiUsageTotals;
  ceo?: CeoContextMeta;
}

export interface AiUsageTotals {
  month: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
  requestCount: number;
  usdToEurRate?: number;
}

export interface AiChatResponse {
  agentId: AiAgentId;
  message: AiChatMessage;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  cost?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    costEur: number;
  };
  monthUsage?: AiUsageTotals;
}
