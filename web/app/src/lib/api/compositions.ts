import { request } from './core';

export const compositionsApi = {
  getMyCompositions: (token: string) =>
    request<{ compositions: import('../../components/UserCompositionsSection').UserCompositionItem[] }>(
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
      rightsConfirmed?: boolean;
    }
  ) =>
    request<{ composition: import('../../components/UserCompositionsSection').UserCompositionItem }>(
      '/compositions',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteComposition: (token: string, compositionId: string) =>
    request<{ ok: boolean }>(`/compositions/${compositionId}`, { method: 'DELETE' }, token),

  toggleCompositionUpvote: (token: string, compositionId: string) =>
    request<{ upvoteCount: number; userHasUpvoted: boolean }>(
      `/compositions/${compositionId}/upvote`,
      { method: 'POST' },
      token
    ),

  recordCompositionPlay: (token: string, compositionId: string) =>
    request<{ weeklyPlayCount: number }>(
      `/compositions/${compositionId}/play`,
      { method: 'POST' },
      token
    ),

  getMyAlbums: (token: string) =>
    request<{
      albums: import('../../components/UserCompositionsSection').UserAlbumItem[];
      looseTrackCount: number;
    }>('/users/me/albums', {}, token),

  getUserAlbums: (token: string, userId: string) =>
    request<{
      albums: import('../../components/UserCompositionsSection').UserAlbumItem[];
      looseTrackCount: number;
    }>(`/users/${userId}/albums`, {}, token),

  createAlbum: (
    token: string,
    body: { title: string; description?: string; coverUrl?: string }
  ) =>
    request<{ album: import('../../components/UserCompositionsSection').UserAlbumItem }>(
      '/users/me/albums',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteAlbum: (token: string, albumId: string) =>
    request<{ ok: boolean }>(`/users/me/albums/${albumId}`, { method: 'DELETE' }, token),

  uploadTrackToAlbum: (
    token: string,
    albumId: string,
    body: {
      title: string;
      artist?: string;
      fileUrl: string;
      durationSec?: number;
      rightsConfirmed?: boolean;
    }
  ) =>
    request<{ track: import('../../components/UserCompositionsSection').UserCompositionItem }>(
      `/users/me/albums/${albumId}/tracks`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  uploadLooseTrack: (
    token: string,
    body: {
      title: string;
      artist?: string;
      fileUrl: string;
      durationSec?: number;
      rightsConfirmed?: boolean;
    }
  ) =>
    request<{ track: import('../../components/UserCompositionsSection').UserCompositionItem }>(
      '/users/me/loose-tracks',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  getAlbumTracks: (token: string, userId: string, albumId: string) =>
    request<{ tracks: import('../../components/UserCompositionsSection').UserCompositionItem[] }>(
      `/users/${userId}/albums/${albumId}/tracks`,
      {},
      token
    )
} as const;
