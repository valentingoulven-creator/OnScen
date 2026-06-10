import i18n from '../i18n';
import { serializeFeedAlgoForApi, type ReelFeedAlgorithmPreferences } from './reelFeedAlgorithm';

const API = '/api';

/** JWT hors Authorization pour ne pas écraser le Basic Auth Caddy (reverse proxy). */
const AUTH_TOKEN_HEADER = 'X-Auth-Token';

function headers(token?: string | null): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h[AUTH_TOKEN_HEADER] = token;
  return h;
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const json = JSON.parse(text) as { error?: string; code?: string };
      if (json.error) {
        if (json.error === 'Token manquant' || json.error === 'Token invalide') {
          return i18n.t('errors.sessionExpired');
        }
        if (json.code === 'dm_mutual_follow_required') {
          return i18n.t('dm.mutualFollowRequired');
        }
        return json.error;
      }
    } catch {
      if (text.length < 200) return text;
    }
  }
  if (res.status === 413) return i18n.t('errors.profileTooLarge');
  if (res.status === 401) return i18n.t('errors.sessionExpired');
  if (res.status === 403) return i18n.t('errors.forbidden');
  if (res.status === 404) return i18n.t('errors.notFound');
  if (res.status === 429) return i18n.t('errors.tooManyAttempts');
  return res.statusText || i18n.t('errors.network');
}

async function request<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...opts,
    headers: { ...headers(token), ...opts.headers },
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string, rememberMe = true) =>
    request<{ token: string; user: import('../types').User; rememberMe?: boolean }>('/auth/login', {
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
    const res = await fetch(`${API}/auth/register`, {
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

  getOAuthProviders: () =>
    request<{ google: boolean; facebook: boolean; youtube: boolean }>('/auth/providers', {}),

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
      counts: { total: number; active: number; pending: number; blocked: number };
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
    opts?: { radiusKm?: number; distanceFilter?: boolean }
  ) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
    });
    if (opts?.radiusKm !== undefined) params.set('radius', String(opts.radiusKm));
    if (opts?.distanceFilter === false) params.set('distanceFilter', 'false');
    else if (opts?.distanceFilter === true) params.set('distanceFilter', 'true');
    return request<{
      salons: import('../types').Salon[];
      lives: import('../types').Live[];
      people: import('../types').NearbyPerson[];
    }>(`/geo/nearby?${params}`, {}, token);
  },

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

  searchSpotify: (token: string, query: string) =>
    request<{ results: import('../types').SpotifySearchResult[] }>(
      `/salons/spotify-search?q=${encodeURIComponent(query)}`,
      {},
      token
    ),

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

  getYoutubeOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/youtube/oauth/url', {}, token),

  getSpotifyOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/spotify/oauth/url', {}, token),

  getInstagramOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/instagram/oauth/url', {}, token),

  getPlatformStatus: (token: string) =>
    request<{
      links: Array<{
        platform: 'spotify' | 'youtube' | 'instagram';
        externalUserId: string;
        connectedAt: number;
        displayName?: string;
        avatarUrl?: string;
        email?: string;
        topArtists?: string[];
        isRealOAuth?: boolean;
      }>;
      connectedPlatforms: ('spotify' | 'youtube')[];
      youtubeOAuthAvailable: boolean;
      spotifyOAuthAvailable: boolean;
      instagramOAuthAvailable: boolean;
      oauthConfigured?: boolean;
      platformConnectionRequired?: boolean;
      hasRealPlatformConnection?: boolean;
    }>('/platforms/status', {}, token),

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

  getSalonQueue: (token: string, salonId: string) =>
    request<{ queue: import('../types').SalonQueueItem[] }>(`/salons/${salonId}/queue`, {}, token),

  getSalonProposals: (token: string, salonId: string) =>
    request<{ proposals: import('../types').SalonTrackProposal[] }>(`/salons/${salonId}/proposals`, {}, token),

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
    const res = await fetch(`${API}/lives/${id}`, { headers: headers(token) });
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
    if (!res.ok) throw new Error(await parseApiError(res));
    return body as { live: import('../types').Live };
  },

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

  getSubscriptionsConfig: (token?: string | null) =>
    request<import('./subscriptions').SubscriptionsConfig>('/subscriptions/config', {}, token),

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

  deleteAccount: (token: string, password: string) =>
    request<{ ok: boolean }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }, token),

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

  searchUsers: (token: string, query: string) =>
    request<{ users: import('../types').UserSearchHit[] }>(
      `/users/search?q=${encodeURIComponent(query)}`,
      {},
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
};
