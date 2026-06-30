import i18n from '../../i18n';
import {
  readCachedPlatformStatus,
  writeCachedPlatformStatus,
  type PlatformStatusResponse,
} from '../platformStatusCache';
import { ApiRequestError, request } from './core';

export const platformsApi = {
  resolveSalonTrack: (token: string, salonId: string, platform: 'youtube' = 'youtube') =>
    request<{ track: import('../../types').ResolvedSalonTrack }>(
      `/salons/${salonId}/resolve-track?platform=${platform}`,
      {},
      token
    ),

  searchYoutube: (token: string, query: string) =>
    request<{ results: import('../../types').YoutubeSearchResult[] }>(
      `/salons/youtube-search?q=${encodeURIComponent(query)}`,
      {},
      token
    ),

  salonLoadYoutubePlaylist: (
    token: string,
    salonId: string,
    body: { playlistId?: string; playlistUrl?: string }
  ) =>
    request<{ playbackState: import('../../types').PlaybackState; queue: import('../../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/load-playlist`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  getYoutubePlaylists: (token: string) =>
    request<{ playlists: import('../../types').YoutubePlaylistSummary[]; isRealAccount: boolean }>(
      '/platforms/youtube/playlists',
      {},
      token
    ),

  getYoutubeOAuthUrl: (token: string) =>
    request<{ url: string }>('/platforms/youtube/oauth/url', {}, token),

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

  connectPlatform: async (token: string, platform: 'youtube' | 'instagram') => {
    const r = await request<{
      ok: boolean;
      user?: import('../../types').User;
      code?: string;
      error?: string;
      oauthUrl?: string;
    }>(`/platforms/${platform}/connect`, { method: 'POST' }, token);
    if (r.ok === false) {
      if (r.code === 'USE_OAUTH_URL') {
        throw new ApiRequestError(i18n.t('platform.demoUseOAuth'), r.code);
      }
      if (r.code === 'MOCK_CONNECT_DISABLED') {
        throw new ApiRequestError(i18n.t('platform.demoDisabledProd'), r.code);
      }
      throw new ApiRequestError(r.error || i18n.t('platform.connectError'), r.code);
    }
    if (!r.user) {
      throw new ApiRequestError(i18n.t('platform.connectError'));
    }
    return r as { ok: boolean; user: import('../../types').User };
  },

  disconnectPlatform: (token: string, platform: 'youtube' | 'instagram') =>
    request<{ ok: boolean; user: import('../../types').User }>(
      `/platforms/${platform}/disconnect`,
      { method: 'DELETE' },
      token
    ),

  getMsdevDualIp: () =>
    request<import('../../types').MsdevDualIpConfig>('/msdev/dual-ip', {}),

  msdevLoginByIp: () =>
    request<{
      token: string;
      user: import('../../types').User;
      clientIp: string;
      matchedSlot: 'A' | 'B' | null;
      simulatedViaIp: boolean;
    }>('/msdev/login-by-ip', { method: 'POST', body: JSON.stringify({}) }),

  msdevRebuild: (token: string) =>
    request<{ ok: boolean; message: string }>('/msdev/rebuild', { method: 'POST' }, token)
} as const;
