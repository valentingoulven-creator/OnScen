import { request } from './core';

export const usersApi = {
  updatePrivacySettings: (
    token: string,
    body: {
      shareDistance?: boolean;
      locationPrecision?: 'precise' | 'city';
      allowPrivateMessages?: boolean;
    }
  ) =>
    request<{ user: import('../../types').User }>(
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

  getLiveSetup: (token: string) =>
    request<{ setup: import('../liveMediaPrefs').LiveMediaPrefs | null; configured: boolean }>(
      '/users/me/live-setup',
      {},
      token
    ),

  putLiveSetup: (token: string, setup: import('../liveMediaPrefs').LiveMediaPrefs) =>
    request<{ setup: import('../liveMediaPrefs').LiveMediaPrefs; configured: boolean }>(
      '/users/me/live-setup',
      { method: 'PUT', body: JSON.stringify({ setup }) },
      token
    ),

  getHostRating: (token: string, hostId: string) =>
    request<{ rating: import('../../types').HostRatingSummary }>(`/ratings/host/${hostId}`, {}, token),

  rateHost: (
    token: string,
    hostId: string,
    stars: number,
    context?: { salonId?: string; liveId?: string }
  ) =>
    request<{ rating: import('../../types').HostRatingSummary }>(
      '/ratings',
      {
        method: 'POST',
        body: JSON.stringify({ hostId, stars, salonId: context?.salonId, liveId: context?.liveId }),
      },
      token
    ),

  searchUsers: (token: string, query: string, signal?: AbortSignal) =>
    request<{ users: import('../../types').UserSearchHit[] }>(
      `/users/search?q=${encodeURIComponent(query)}`,
      { signal },
      token
    ),

  globalSearch: (token: string, query: string, signal?: AbortSignal) =>
    request<import('../globalSearchTypes').GlobalSearchApiResult>(
      `/search?q=${encodeURIComponent(query)}`,
      { signal },
      token
    ),

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
    request<{ following: import('../../types').User[]; followingIds: string[] }>(
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
    request<{ favorites: import('../../types').User[] }>('/users/me/favorites', {}, token),

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

  getCreatorStats: (token: string) =>
    request<{ stats: import('../../components/CreatorDashboardCard').CreatorDashboardStats }>(
      '/users/me/creator-stats',
      {},
      token
    ),

  getObsIngest: (token: string) =>
    request<{
      rtmpsUrl: string;
      rtmpUrl?: string;
      streamKey: string;
      playbackUrl: string;
      whipUrl?: string;
      liveInputId: string;
      persistent: true;
      streamQuotaOk?: boolean;
      streamQuotaLimitMinutes?: number;
    }>('/users/me/obs-ingest', {}, token),

  rotateObsStreamKey: (token: string) =>
    request<{
      rtmpsUrl: string;
      rtmpUrl?: string;
      streamKey: string;
      playbackUrl: string;
      whipUrl?: string;
      liveInputId: string;
      persistent: true;
    }>('/users/me/obs-stream-key/rotate', { method: 'POST' }, token),

  repairObsStreamInput: (token: string) =>
    request<{
      rtmpsUrl: string;
      rtmpUrl?: string;
      streamKey: string;
      playbackUrl: string;
      whipUrl?: string;
      liveInputId: string;
      persistent: true;
    }>('/users/me/obs-stream-repair', { method: 'POST' }, token),

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
    )
} as const;
