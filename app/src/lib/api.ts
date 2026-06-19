import i18n from '../i18n';
import {
  readCachedPlatformStatus,
  writeCachedPlatformStatus,
  type PlatformStatusResponse,
} from './platformStatusCache';
import { serializeFeedAlgoForApi, type ReelFeedAlgorithmPreferences } from './reelFeedAlgorithm';

const API = '/api';

/** JWT hors Authorization pour ne pas écraser le Basic Auth Caddy (reverse proxy). */
const AUTH_TOKEN_HEADER = 'X-Auth-Token';

function headers(token?: string | null): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h[AUTH_TOKEN_HEADER] = token;
  return h;
}

function normalizeFetchNetworkError(e: unknown): never {
  if (e instanceof TypeError) {
    const m = e.message.toLowerCase();
    if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
      throw new Error(i18n.t('errors.network'));
    }
  }
  throw e;
}

export class ApiRequestError extends Error {
  code?: string;
  status?: number;
  playbackState?: import('../types').PlaybackState;
  queue?: import('../types').SalonQueueItem[];

  constructor(
    message: string,
    code?: string,
    status?: number,
    playbackState?: import('../types').PlaybackState,
    queue?: import('../types').SalonQueueItem[]
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.playbackState = playbackState;
    this.queue = queue;
  }
}

async function parseApiError(res: Response): Promise<ApiRequestError> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const json = JSON.parse(text) as {
        error?: string;
        code?: string;
        playbackState?: import('../types').PlaybackState;
        queue?: import('../types').SalonQueueItem[];
      };
      const playbackState = json.playbackState;
      const queue = json.queue;
      if (json.error) {
        if (json.error === 'Token manquant' || json.error === 'Token invalide') {
          return new ApiRequestError(i18n.t('errors.sessionExpired'), json.code, res.status);
        }
        if (json.code === 'dm_mutual_follow_required') {
          return new ApiRequestError(i18n.t('dm.mutualFollowRequired'), json.code, res.status);
        }
        if (json.code === 'spotify_not_connected') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorNotConnected'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_token_expired') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorTokenExpired'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_scope_missing') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorPlaylistScopeMissing'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_playlist_forbidden') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorPlaylistPrivate'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_playlist_private') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorPlaylistPrivate'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_playlist_not_found') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorPlaylistNotFound'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_premium_required') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorPremiumRequired'),
            json.code,
            res.status
          );
        }
        if (json.code === 'HOST_PLATFORM_NOT_LINKED') {
          return new ApiRequestError(json.error || i18n.t('errors.forbidden'), json.code, res.status);
        }
        if (json.code === 'spotify_rate_limited') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorRateLimited'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_oauth_not_configured') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorServerConfig'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_network_error') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorNetwork'),
            json.code,
            res.status
          );
        }
        if (json.code === 'spotify_dev_user_not_allowed') {
          return new ApiRequestError(
            json.error || i18n.t('salon.spotifySearch.errorDevUser'),
            json.code,
            res.status,
            playbackState
          );
        }
        if (json.code === 'no_active_device') {
          return new ApiRequestError(
            i18n.t('salon.playbackMode.spotifyLaunchingApp'),
            json.code,
            res.status,
            playbackState,
            queue
          );
        }
        return new ApiRequestError(json.error, json.code, res.status, playbackState, queue);
      }
    } catch {
      if (text.length < 200) return new ApiRequestError(text, undefined, res.status);
    }
  }
  if (res.status === 413) return new ApiRequestError(i18n.t('errors.profileTooLarge'), undefined, res.status);
  if (res.status === 401) return new ApiRequestError(i18n.t('errors.sessionExpired'), undefined, res.status);
  if (res.status === 403) return new ApiRequestError(i18n.t('errors.forbidden'), undefined, res.status);
  if (res.status === 404) return new ApiRequestError(i18n.t('errors.notFound'), undefined, res.status);
  if (res.status === 429) return new ApiRequestError(i18n.t('errors.tooManyAttempts'), undefined, res.status);
  return new ApiRequestError(res.statusText || i18n.t('errors.network'), undefined, res.status);
}

async function request<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      credentials: 'same-origin',
      ...opts,
      headers: { ...headers(token), ...opts.headers },
    });
  } catch (e) {
    normalizeFetchNetworkError(e);
  }
  if (!res.ok) {
    throw await parseApiError(res);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string, rememberMe = true) =>
    request<
      | { token: string; user: import('../types').User; rememberMe?: boolean; requires2FA?: never }
      | { requires2FA: true; tempToken: string; token?: never; user?: never }
    >('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }),

  register: async (
    username: string,
    email: string,
    password: string,
    acceptTerms: boolean,
    termsVersion: string,
    inviteCode?: string
  ) => {
    let res: Response;
    try {
      res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers(),
        body: JSON.stringify({
          username,
          email,
          password,
          acceptTerms,
          termsVersion,
          inviteCode: inviteCode?.trim() || undefined,
        }),
      });
    } catch (e) {
      normalizeFetchNetworkError(e);
    }
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: import('../types').User;
      pending?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || res.statusText || 'Erreur réseau');
    }
    return data;
  },

  completeOnboarding: (token: string) =>
    request<{ user: import('../types').User }>('/auth/complete-onboarding', { method: 'POST' }, token),

  getOAuthProviders: () =>
    request<{ google: boolean; facebook: boolean; youtube: boolean; spotify: boolean; instagram: boolean }>('/auth/providers', {}),

  exchangeOAuthCode: (
    code: string,
    opts?: { acceptTerms?: boolean; termsVersion?: string }
  ) =>
    request<{
      token?: string;
      user?: import('../types').User;
      isNew?: boolean;
      pending?: boolean;
      message?: string;
      needsTermsAcceptance?: boolean;
    }>('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({
        code,
        acceptTerms: opts?.acceptTerms,
        termsVersion: opts?.termsVersion,
      }),
    }),

  getAccessConfig: () =>
    request<import('../types').PublicAccessConfig>('/access/config', {}),

  getAccessAdminStatus: (token: string) =>
    request<{
      accessControlEnabled: boolean;
      isAdmin: boolean;
      accountStatus: string | null;
    }>('/access/admin/status', {}, token),

  getAccessAdminOverview: (token: string) =>
    request<{
      policy: { registrationMode: string; updatedAt: number };
      config: import('../types').PublicAccessConfig;
      counts: {
        total: number;
        active: number;
        pending: number;
        blocked: number;
        spotify: import('../types').AdminSpotifyConnectionCounts;
      };
      inviteCodes: import('../types').AccessInviteCode[];
    }>('/access/admin/overview', {}, token),

  getAccessAdminUsers: (
    token: string,
    opts: {
      status?: 'all' | 'active' | 'pending' | 'blocked';
      q?: string;
      sort?: import('../types').AdminUserSort;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('status', opts.status ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../types').AccessAdminUsersResponse>(
      `/access/admin/users?${params.toString()}`,
      {},
      token
    );
  },

  getAccessAdminUser: (token: string, userId: string) =>
    request<{ user: import('../types').AccessManagedUser }>(
      `/access/admin/users/${userId}`,
      {},
      token
    ),

  patchAccessPolicy: (token: string, registrationMode: string) =>
    request<{ policy: { registrationMode: string }; config: import('../types').PublicAccessConfig }>(
      '/access/admin/policy',
      { method: 'PATCH', body: JSON.stringify({ registrationMode }) },
      token
    ),

  approveAccessUser: (token: string, userId: string) =>
    request<{ user: import('../types').User }>(
      `/access/admin/users/${userId}/approve`,
      { method: 'POST' },
      token
    ),

  blockAccessUser: (token: string, userId: string) =>
    request<{ user: import('../types').User }>(
      `/access/admin/users/${userId}/block`,
      { method: 'POST' },
      token
    ),

  unblockAccessUser: (token: string, userId: string) =>
    request<{ user: import('../types').User }>(
      `/access/admin/users/${userId}/unblock`,
      { method: 'POST' },
      token
    ),

  promoteAccessUser: (token: string, userId: string) =>
    request<{ user: import('../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/promote`,
      { method: 'POST' },
      token
    ),

  demoteAccessUser: (token: string, userId: string) =>
    request<{ user: import('../types').AccessManagedUser }>(
      `/access/admin/users/${userId}/demote`,
      { method: 'POST' },
      token
    ),

  assignAdminPlatformPlan: (
    token: string,
    userId: string,
    planId: 'free' | 'soundy_plus' | 'soundy_ultra'
  ) =>
    request<{ ok: boolean; status: import('./subscriptions').PlatformPlanStatusResponse }>(
      `/access/admin/users/${userId}/platform-plan`,
      { method: 'POST', body: JSON.stringify({ planId }) },
      token
    ),

  createAccessInvite: (
    token: string,
    body: { code?: string; label?: string; maxUses?: number }
  ) =>
    request<{ invite: import('../types').AccessInviteCode }>(
      '/access/admin/invites',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  setAccessInviteDisabled: (token: string, id: string, disabled: boolean) =>
    request<{ invite: import('../types').AccessInviteCode }>(
      `/access/admin/invites/${id}`,
      { method: 'PATCH', body: JSON.stringify({ disabled }) },
      token
    ),

  deleteAccessInvite: (token: string, id: string) =>
    request<{ ok: boolean }>(`/access/admin/invites/${id}`, { method: 'DELETE' }, token),

  submitSupportContact: (token: string, body: string) =>
    request<{ message: import('../types').SupportContactMessage }>(
      '/support/contact',
      { method: 'POST', body: JSON.stringify({ body }) },
      token
    ),

  getMySupportMessages: (token: string) =>
    request<{ messages: import('../types').SupportContactMessage[] }>('/support/my', {}, token),

  getAdminSupportMessages: (
    token: string,
    opts: { status?: 'open' | 'replied' | 'resolved' | 'all' } = {}
  ) => {
    const params = new URLSearchParams();
    if (opts.status && opts.status !== 'all') params.set('status', opts.status);
    const qs = params.toString();
    return request<{ messages: import('../types').SupportContactMessage[] }>(
      `/access/admin/support${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  replyAdminSupportMessage: (token: string, messageId: string, reply: string) =>
    request<{ message: import('../types').SupportContactMessage }>(
      `/access/admin/support/${messageId}/reply`,
      { method: 'POST', body: JSON.stringify({ reply }) },
      token
    ),

  replySupportContact: (token: string, messageId: string, body: string) =>
    request<{ message: import('../types').SupportContactMessage }>(
      `/support/contact/${messageId}/reply`,
      { method: 'POST', body: JSON.stringify({ body }) },
      token
    ),

  resolveSupportContact: (token: string, messageId: string) =>
    request<{ message: import('../types').SupportContactMessage }>(
      `/support/contact/${messageId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) },
      token
    ),

  getAdminSalons: (
    token: string,
    opts: { filter?: import('../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../types').AdminContentListResponse>(
      `/access/admin/content/salons?${params.toString()}`,
      {},
      token
    );
  },

  getAdminLives: (
    token: string,
    opts: { filter?: import('../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../types').AdminContentListResponse>(
      `/access/admin/content/lives?${params.toString()}`,
      {},
      token
    );
  },

  getAdminEvents: (
    token: string,
    opts: { filter?: import('../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../types').AdminContentListResponse>(
      `/access/admin/content/events?${params.toString()}`,
      {},
      token
    );
  },

  adminBlockSalon: (token: string, salonId: string) =>
    request<{ salon: import('../types').AdminSalonRow }>(
      `/access/admin/content/salons/${salonId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockSalon: (token: string, salonId: string) =>
    request<{ salon: import('../types').AdminSalonRow }>(
      `/access/admin/content/salons/${salonId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteSalon: (token: string, salonId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/salons/${salonId}`, { method: 'DELETE' }, token),

  adminBlockLive: (token: string, liveId: string) =>
    request<{ live: import('../types').AdminLiveRow }>(
      `/access/admin/content/lives/${liveId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockLive: (token: string, liveId: string) =>
    request<{ live: import('../types').AdminLiveRow }>(
      `/access/admin/content/lives/${liveId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteLive: (token: string, liveId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/lives/${liveId}`, { method: 'DELETE' }, token),

  adminBlockEvent: (token: string, eventId: string) =>
    request<{ event: import('../types').AdminEventRow }>(
      `/access/admin/content/events/${eventId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockEvent: (token: string, eventId: string) =>
    request<{ event: import('../types').AdminEventRow }>(
      `/access/admin/content/events/${eventId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteEvent: (token: string, eventId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/events/${eventId}`, { method: 'DELETE' }, token),

  getAdminReels: (
    token: string,
    opts: { filter?: import('../types').AdminContentFilter; q?: string; limit?: number; offset?: number } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    return request<import('../types').AdminContentListResponse>(
      `/access/admin/content/reels?${params.toString()}`,
      {},
      token
    );
  },

  adminBlockReel: (token: string, reelId: string) =>
    request<{ reel: import('../types').AdminReelRow }>(
      `/access/admin/content/reels/${reelId}/block`,
      { method: 'POST' },
      token
    ),

  adminUnblockReel: (token: string, reelId: string) =>
    request<{ reel: import('../types').AdminReelRow }>(
      `/access/admin/content/reels/${reelId}/unblock`,
      { method: 'POST' },
      token
    ),

  adminDeleteReel: (token: string, reelId: string) =>
    request<{ ok: boolean }>(`/access/admin/content/reels/${reelId}`, { method: 'DELETE' }, token),

  getAdminSponsors: (
    token: string,
    opts: {
      filter?: import('../types').SponsorFilter;
      placement?: import('../types').SponsorPlacement;
      q?: string;
    } = {}
  ) => {
    const params = new URLSearchParams();
    params.set('filter', opts.filter ?? 'all');
    if (opts.placement) params.set('placement', opts.placement);
    if (opts.q) params.set('q', opts.q);
    return request<import('../types').AdminSponsorsListResponse>(
      `/access/admin/sponsors?${params.toString()}`,
      {},
      token
    );
  },

  createAdminSponsor: (token: string, body: Partial<import('../types').Sponsor>) =>
    request<{ sponsor: import('../types').Sponsor }>(
      '/access/admin/sponsors',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  updateAdminSponsor: (token: string, sponsorId: string, body: Partial<import('../types').Sponsor>) =>
    request<{ sponsor: import('../types').Sponsor }>(
      `/access/admin/sponsors/${sponsorId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  toggleAdminSponsor: (token: string, sponsorId: string) =>
    request<{ sponsor: import('../types').Sponsor }>(
      `/access/admin/sponsors/${sponsorId}/toggle`,
      { method: 'POST' },
      token
    ),

  reorderAdminSponsors: (token: string, ids: string[]) =>
    request<{ items: import('../types').Sponsor[] }>(
      '/access/admin/sponsors/reorder',
      { method: 'POST', body: JSON.stringify({ ids }) },
      token
    ),

  deleteAdminSponsor: (token: string, sponsorId: string) =>
    request<{ ok: boolean }>(`/access/admin/sponsors/${sponsorId}`, { method: 'DELETE' }, token),

  uploadAdminSponsorLogo: (token: string, image: string) =>
    request<{ url: string }>(
      '/access/admin/sponsors/upload-logo',
      { method: 'POST', body: JSON.stringify({ image }) },
      token
    ),

  uploadAdminSponsorBanner: (token: string, image: string) =>
    request<{ url: string }>(
      '/access/admin/sponsors/upload-banner',
      { method: 'POST', body: JSON.stringify({ image }) },
      token
    ),

  getMapSponsors: (query?: {
    lat?: number;
    lng?: number;
    zoom?: number;
    north?: number;
    south?: number;
    east?: number;
    west?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.lat != null && Number.isFinite(query.lat)) params.set('lat', String(query.lat));
    if (query?.lng != null && Number.isFinite(query.lng)) params.set('lng', String(query.lng));
    if (query?.zoom != null && Number.isFinite(query.zoom)) params.set('zoom', String(query.zoom));
    if (query?.north != null && Number.isFinite(query.north)) params.set('north', String(query.north));
    if (query?.south != null && Number.isFinite(query.south)) params.set('south', String(query.south));
    if (query?.east != null && Number.isFinite(query.east)) params.set('east', String(query.east));
    if (query?.west != null && Number.isFinite(query.west)) params.set('west', String(query.west));
    const qs = params.toString();
    return request<{ items: import('../types').MapAdItem[] }>(
      `/sponsors/map${qs ? `?${qs}` : ''}`,
      { cache: 'no-store' }
    );
  },

  getFeedSponsors: () =>
    request<{ items: import('../types').MapAdItem[] }>('/sponsors/feed', { cache: 'no-store' }),

  getStoriesSponsors: () =>
    request<{ items: import('../types').MapAdItem[] }>('/sponsors/stories', { cache: 'no-store' }),

  getReelsSponsors: () =>
    request<import('../types').ReelsSponsorsResponse>('/sponsors/reels', { cache: 'no-store' }),

  getAdminSponsorsConfig: (token: string) =>
    request<{ config: import('../types').SponsorPlatformConfig }>(
      '/access/admin/sponsors/config',
      {},
      token
    ),

  patchAdminSponsorsConfig: (
    token: string,
    body: Partial<import('../types').SponsorPlatformConfig>
  ) =>
    request<{ config: import('../types').SponsorPlatformConfig }>(
      '/access/admin/sponsors/config',
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  getLegalPublisher: () =>
    request<{
      config: import('../types').LegalPublisherConfig;
      complete: boolean;
      termsVersion: string;
    }>('/legal/publisher', {}),

  submitContentReport: (
    token: string,
    body: {
      category: string;
      details: string;
      targetUserId?: string;
      roomType?: string;
      roomId?: string;
      messageId?: string;
    }
  ) =>
    request<{ ok: boolean; reportId: string; blocked?: boolean }>('/legal/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  me: (token: string) => request<{ user: import('../types').User }>('/auth/me', {}, token),

  updateGeo: (token: string, latitude: number, longitude: number) =>
    request<{ blurredLatitude: number; blurredLongitude: number }>(
      '/geo/update',
      { method: 'POST', body: JSON.stringify({ latitude, longitude }) },
      token
    ),

  nearby: (
    token: string,
    lat: number,
    lon: number,
    opts?: {
      radiusKm?: number;
      distanceFilter?: boolean;
      bounds?: { swLat: number; swLng: number; neLat: number; neLng: number };
    }
  ) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
    });
    if (opts?.radiusKm !== undefined) params.set('radius', String(opts.radiusKm));
    if (opts?.distanceFilter === false) params.set('distanceFilter', 'false');
    else if (opts?.distanceFilter === true) params.set('distanceFilter', 'true');
    if (opts?.bounds) {
      params.set('swLat', String(opts.bounds.swLat));
      params.set('swLng', String(opts.bounds.swLng));
      params.set('neLat', String(opts.bounds.neLat));
      params.set('neLng', String(opts.bounds.neLng));
    }
    return request<{
      salons: import('../types').Salon[];
      lives: import('../types').Live[];
      people: import('../types').NearbyPerson[];
    }>(`/geo/nearby?${params}`, {}, token);
  },

  listSalons: (token: string) =>
    request<{ salons: import('../types').Salon[] }>('/salons', {}, token),

  getSalon: (token: string, id: string) =>
    request<{ salon: import('../types').Salon }>(`/salons/${id}`, {}, token),

  resolveSalonTrack: (token: string, salonId: string, platform: 'spotify' | 'youtube') =>
    request<{ track: import('../types').ResolvedSalonTrack }>(
      `/salons/${salonId}/resolve-track?platform=${platform}`,
      {},
      token
    ),

  searchYoutube: (token: string, query: string) =>
    request<{ results: import('../types').YoutubeSearchResult[] }>(
      `/salons/youtube-search?q=${encodeURIComponent(query)}`,
      {},
      token
    ),

  searchSpotify: (
    token: string,
    query: string,
    signal?: AbortSignal,
    limit?: number
  ) => {
    const params = new URLSearchParams({ q: query });
    if (limit != null && Number.isFinite(limit)) {
      params.set('limit', String(Math.floor(limit)));
    }
    return request<{ results: import('../types').SpotifySearchResult[] }>(
      `/salons/spotify-search?${params}`,
      { signal },
      token
    );
  },

  salonChangeTrack: (
    token: string,
    salonId: string,
    body: {
      trackId: string;
      title: string;
      artist: string;
      trackLink?: string;
      albumArtUrl?: string;
    }
  ) =>
    request<{ playbackState: import('../types').PlaybackState }>(
      `/salons/${salonId}/playback/change-track`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  salonAddToQueue: (
    token: string,
    salonId: string,
    body: {
      trackId: string;
      title: string;
      artist: string;
      trackLink?: string;
      albumArtUrl?: string;
    }
  ) =>
    request<{
      queueItem: import('../types').SalonQueueItem;
      queue: import('../types').SalonQueueItem[];
      playbackState: import('../types').PlaybackState;
    }>(`/salons/${salonId}/playback/add-to-queue`, { method: 'POST', body: JSON.stringify(body) }, token),

  salonLoadPlaylist: (
    token: string,
    salonId: string,
    body: { playlistId?: string; playlistUrl?: string }
  ) =>
    request<{ playbackState: import('../types').PlaybackState; queue: import('../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/load-playlist`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  /** @deprecated Préférer salonLoadPlaylist (YouTube + Spotify). */
  salonLoadYoutubePlaylist: (
    token: string,
    salonId: string,
    body: { playlistId?: string; playlistUrl?: string }
  ) =>
    request<{ playbackState: import('../types').PlaybackState; queue: import('../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/load-playlist`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  getYoutubePlaylists: (token: string) =>
    request<{ playlists: import('../types').YoutubePlaylistSummary[]; isRealAccount: boolean }>(
      '/platforms/youtube/playlists',
      {},
      token
    ),

  getSpotifyPlaylists: (token: string) =>
    request<{
      playlists: import('../types').SpotifyPlaylistSummary[];
      isRealAccount: boolean;
      spotifySessionValid?: boolean;
      spotifySessionCode?: string;
      spotifyLibraryValid?: boolean;
      spotifyLibraryCode?: string;
    }>('/platforms/spotify/playlists', {}, token),

  verifySpotifyPlaylistAccess: (
    token: string,
    body: { playlistId?: string; playlistUrl?: string }
  ) =>
    request<{ ok: boolean }>('/platforms/spotify/playlists/verify-access', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  getYoutubeOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/youtube/oauth/url', {}, token),

  getSpotifyOAuthUrl: (token: string, options?: { reconnect?: boolean }) =>
    request<{ url: string }>(
      `/platforms/spotify/oauth/url${options?.reconnect ? '?reconnect=1' : ''}`,
      {},
      token
    ),

  getInstagramOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/instagram/oauth/url', {}, token),

  getPlatformStatus: async (token: string, options?: { fresh?: boolean }) => {
    if (!options?.fresh) {
      const cached = readCachedPlatformStatus(token);
      if (cached) return cached;
    }
    const data = await request<PlatformStatusResponse>('/platforms/status', {}, token);
    writeCachedPlatformStatus(token, data);
    return data;
  },

  getMsdevDualIp: () =>
    request<import('../types').MsdevDualIpConfig>('/msdev/dual-ip', {}),

  msdevLoginByIp: () =>
    request<{
      token: string;
      user: import('../types').User;
      clientIp: string;
      matchedSlot: 'A' | 'B' | null;
      simulatedViaIp: boolean;
    }>('/msdev/login-by-ip', { method: 'POST', body: JSON.stringify({}) }),

  msdevRebuild: (token: string) =>
    request<{ ok: boolean; message: string }>('/msdev/rebuild', { method: 'POST' }, token),

  createSalon: (token: string, body: object) =>
    request<{ salon: import('../types').Salon }>('/salons', { method: 'POST', body: JSON.stringify(body) }, token),

  joinSalon: (token: string, salonId: string) =>
    request<{ ok: boolean; salon: import('../types').Salon }>(`/salons/${salonId}/join`, { method: 'POST' }, token),

  deleteSalon: (token: string, salonId: string) =>
    request<{ ok: boolean }>(`/salons/${salonId}`, { method: 'DELETE' }, token),

  updateSalonSettings: (token: string, salonId: string, body: object) =>
    request<{ salon: import('../types').Salon }>(
      `/salons/${salonId}/settings`,
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  addSalonGuest: (token: string, salonId: string, userId: string) =>
    request<{ salon: import('../types').Salon }>(
      `/salons/${salonId}/allowed`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeSalonGuest: (token: string, salonId: string, userId: string) =>
    request<{ salon: import('../types').Salon }>(`/salons/${salonId}/allowed/${userId}`, { method: 'DELETE' }, token),

  validateSalonGuests: (token: string, salonId: string, userIds: string[]) =>
    request<{ salon: import('../types').Salon; invitedCount: number }>(
      `/salons/${salonId}/validate-guests`,
      { method: 'POST', body: JSON.stringify({ userIds }) },
      token
    ),

  getSalonQueue: (token: string, salonId: string) =>
    request<{ queue: import('../types').SalonQueueItem[] }>(`/salons/${salonId}/queue`, {}, token),

  reorderSalonQueue: (token: string, salonId: string, order: string[]) =>
    request<{ queue: import('../types').SalonQueueItem[] }>(
      `/salons/${salonId}/queue/reorder`,
      { method: 'PATCH', body: JSON.stringify({ order }) },
      token
    ),

  getSalonProposals: (token: string, salonId: string) =>
    request<{ proposals: import('../types').SalonTrackProposal[] }>(`/salons/${salonId}/proposals`, {}, token),

  getSalonParticipants: (token: string, salonId: string) =>
    request<{ participants: import('../types').SalonParticipant[]; listenersCount: number }>(
      `/salons/${salonId}/participants`,
      {},
      token
    ),

  setSalonParticipantVip: (token: string, salonId: string, userId: string, add: boolean) =>
    request<{ salon: import('../types').Salon }>(
      `/salons/${salonId}/participants/${userId}/vip`,
      { method: 'PATCH', body: JSON.stringify({ add }) },
      token
    ),

  proposeSalonTrack: (
    token: string,
    salonId: string,
    body: { title: string; artist: string; spotifyUrl?: string; youtubeUrl?: string }
  ) =>
    request<{ proposal: import('../types').SalonTrackProposal }>(
      `/salons/${salonId}/proposals`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  acceptSalonProposal: (token: string, salonId: string, proposalId: string, playNow = false) =>
    request<{
      proposal: import('../types').SalonTrackProposal;
      queueItem: import('../types').SalonQueueItem;
      queue: import('../types').SalonQueueItem[];
      playbackState?: import('../types').PlaybackState;
    }>(`/salons/${salonId}/proposals/${proposalId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ playNow }),
    }, token),

  rejectSalonProposal: (token: string, salonId: string, proposalId: string) =>
    request<{ proposal: import('../types').SalonTrackProposal }>(
      `/salons/${salonId}/proposals/${proposalId}/reject`,
      { method: 'POST' },
      token
    ),

  salonPlaybackSkip: (token: string, salonId: string) =>
    request<{ playbackState: import('../types').PlaybackState; queue: import('../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/skip`,
      { method: 'POST' },
      token
    ),

  salonPlayQueueItem: (token: string, salonId: string, queueItemId: string) =>
    request<{ playbackState: import('../types').PlaybackState; queue: import('../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/play-queue`,
      { method: 'POST', body: JSON.stringify({ queueItemId }) },
      token
    ),

  spotifySalonPlaybackControl: (
    token: string,
    salonId: string,
    action: 'pause' | 'play' | 'stop' | 'next'
  ) =>
    request<{ ok: boolean; action: string }>(
      `/salons/${salonId}/playback/spotify-control`,
      { method: 'POST', body: JSON.stringify({ action }) },
      token
    ),

  spotifySalonSeek: (token: string, salonId: string, positionMs: number) =>
    request<{ ok: boolean; action: string; positionMs: number }>(
      `/salons/${salonId}/playback/spotify-control`,
      { method: 'POST', body: JSON.stringify({ action: 'seek', positionMs }) },
      token
    ),

  getSpotifySalonNowPlaying: (token: string, salonId: string) =>
    request<{
      nowPlaying: {
        active: boolean;
        isPlaying: boolean;
        progressMs: number;
        durationMs?: number;
        trackId?: string;
        title?: string;
        artist?: string;
        albumArtUrl?: string;
        externalUrl?: string;
      };
    }>(`/salons/${salonId}/playback/spotify-now-playing`, {}, token),

  getLives: (
    token: string,
    opts?: { latitude?: number; longitude?: number; radiusKm?: number; distanceFilter?: boolean }
  ) => {
    const params = new URLSearchParams();
    if (opts?.latitude !== undefined) params.set('latitude', String(opts.latitude));
    if (opts?.longitude !== undefined) params.set('longitude', String(opts.longitude));
    if (opts?.radiusKm !== undefined) params.set('radiusKm', String(opts.radiusKm));
    if (opts?.distanceFilter === false) params.set('distanceFilter', 'false');
    else if (opts?.distanceFilter === true) params.set('distanceFilter', 'true');
    const q = params.toString();
    return request<{ lives: import('../types').Live[] }>(`/lives${q ? `?${q}` : ''}`, {}, token);
  },

  getLive: async (token: string, id: string) => {
    let res: Response;
    try {
      res = await fetch(`${API}/lives/${id}`, { headers: headers(token) });
    } catch (e) {
      normalizeFetchNetworkError(e);
    }
    const body = (await res.json().catch(() => ({}))) as {
      live?: import('../types').Live;
      error?: string;
      code?: string;
      permanent?: boolean;
      until?: number;
    };
    if (res.status === 403 && body.code === 'live_banned') {
      const err = new Error(body.error || 'Vous êtes banni de ce live.') as Error & {
        liveBanned?: boolean;
        permanent?: boolean;
        until?: number;
      };
      err.liveBanned = true;
      err.permanent = body.permanent;
      err.until = body.until;
      throw err;
    }
    if (!res.ok) throw await parseApiError(res);
    return body as { live: import('../types').Live };
  },

  getLiveParticipants: (token: string, liveId: string) =>
    request<{ participants: import('../types').LiveParticipant[]; viewersCount: number }>(
      `/lives/${liveId}/participants`,
      {},
      token
    ),

  startLive: (
    token: string,
    title?: string,
    opts?: { latitude?: number; longitude?: number }
  ) =>
    request<{ live: import('../types').Live }>(
      '/lives/start',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          latitude: opts?.latitude,
          longitude: opts?.longitude,
        }),
      },
      token
    ),

  stopLive: (token: string) => request<{ ok: boolean }>('/lives/stop', { method: 'POST' }, token),

  getLivePlayback: (token: string, liveId: string) =>
    request<{
      streamMode: 'cloudflare';
      playbackUrl: string;
      liveInputId?: string;
      isArchived?: boolean;
    }>(`/lives/${liveId}/playback`, {}, token),

  getLiveIceServers: (token: string, liveId: string) =>
    request<{ iceServers: RTCIceServer[] }>(
      `/lives/ice-servers?liveId=${encodeURIComponent(liveId)}`,
      {},
      token
    ),

  getLiveStreamCapabilities: (token: string) =>
    request<{
      cloudflareStreamAvailable: boolean;
      livekitAvailable: boolean;
      obsAllowed?: boolean;
      platformPlanId?: string;
    }>('/lives/stream-capabilities', {}, token),

  provisionCloudflareStream: (token: string, liveId: string) =>
    request<{ live: import('../types').Live }>(
      `/lives/${liveId}/cloudflare-stream`,
      { method: 'POST' },
      token
    ),

  getCloudflareIngest: (token: string, liveId: string) =>
    request<{
      rtmpsUrl: string;
      streamKey: string;
      playbackUrl: string;
      whipUrl?: string;
      liveInputId: string;
    }>(`/lives/${liveId}/cloudflare-ingest`, {}, token),

  getLiveKitToken: (token: string, liveId: string) =>
    request<{
      token: string;
      serverUrl: string;
      roomName: string;
      canPublish: boolean;
      streamMode: 'livekit';
    }>(`/lives/${liveId}/livekit-token`, {}, token),

  startEgress: (token: string, liveId: string) =>
    request<{ egressId: string; hlsUrl: string }>(
      `/lives/${liveId}/start-egress`,
      { method: 'POST' },
      token
    ),

  stopEgress: (token: string, liveId: string) =>
    request<{ stopped: boolean }>(
      `/lives/${liveId}/stop-egress`,
      { method: 'POST' },
      token
    ),

  salonChat: (token: string, salonId: string) =>
    request<{ messages: import('../types').ChatMessage[] }>(`/chat/salon/${salonId}`, {}, token),

  liveChat: (token: string, liveId: string) =>
    request<{ messages: import('../types').ChatMessage[] }>(`/chat/live/${liveId}`, {}, token),

  getDmPresence: (token: string) =>
    request<{
      onlineUserIds: string[];
      liveUserIds: string[];
      liveViewersByUserId: Record<string, number>;
    }>('/dm/presence', {}, token),

  getConversations: (token: string) =>
    request<{ conversations: import('../types').Conversation[]; unreadCount: number }>(
      '/dm/conversations/list',
      {},
      token
    ),

  getDmUnreadCount: (token: string) =>
    request<{ unreadCount: number }>('/dm/unread-count', {}, token),

  markDmThreadRead: (token: string, userId: string, at?: number) =>
    request<{ ok: boolean; unreadCount: number }>(`/dm/thread/${userId}/read`, {
      method: 'POST',
      body: JSON.stringify(at != null ? { at } : {}),
    }, token),

  getDmContacts: (token: string) =>
    request<{ contacts: import('../types').DmContact[] }>('/dm/contacts/list', {}, token),

  blockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'POST' }, token),

  unblockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'DELETE' }, token),

  getBlockedUsers: (token: string) =>
    request<{ blocked: import('../types').DmContact[] }>('/dm/blocks/list', {}, token),

  getMutedUserIds: (token: string) =>
    request<{ mutedUserIds: string[] }>('/dm/mutes/list', {}, token),

  muteUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/mute/${userId}`, { method: 'POST' }, token),

  unmuteUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/mute/${userId}`, { method: 'DELETE' }, token),

  getDmThread: (token: string, userId: string) =>
    request<{
      messages: import('../types').DirectMessage[];
      otherUser: import('../types').DmContact;
    }>(`/dm/thread/${userId}`, {}, token),

  sendDm: (
    token: string,
    userId: string,
    content: string,
    attachment?: {
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      attachmentMimeType?: string;
    }
  ) =>
    request<{ message: import('../types').DirectMessage; status?: 'accepted' | 'pending'; delivered?: boolean }>(
      `/dm/thread/${userId}`,
      { method: 'POST', body: JSON.stringify({ content, ...attachment }) },
      token
    ),

  reactToDmMessage: (token: string, messageId: string, emoji: string) =>
    request<{ ok: boolean; added: boolean; reactions: Record<string, string[]> }>(
      `/dm/messages/${messageId}/react`,
      { method: 'POST', body: JSON.stringify({ emoji }) },
      token
    ),

  getDmRequests: (token: string) =>
    request<{ requests: import('../types').DmRequest[] }>('/dm/requests/list', {}, token),

  acceptDmRequest: (token: string, senderId: string) =>
    request<{ ok: boolean }>(`/dm/requests/${senderId}/accept`, { method: 'POST' }, token),

  refuseDmRequest: (token: string, senderId: string) =>
    request<{ ok: boolean }>(`/dm/requests/${senderId}/refuse`, { method: 'POST' }, token),

  deleteDmMessage: (token: string, messageId: string, forAll = false) =>
    request<{ ok: boolean; messageId: string; scope: 'hidden' | 'all' }>(
      `/dm/messages/${messageId}${forAll ? '?forAll=true' : ''}`,
      { method: 'DELETE' },
      token
    ),

  createMessageGroup: (token: string, name: string, memberIds: string[]) =>
    request<{ group: import('../types').MessageGroupDetail }>(
      '/dm/groups',
      { method: 'POST', body: JSON.stringify({ name, memberIds }) },
      token
    ),

  getGroupThread: (token: string, groupId: string) =>
    request<{
      messages: import('../types').GroupMessage[];
      group: import('../types').MessageGroupDetail;
    }>(`/dm/groups/${groupId}/thread`, {}, token),

  sendGroupMessage: (token: string, groupId: string, content: string) =>
    request<{ message: import('../types').GroupMessage }>(
      `/dm/groups/${groupId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  markGroupThreadRead: (token: string, groupId: string, at?: number) =>
    request<{ ok: boolean; unreadCount: number }>(`/dm/groups/${groupId}/read`, {
      method: 'POST',
      body: JSON.stringify(at != null ? { at } : {}),
    }, token),

  deleteGroupMessage: (token: string, messageId: string, forAll = false) =>
    request<{ ok: boolean; messageId: string; scope: 'hidden' | 'all' }>(
      `/dm/groups/messages/${messageId}${forAll ? '?forAll=true' : ''}`,
      { method: 'DELETE' },
      token
    ),

  addGroupMember: (token: string, groupId: string, userId: string) =>
    request<{ group: import('../types').MessageGroupDetail }>(
      `/dm/groups/${groupId}/members`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeGroupMember: (token: string, groupId: string, userId: string) =>
    request<{ group: import('../types').MessageGroupDetail; removedUserId: string }>(
      `/dm/groups/${groupId}/members/${userId}`,
      { method: 'DELETE' },
      token
    ),

  deleteChatMessage: (
    token: string,
    roomType: 'salon' | 'live',
    roomId: string,
    messageId: string
  ) =>
    request<{ ok: boolean; messageId: string }>(
      `/chat/${roomType}/${roomId}/messages/${messageId}`,
      { method: 'DELETE' },
      token
    ),

  giftCatalog: (token: string) => request<{ gifts: { type: string; label: string }[] }>('/gifts/catalog', {}, token),

  getLiveGifts: (token: string, liveId: string) =>
    request<{
      gifts: {
        id: string;
        senderId: string;
        senderName: string;
        giftType: string;
        amount: number;
        timestamp: number;
      }[];
    }>(`/gifts/live/${liveId}`, {}, token),

  sendGift: (token: string, liveId: string, giftType: string, amount?: number) =>
    request<{ gift: object }>(
      '/gifts/send',
      {
        method: 'POST',
        body: JSON.stringify({
          liveId,
          giftType,
          ...(amount != null ? { amount } : {}),
        }),
      },
      token
    ),

  getDonationsConfig: (token?: string | null) =>
    request<import('./donations').DonationsConfig>('/donations/config', {}, token),

  simulateDonation: (token: string, liveId: string, amount: number, ageConfirmed: boolean) =>
    request<{ gift: object; simulation: boolean; message: string }>(
      '/donations/simulate',
      {
        method: 'POST',
        body: JSON.stringify({ liveId, amount, ageConfirmed }),
      },
      token
    ),

  createDonationIntent: (token: string, liveId: string, amount: number, ageConfirmed: boolean) =>
    request<{ clientSecret: string; paymentIntentId: string; amount: number; currency: string }>(
      '/donations/create-intent',
      {
        method: 'POST',
        body: JSON.stringify({ liveId, amount, ageConfirmed }),
      },
      token
    ),

  getStripeConnectStatus: (token: string) =>
    request<import('./donations').StripeConnectStatus>('/donations/connect-status', {}, token),

  startStripeConnectOnboard: (token: string) =>
    request<{ url: string; stripeConnectAccountId: string }>(
      '/donations/connect-onboard',
      { method: 'POST', body: JSON.stringify({}) },
      token
    ),

  getSubscriptionsConfig: (token?: string | null) =>
    request<import('./subscriptions').SubscriptionsConfig>('/subscriptions/config', {}, token),

  getPlatformPlan: (token: string) =>
    request<import('./subscriptions').PlatformPlanStatusResponse>(
      '/subscriptions/platform-plan',
      {},
      token
    ),

  getSubscriptionStatus: (
    token: string,
    params: { creatorId?: string; targetType?: 'creator' | 'platform' }
  ) => {
    const q = new URLSearchParams();
    if (params.creatorId) q.set('creatorId', params.creatorId);
    if (params.targetType) q.set('targetType', params.targetType);
    const qs = q.toString();
    return request<import('./subscriptions').SubscriptionStatus>(
      `/subscriptions/status${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  simulateSubscription: (
    token: string,
    body: {
      creatorId?: string;
      tierId: string;
      targetType?: 'creator' | 'platform';
      ageConfirmed: boolean;
    }
  ) =>
    request<{ subscription: object; simulation: boolean; message: string }>(
      '/subscriptions/simulate',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  createSubscriptionCheckout: (
    token: string,
    body: {
      creatorId?: string;
      tierId: string;
      targetType?: 'creator' | 'platform';
      ageConfirmed: boolean;
    }
  ) =>
    request<{ checkoutUrl: string | null; sessionId: string }>(
      '/subscriptions/create-checkout',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  createSubscriptionPortal: (
    token: string,
    body: { creatorId?: string; targetType?: 'creator' | 'platform' }
  ) =>
    request<{ portalUrl: string }>(
      '/subscriptions/create-portal',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  toggleGhost: (token: string, isGhostMode: boolean) =>
    request<{ isGhostMode: boolean }>('/auth/ghost-mode', { method: 'PATCH', body: JSON.stringify({ isGhostMode }) }, token),

  checkUsername: (username: string) =>
    request<{ available: boolean; reason: string | null }>(`/auth/check-username?username=${encodeURIComponent(username)}`),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),

  // ─── Double authentification (TOTP) ────────────────────────────────────────

  /** Génère un secret TOTP + QR code pour l'utilisateur connecté (ne l'active pas encore). */
  setup2FA: (token: string) =>
    request<{ otpauthUrl: string; qrCode: string }>('/auth/2fa/setup', {
      method: 'POST',
    }, token),

  /** Confirme le code TOTP lors de l'activation. Retourne les 8 codes de secours. */
  verify2FA: (token: string, code: string) =>
    request<{ ok: boolean; backupCodes: string[] }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  /** Désactive la 2FA (nécessite un code TOTP ou code de secours valide). */
  disable2FA: (token: string, code: string) =>
    request<{ ok: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  /** Statut 2FA de l'utilisateur connecté. */
  get2FAStatus: (token: string) =>
    request<{ twoFactorEnabled: boolean; backupCodesRemaining: number }>('/auth/2fa/status', {}, token),

  /** Échange un tempToken + code TOTP contre un JWT complet lors de la connexion. */
  validate2FA: (tempToken: string, code: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    }),

  deleteAccount: (token: string, body: { password?: string; confirmation?: string }) =>
    request<{ ok: boolean }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(body),
    }, token),

  exportMyData: async (token: string): Promise<unknown> => {
    const res = await fetch(`${API}/auth/me/export`, {
      headers: headers(token),
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  adminGetReports: (token: string) =>
    request<{ reports: import('../types').ContentReport[] }>('/admin/reports', {}, token),

  adminPatchReport: (token: string, id: string, status: 'reviewed' | 'dismissed') =>
    request<{ ok: boolean }>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),

  adminDeleteReport: (token: string, id: string) =>
    request<{ ok: boolean }>(`/admin/reports/${id}`, { method: 'DELETE' }, token),

  updateProfile: (token: string, body: object) =>
    request<{ user: import('../types').User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }, token),

  connectPlatform: (token: string, platform: 'spotify' | 'youtube' | 'instagram') =>
    request<{ ok: boolean; user: import('../types').User }>(
      `/platforms/${platform}/connect`,
      { method: 'POST' },
      token
    ),

  disconnectPlatform: (token: string, platform: 'spotify' | 'youtube' | 'instagram') =>
    request<{ ok: boolean; user: import('../types').User }>(
      `/platforms/${platform}/disconnect`,
      { method: 'DELETE' },
      token
    ),

  updatePrivacySettings: (
    token: string,
    body: { shareDistance?: boolean; locationPrecision?: 'precise' | 'city' }
  ) =>
    request<{ user: import('../types').User }>(
      '/users/me/settings',
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  acceptLiveTerms: (token: string) =>
    request<{ liveTermsAcceptedAt: number }>(
      '/users/me/live-terms',
      { method: 'PATCH', body: JSON.stringify({}) },
      token
    ),

  getHostRating: (token: string, hostId: string) =>
    request<{ rating: import('../types').HostRatingSummary }>(`/ratings/host/${hostId}`, {}, token),

  rateHost: (
    token: string,
    hostId: string,
    stars: number,
    context?: { salonId?: string; liveId?: string }
  ) =>
    request<{ rating: import('../types').HostRatingSummary }>(
      '/ratings',
      {
        method: 'POST',
        body: JSON.stringify({ hostId, stars, salonId: context?.salonId, liveId: context?.liveId }),
      },
      token
    ),

  getUserProfile: (token: string, userId: string) =>
    request<{ user: import('../types').User }>(`/auth/profile/${userId}`, {}, token),

  searchUsers: (token: string, query: string, signal?: AbortSignal) =>
    request<{ users: import('../types').UserSearchHit[] }>(
      `/users/search?q=${encodeURIComponent(query)}`,
      { signal },
      token
    ),

  sendHeart: (token: string, userId: string) =>
    request<{
      ok: boolean;
      matched: boolean;
      match: import('../types').MusicMatch | null;
      waitingForReply: boolean;
    }>(`/notifications/heart/${userId}`, { method: 'POST' }, token),

  getMatchStatus: (token: string, userId: string) =>
    request<import('../types').MatchStatus>(`/notifications/matches/with/${userId}`, {}, token),

  getMatches: (token: string) =>
    request<{ matches: import('../types').MusicMatch[] }>('/notifications/matches/list', {}, token),

  getNotifications: (token: string) =>
    request<{ notifications: import('../types').AppNotification[]; unreadCount: number }>(
      '/notifications/list',
      {},
      token
    ),

  markNotificationsRead: (token: string) =>
    request<{ ok: boolean; unreadCount: number }>('/notifications/read-all', { method: 'PATCH' }, token),

  followUser: (token: string, userId: string) =>
    request<{ ok: boolean; followingId: string; isFollowing: boolean }>(
      `/users/${userId}/follow`,
      { method: 'POST' },
      token
    ),

  unfollowUser: (token: string, userId: string) =>
    request<{ ok: boolean; followingId: string; isFollowing: boolean }>(
      `/users/${userId}/follow`,
      { method: 'DELETE' },
      token
    ),

  getMyFollowing: (token: string) =>
    request<{ following: import('../types').User[]; followingIds: string[] }>(
      '/users/me/following',
      {},
      token
    ),

  addFavorite: (token: string, userId: string) =>
    request<{ ok: boolean; hostId: string; isFavorite: boolean; notificationsEnabled: boolean }>(
      `/users/${userId}/favorite`,
      { method: 'POST' },
      token
    ),

  removeFavorite: (token: string, userId: string) =>
    request<{ ok: boolean; hostId: string; isFavorite: boolean }>(
      `/users/${userId}/favorite`,
      { method: 'DELETE' },
      token
    ),

  getMyFavorites: (token: string) =>
    request<{ favorites: import('../types').User[] }>('/users/me/favorites', {}, token),

  getFavoriteStatus: (token: string, userId: string) =>
    request<{ isFavorite: boolean; notificationsEnabled: boolean }>(
      `/users/${userId}/favorite-status`,
      {},
      token
    ),

  setFavoriteNotifications: (token: string, userId: string, notificationsEnabled: boolean) =>
    request<{ ok: boolean; hostId: string; notificationsEnabled: boolean }>(
      `/users/${userId}/favorite/notifications`,
      { method: 'PATCH', body: JSON.stringify({ notificationsEnabled }) },
      token
    ),

  getReelsFeed: (token: string, feedAlgo?: ReelFeedAlgorithmPreferences) => {
    const qs = feedAlgo != null ? `?feedAlgo=${serializeFeedAlgoForApi(feedAlgo)}` : '';
    return request<{ reels: import('../content/reels').MusicReel[] }>(`/reels${qs}`, {}, token);
  },

  recordReelView: (token: string, reelId: string) =>
    request<{ ok: boolean; viewCount: number; alreadyViewed: boolean }>(
      `/reels/${reelId}/view`,
      { method: 'POST' },
      token
    ),

  getUserReels: (token: string, userId: string) =>
    request<{ reels: import('../content/reels').MusicReel[] }>(`/reels/user/${userId}`, {}, token),

  getUserLives: (token: string, userId: string) =>
    request<{ lives: import('../components/UserLivesSection').ArchivedLive[] }>(
      `/lives/user/${userId}`,
      {},
      token
    ),

  getCreatorStats: (token: string) =>
    request<{ stats: import('../components/CreatorDashboardCard').CreatorDashboardStats }>(
      '/users/me/creator-stats',
      {},
      token
    ),

  getPushVapidPublicKey: (token: string) =>
    request<{ publicKey: string | null; configured?: boolean }>(
      '/push/vapid-public-key',
      {},
      token
    ),

  subscribePush: (
    token: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) =>
    request<{ ok: boolean }>(
      '/push/subscribe',
      { method: 'POST', body: JSON.stringify({ subscription }) },
      token
    ),

  unsubscribePush: (token: string, endpoint: string) =>
    request<{ ok: boolean }>(
      '/push/unsubscribe',
      { method: 'POST', body: JSON.stringify({ endpoint }) },
      token
    ),

  getMyPrivateReels: (token: string) =>
    request<{ reels: import('../content/reels').MusicReel[] }>('/reels/private/me', {}, token),

  getReel: (token: string, reelId: string) =>
    request<{ reel: import('../content/reels').MusicReel }>(`/reels/${reelId}`, {}, token),

  getUserCreatedReels: (token: string) =>
    request<{ reels: import('../content/reels').MusicReel[] }>('/reels/user-created', {}, token),

  createReel: (
    token: string,
    body: {
      title: string;
      artist: string;
      genre: string;
      mediaType: 'video' | 'image';
      mediaUrl: string;
      posterUrl?: string;
      durationSec?: number;
      visibility?: 'public' | 'private';
      isPrivate?: boolean;
    }
  ) =>
    request<{ reel: import('../content/reels').MusicReel }>(
      '/reels',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteReel: (token: string, reelId: string) =>
    request<{ ok: boolean }>(`/reels/${reelId}`, { method: 'DELETE' }, token),

  getMyCompositions: (token: string) =>
    request<{ compositions: import('../components/UserCompositionsSection').UserCompositionItem[] }>(
      '/compositions/mine',
      {},
      token
    ),

  createComposition: (
    token: string,
    body: {
      title: string;
      artist?: string;
      fileUrl: string;
      durationSec?: number;
    }
  ) =>
    request<{ composition: import('../components/UserCompositionsSection').UserCompositionItem }>(
      '/compositions',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteComposition: (token: string, compositionId: string) =>
    request<{ ok: boolean }>(`/compositions/${compositionId}`, { method: 'DELETE' }, token),

  publishReel: (token: string, reelId: string) =>
    request<{ reel: import('../content/reels').MusicReel }>(`/reels/${reelId}/publish`, { method: 'POST' }, token),

  getReelStats: (token: string, reelId: string) =>
    request<{ stats: import('../types').ReelStats }>(`/reels/${reelId}/stats`, {}, token),

  toggleReelHeart: (token: string, reelId: string) =>
    request<{ liked: boolean; heartCount: number }>(`/reels/${reelId}/heart`, { method: 'POST' }, token),

  getReelComments: (token: string, reelId: string) =>
    request<{ comments: import('../types').ReelComment[] }>(`/reels/${reelId}/comments`, {}, token),

  postReelComment: (token: string, reelId: string, content: string) =>
    request<{ comment: import('../types').ReelComment; commentCount: number }>(
      `/reels/${reelId}/comments`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  shareReel: (token: string, reelId: string) =>
    request<{ ok: boolean; shareCount: number; alreadyShared: boolean }>(
      `/reels/${reelId}/share`,
      { method: 'POST' },
      token
    ),

  getFeedPosts: (
    token: string,
    opts?: {
      limit?: number;
      before?: number;
      eventsOnly?: boolean;
      userEventsOnly?: boolean;
      eventDate?: string;
      eventLocationSearch?: string;
      eventCountry?: string;
      eventType?: 'dance' | 'chant' | 'autre';
      /** When true, the server ranks posts with Algo Soundy instead of chronological order. */
      algo?: boolean;
      /** Fil d'accueil : publications et événements des comptes suivis + les vôtres. */
      followingOnly?: boolean;
    }
  ) => {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.before != null) params.set('before', String(opts.before));
    if (opts?.eventsOnly) params.set('eventsOnly', 'true');
    if (opts?.userEventsOnly) params.set('userEventsOnly', 'true');
    if (opts?.eventDate) params.set('eventDate', opts.eventDate);
    if (opts?.eventLocationSearch) params.set('eventLocationSearch', opts.eventLocationSearch);
    if (opts?.eventCountry) params.set('eventCountry', opts.eventCountry);
    if (opts?.eventType) params.set('eventType', opts.eventType);
    if (opts?.algo) params.set('algo', 'true');
    if (opts?.followingOnly) params.set('followingOnly', 'true');
    const qs = params.toString();
    return request<{ posts: import('../types').FeedPost[] }>(
      `/feed${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  createFeedPost: (
    token: string,
    body: {
      content: string;
      imageUrl?: string;
      videoUrl?: string;
      isEvent?: boolean;
      eventDate?: string;
      eventLocation?: string;
      eventType?: 'dance' | 'chant' | 'autre';
    }
  ) =>
    request<{ post: import('../types').FeedPost }>(
      '/feed',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  likeFeedPost: (token: string, postId: string) =>
    request<{ liked: boolean; likeCount: number }>(
      `/feed/posts/${postId}/like`,
      { method: 'POST' },
      token
    ),

  unlikeFeedPost: (token: string, postId: string) =>
    request<{ liked: boolean; likeCount: number }>(
      `/feed/posts/${postId}/like`,
      { method: 'DELETE' },
      token
    ),

  getFeedPostComments: (token: string, postId: string) =>
    request<{ comments: import('../types').FeedPostComment[] }>(
      `/feed/posts/${postId}/comments`,
      {},
      token
    ),

  postFeedComment: (token: string, postId: string, content: string, textAlign?: import('../types').CommentAlign) =>
    request<{ comment: import('../types').FeedPostComment; commentCount: number }>(
      `/feed/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content, ...(textAlign && textAlign !== 'left' ? { textAlign } : {}) }) },
      token
    ),

  reshareFeedPost: (token: string, postId: string) =>
    request<{ post: import('../types').FeedPost }>(
      `/feed/posts/${postId}/reshare`,
      { method: 'POST' },
      token
    ),

  addFeedPostFavorite: (token: string, postId: string) =>
    request<{ favorited: boolean }>(
      `/feed/posts/${postId}/favorite`,
      { method: 'POST' },
      token
    ),

  removeFeedPostFavorite: (token: string, postId: string) =>
    request<{ favorited: boolean }>(
      `/feed/posts/${postId}/favorite`,
      { method: 'DELETE' },
      token
    ),

  getFavoritedFeedPosts: (token: string) =>
    request<{ posts: import('../types').FeedPost[] }>('/feed/favorites', {}, token),

  getStories: (
    token: string,
    opts?: { latitude?: number; longitude?: number; radius?: number }
  ) => {
    const params = new URLSearchParams();
    if (opts?.latitude != null) params.set('latitude', String(opts.latitude));
    if (opts?.longitude != null) params.set('longitude', String(opts.longitude));
    if (opts?.radius != null) params.set('radius', String(opts.radius));
    const qs = params.toString();
    return request<{ stories: import('../types').MapStory[] }>(
      `/stories${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  getMyStory: (token: string) =>
    request<{ story: import('../types').MapStory | null; stories: import('../types').MapStory[] }>(
      '/stories/mine',
      {},
      token
    ),

  createStory: (
    token: string,
    body: {
      content?: string;
      imageUrl?: string;
      musicTrack?: import('../types').StoryMusicTrack;
      taggedUserIds?: string[];
      link?: import('../types').StoryLink;
      visibility?: 'public' | 'followers';
    }
  ) =>
    request<{ story: import('../types').MapStory }>(
      '/stories',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  getNews: () =>
    request<{ news: import('../types').MusicNewsItem[] }>('/news', {}),

  getTrendingUsers: (token: string, country?: string) => {
    const params = new URLSearchParams();
    if (country) params.set('country', country);
    const qs = params.toString();
    return request<{ users: import('../types').TrendingUser[] }>(
      `/trending/users${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  getAnalyticsSummary: (
    token: string,
    options?: { period?: 'day' | 'week' | 'month' | 'year'; locale?: string }
  ) => {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.locale) params.set('locale', options.locale);
    const qs = params.toString();
    return request<{
      period: 'day' | 'week' | 'month' | 'year';
      snapshot: {
        totalUsers: number;
        dau24h: number;
        dau30d: number;
        newUsersToday: number;
        activeSalons: number;
        activeLives: number;
        totalMessages: number;
        totalReels: number;
        totalMatches: number;
        totalFeedPosts: number;
      };
      series: {
        labels: string[];
        logins: number[];
        messagesSent: number[];
        salonsCreated: number[];
        livesStarted: number[];
        reelsViewed: number[];
        matchesCreated: number[];
        favoritesAdded: number[];
      };
    }>(`/analytics/summary${qs ? `?${qs}` : ''}`, {}, token);
  },

  getCloudflareUsage: (token: string) =>
    request<import('../types').CloudflareUsageReport>('/admin/cloudflare-usage', {}, token),

  getDonationsSummary: (token: string) =>
    request<import('../types').DonationsSummaryReport>('/admin/donations-summary', {}, token),

  getVpsMetrics: (token: string) =>
    request<import('../types').VpsMetricsReport>('/admin/vps-metrics', {}, token),

  getVpsSyslog: (token: string, opts: { lines?: number; type?: 'pm2' | 'system' }) =>
    request<import('../types').SyslogResponse>(
      `/admin/vps/syslog?lines=${opts.lines ?? 100}&type=${opts.type ?? 'pm2'}`,
      {},
      token,
    ),

  // ── WebAuthn / Passkeys (Face ID, Touch ID, empreinte Android, Windows Hello) ──

  webauthnRegisterOptions: (token: string) =>
    request<import('@simplewebauthn/browser').PublicKeyCredentialCreationOptionsJSON>(
      '/auth/webauthn/register/options',
      { method: 'POST' },
      token,
    ),

  webauthnRegisterVerify: (
    token: string,
    body: import('@simplewebauthn/browser').RegistrationResponseJSON
  ) =>
    request<{ verified: boolean }>(
      '/auth/webauthn/register/verify',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  webauthnLoginOptions: () =>
    request<
      import('@simplewebauthn/browser').PublicKeyCredentialRequestOptionsJSON & { sessionId: string }
    >('/auth/webauthn/login/options', { method: 'POST' }),

  webauthnLoginVerify: (
    sessionId: string,
    response: import('@simplewebauthn/browser').AuthenticationResponseJSON
  ) =>
    request<{ token: string; user: import('../types').User }>(
      '/auth/webauthn/login/verify',
      { method: 'POST', body: JSON.stringify({ response, sessionId }) },
    ),

  webauthnGetCredentials: (token: string) =>
    request<{
      credentials: Array<{
        id: string;
        deviceType: string | null;
        backedUp: boolean;
        createdAt: string;
      }>;
    }>('/auth/webauthn/credentials', {}, token),

  webauthnDeleteCredential: (token: string, credentialId: string) =>
    request<{ ok: boolean }>(
      `/auth/webauthn/credential/${encodeURIComponent(credentialId)}`,
      { method: 'DELETE' },
      token,
    ),
};
