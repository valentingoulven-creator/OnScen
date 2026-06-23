import { request } from './core';

export const salonsApi = {
  listSalons: (token: string) =>
    request<{ salons: import('../../types').Salon[] }>('/salons', {}, token),

  getSalon: (token: string, id: string) =>
    request<{ salon: import('../../types').Salon }>(`/salons/${id}`, {}, token),

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
    request<{ playbackState: import('../../types').PlaybackState }>(
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
      queueItem: import('../../types').SalonQueueItem;
      queue: import('../../types').SalonQueueItem[];
      playbackState: import('../../types').PlaybackState;
    }>(`/salons/${salonId}/playback/add-to-queue`, { method: 'POST', body: JSON.stringify(body) }, token),

  salonLoadPlaylist: (
    token: string,
    salonId: string,
    body: { playlistId?: string; playlistUrl?: string }
  ) =>
    request<{ playbackState: import('../../types').PlaybackState; queue: import('../../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/load-playlist`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  createSalon: (token: string, body: object) =>
    request<{ salon: import('../../types').Salon }>('/salons', { method: 'POST', body: JSON.stringify(body) }, token),

  joinSalon: (token: string, salonId: string) =>
    request<{ ok: boolean; salon: import('../../types').Salon }>(`/salons/${salonId}/join`, { method: 'POST' }, token),

  deleteSalon: (token: string, salonId: string) =>
    request<{ ok: boolean }>(`/salons/${salonId}`, { method: 'DELETE' }, token),

  updateSalonSettings: (token: string, salonId: string, body: object) =>
    request<{ salon: import('../../types').Salon }>(
      `/salons/${salonId}/settings`,
      { method: 'PATCH', body: JSON.stringify(body) },
      token
    ),

  addSalonGuest: (token: string, salonId: string, userId: string) =>
    request<{ salon: import('../../types').Salon }>(
      `/salons/${salonId}/allowed`,
      { method: 'POST', body: JSON.stringify({ userId }) },
      token
    ),

  removeSalonGuest: (token: string, salonId: string, userId: string) =>
    request<{ salon: import('../../types').Salon }>(`/salons/${salonId}/allowed/${userId}`, { method: 'DELETE' }, token),

  validateSalonGuests: (token: string, salonId: string, userIds: string[]) =>
    request<{ salon: import('../../types').Salon; invitedCount: number }>(
      `/salons/${salonId}/validate-guests`,
      { method: 'POST', body: JSON.stringify({ userIds }) },
      token
    ),

  getSalonQueue: (token: string, salonId: string) =>
    request<{ queue: import('../../types').SalonQueueItem[] }>(`/salons/${salonId}/queue`, {}, token),

  reorderSalonQueue: (token: string, salonId: string, order: string[]) =>
    request<{ queue: import('../../types').SalonQueueItem[] }>(
      `/salons/${salonId}/queue/reorder`,
      { method: 'PATCH', body: JSON.stringify({ order }) },
      token
    ),

  getSalonProposals: (token: string, salonId: string) =>
    request<{ proposals: import('../../types').SalonTrackProposal[] }>(`/salons/${salonId}/proposals`, {}, token),

  getSalonParticipants: (token: string, salonId: string) =>
    request<{ participants: import('../../types').SalonParticipant[]; listenersCount: number }>(
      `/salons/${salonId}/participants`,
      {},
      token
    ),

  setSalonParticipantVip: (token: string, salonId: string, userId: string, add: boolean) =>
    request<{ salon: import('../../types').Salon }>(
      `/salons/${salonId}/participants/${userId}/vip`,
      { method: 'PATCH', body: JSON.stringify({ add }) },
      token
    ),

  proposeSalonTrack: (
    token: string,
    salonId: string,
    body: { title: string; artist: string; spotifyUrl?: string; youtubeUrl?: string }
  ) =>
    request<{ proposal: import('../../types').SalonTrackProposal }>(
      `/salons/${salonId}/proposals`,
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  acceptSalonProposal: (token: string, salonId: string, proposalId: string, playNow = false) =>
    request<{
      proposal: import('../../types').SalonTrackProposal;
      queueItem: import('../../types').SalonQueueItem;
      queue: import('../../types').SalonQueueItem[];
      playbackState?: import('../../types').PlaybackState;
    }>(`/salons/${salonId}/proposals/${proposalId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ playNow }),
    }, token),

  rejectSalonProposal: (token: string, salonId: string, proposalId: string) =>
    request<{ proposal: import('../../types').SalonTrackProposal }>(
      `/salons/${salonId}/proposals/${proposalId}/reject`,
      { method: 'POST' },
      token
    ),

  upvoteSalonProposal: (token: string, salonId: string, proposalId: string) =>
    request<{ proposal: import('../../types').SalonTrackProposal }>(
      `/salons/${salonId}/proposals/${proposalId}/upvote`,
      { method: 'POST' },
      token
    ),

  salonPlaybackSkip: (token: string, salonId: string) =>
    request<{ playbackState: import('../../types').PlaybackState; queue: import('../../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/skip`,
      { method: 'POST' },
      token
    ),

  salonPlayQueueItem: (token: string, salonId: string, queueItemId: string) =>
    request<{ playbackState: import('../../types').PlaybackState; queue: import('../../types').SalonQueueItem[] }>(
      `/salons/${salonId}/playback/play-queue`,
      { method: 'POST', body: JSON.stringify({ queueItemId }) },
      token
    ),

  salonChat: (token: string, salonId: string) =>
    request<{ messages: import('../../types').ChatMessage[] }>(`/chat/salon/${salonId}`, {}, token)
} as const;
