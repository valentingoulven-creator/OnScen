import { request } from './core';

export const musicApi = {
  getMusicHome: (token: string) =>
    request<import('../musicTypes').MusicHomePayload>('/music/home', {}, token),

  searchMusic: (token: string, q: string) => {
    const params = new URLSearchParams({ q: q.trim() });
    return request<import('../musicTypes').MusicSearchPayload>(`/music/search?${params}`, {}, token);
  },

  checkMusicFavorite: (token: string, compositionId: string) =>
    request<{ favorited: boolean }>(`/music/favorites/check/${encodeURIComponent(compositionId)}`, {}, token),

  addMusicFavorite: (token: string, compositionId: string) =>
    request<{ ok: true; alreadySaved: boolean }>(
      '/music/favorites',
      { method: 'POST', body: JSON.stringify({ compositionId }) },
      token
    ),

  removeMusicFavorite: (token: string, compositionId: string) =>
    request<{ ok: true; removed: boolean }>(
      `/music/favorites/${encodeURIComponent(compositionId)}`,
      { method: 'DELETE' },
      token
    ),

  /** Ajoute un morceau (référence) dans une playlist/album possédé par l'utilisateur courant. */
  addTrackToPlaylist: (token: string, albumId: string, compositionId: string) =>
    request<{ ok: true; alreadySaved: boolean }>(
      `/music/playlists/${encodeURIComponent(albumId)}/tracks`,
      { method: 'POST', body: JSON.stringify({ compositionId }) },
      token
    ),
} as const;
