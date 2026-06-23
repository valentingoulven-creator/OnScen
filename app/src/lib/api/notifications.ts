import { request } from './core';

export const notificationsApi = {
  sendHeart: (token: string, userId: string) =>
    request<{
      ok: boolean;
      matched: boolean;
      match: import('../../types').MusicMatch | null;
      waitingForReply: boolean;
    }>(`/notifications/heart/${userId}`, { method: 'POST' }, token),

  getMatchStatus: (token: string, userId: string) =>
    request<import('../../types').MatchStatus>(`/notifications/matches/with/${userId}`, {}, token),

  getMatches: (token: string) =>
    request<{ matches: import('../../types').MusicMatch[] }>('/notifications/matches/list', {}, token),

  getNotifications: (token: string) =>
    request<{ notifications: import('../../types').AppNotification[]; unreadCount: number }>(
      '/notifications/list',
      {},
      token
    ),

  markNotificationsRead: (token: string) =>
    request<{ ok: boolean; unreadCount: number }>('/notifications/read-all', { method: 'PATCH' }, token)
} as const;
