import { request } from './core';

export const musicApi = {
  getMusicHome: (token: string) =>
    request<import('../musicTypes').MusicHomePayload>('/music/home', {}, token),

  searchMusic: (token: string, q: string) => {
    const params = new URLSearchParams({ q: q.trim() });
    return request<import('../musicTypes').MusicSearchPayload>(`/music/search?${params}`, {}, token);
  },
} as const;
