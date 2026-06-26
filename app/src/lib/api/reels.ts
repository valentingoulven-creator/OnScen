import { serializeFeedAlgoForApi, type ReelFeedAlgorithmPreferences } from '../reelFeedAlgorithm';
import { request } from './core';

export const reelsApi = {
  getReelsFeed: (token: string, feedAlgo?: ReelFeedAlgorithmPreferences) => {
    const qs = feedAlgo != null ? `?feedAlgo=${serializeFeedAlgoForApi(feedAlgo)}` : '';
    return request<{ reels: import('../../content/reels').MusicReel[] }>(`/reels${qs}`, {}, token);
  },

  recordReelView: (token: string, reelId: string) =>
    request<{ ok: boolean; viewCount: number; alreadyViewed: boolean }>(
      `/reels/${reelId}/view`,
      { method: 'POST' },
      token
    ),

  getUserReels: (token: string, userId: string) =>
    request<{ reels: import('../../content/reels').MusicReel[] }>(`/reels/user/${userId}`, {}, token),

  getUserPrivateReels: (token: string, userId: string) =>
    request<{ reels: import('../../content/reels').MusicReel[] }>(
      `/reels/user/${userId}/private`,
      {},
      token
    ),

  getMyPrivateReels: (token: string) =>
    request<{ reels: import('../../content/reels').MusicReel[] }>('/reels/private/me', {}, token),

  getReel: (token: string, reelId: string) =>
    request<{ reel: import('../../content/reels').MusicReel }>(`/reels/${reelId}`, {}, token),

  getUserCreatedReels: (token: string) =>
    request<{ reels: import('../../content/reels').MusicReel[] }>('/reels/user-created', {}, token),

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
      rightsConfirmed?: boolean;
    }
  ) =>
    request<{ reel: import('../../content/reels').MusicReel }>(
      '/reels',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteReel: (token: string, reelId: string) =>
    request<{ ok: boolean }>(`/reels/${reelId}`, { method: 'DELETE' }, token),

  publishReel: (token: string, reelId: string) =>
    request<{ reel: import('../../content/reels').MusicReel }>(`/reels/${reelId}/publish`, { method: 'POST' }, token),

  getReelStats: (token: string, reelId: string) =>
    request<{ stats: import('../../types').ReelStats }>(`/reels/${reelId}/stats`, {}, token),

  toggleReelHeart: (token: string, reelId: string) =>
    request<{ liked: boolean; heartCount: number }>(`/reels/${reelId}/heart`, { method: 'POST' }, token),

  getReelComments: (token: string, reelId: string) =>
    request<{ comments: import('../../types').ReelComment[] }>(`/reels/${reelId}/comments`, {}, token),

  postReelComment: (token: string, reelId: string, content: string) =>
    request<{ comment: import('../../types').ReelComment; commentCount: number }>(
      `/reels/${reelId}/comments`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token
    ),

  shareReel: (token: string, reelId: string) =>
    request<{ ok: boolean; shareCount: number; alreadyShared: boolean }>(
      `/reels/${reelId}/share`,
      { method: 'POST' },
      token
    )
} as const;
