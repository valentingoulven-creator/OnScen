import { serializeFeedAlgoForApi, type ReelFeedAlgorithmPreferences } from './reelFeedAlgorithm';
import { isOfflineDemo } from './offlineDemo';
import { offlineGetLive, offlineRequest } from './offlineApi';

const API = '/api';

function headers(token?: string | null): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) return json.error;
    } catch {
      if (text.length < 200) return text;
    }
  }
  if (res.status === 413) {
    return 'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.';
  }
  if (res.status === 401) return 'Session expirée — reconnectez-vous';
  if (res.status === 403) return 'Accès refusé';
  return res.statusText || 'Erreur réseau';
}

async function request<T>(path: string, opts: RequestInit = {}, token?: string | null): Promise<T> {
  if (isOfflineDemo()) {
    return offlineRequest<T>(path, opts);
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers(token), ...opts.headers } });
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: import('../types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  me: (token: string) => request<{ user: import('../types').User }>('/auth/me', {}, token),

  updateGeo: (token: string, latitude: number, longitude: number) =>
    request<{ blurredLatitude: number; blurredLongitude: number }>(
      '/geo/update',
      { method: 'POST', body: JSON.stringify({ latitude, longitude }) },
      token
    ),

  nearby: (token: string, lat: number, lon: number, radius = 10) =>
    request<{
      salons: import('../types').Salon[];
      lives: import('../types').Live[];
      people: import('../types').NearbyPerson[];
    }>(`/geo/nearby?latitude=${lat}&longitude=${lon}&radius=${radius}`, {}, token),

  getSalon: (token: string, id: string) =>
    request<{ salon: import('../types').Salon }>(`/salons/${id}`, {}, token),

  resolveSalonTrack: (token: string, salonId: string, platform: 'spotify' | 'youtube') =>
    request<{ track: import('../types').ResolvedSalonTrack }>(
      `/salons/${salonId}/resolve-track?platform=${platform}`,
      {},
      token
    ),

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
    opts?: { latitude?: number; longitude?: number; radiusKm?: number }
  ) => {
    const params = new URLSearchParams();
    if (opts?.latitude !== undefined) params.set('latitude', String(opts.latitude));
    if (opts?.longitude !== undefined) params.set('longitude', String(opts.longitude));
    if (opts?.radiusKm !== undefined) params.set('radiusKm', String(opts.radiusKm));
    const q = params.toString();
    return request<{ lives: import('../types').Live[] }>(`/lives${q ? `?${q}` : ''}`, {}, token);
  },

  getLive: async (token: string, id: string) => {
    if (isOfflineDemo()) {
      return offlineGetLive(id);
    }
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
    request<{ onlineUserIds: string[] }>('/dm/presence', {}, token),

  getConversations: (token: string) =>
    request<{ conversations: import('../types').Conversation[] }>('/dm/conversations/list', {}, token),

  getDmContacts: (token: string) =>
    request<{ contacts: import('../types').DmContact[] }>('/dm/contacts/list', {}, token),

  blockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'POST' }, token),

  unblockUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/dm/block/${userId}`, { method: 'DELETE' }, token),

  getBlockedUsers: (token: string) =>
    request<{ blocked: import('../types').DmContact[] }>('/dm/blocks/list', {}, token),

  getDmThread: (token: string, userId: string) =>
    request<{
      messages: import('../types').DirectMessage[];
      otherUser: import('../types').DmContact;
    }>(`/dm/thread/${userId}`, {}, token),

  sendDm: (token: string, userId: string, content: string) =>
    request<{ message: import('../types').DirectMessage }>(
      `/dm/thread/${userId}`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  deleteDmMessage: (token: string, messageId: string, forAll = false) =>
    request<{ ok: boolean; messageId: string; scope: 'hidden' | 'all' }>(
      `/dm/messages/${messageId}${forAll ? '?forAll=true' : ''}`,
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

  toggleGhost: (token: string, isGhostMode: boolean) =>
    request<{ isGhostMode: boolean }>('/auth/ghost-mode', { method: 'PATCH', body: JSON.stringify({ isGhostMode }) }, token),

  updateProfile: (token: string, body: object) =>
    request<{ user: import('../types').User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }, token),

  connectPlatform: (token: string, platform: 'spotify' | 'youtube') =>
    request<{ ok: boolean; user: import('../types').User }>(
      `/platforms/${platform}/connect`,
      { method: 'POST' },
      token
    ),

  disconnectPlatform: (token: string, platform: 'spotify' | 'youtube') =>
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
    request<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' }, token),

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
};
