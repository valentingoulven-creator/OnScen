import { request, API_BASE as API, headers, parseApiError, normalizeFetchNetworkError } from './core';

export const livesApi = {
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
    return request<{ lives: import('../../types').Live[] }>(`/lives${q ? `?${q}` : ''}`, {}, token);
  },

  getLive: async (token: string, id: string) => {
    let res: Response;
    try {
      res = await fetch(`${API}/lives/${id}`, { credentials: 'include', headers: headers(token) });
    } catch (e) {
      normalizeFetchNetworkError(e);
    }
    const body = (await res.json().catch(() => ({}))) as {
      live?: import('../../types').Live;
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
    if (!res.ok) throw await parseApiError(res);
    return body as { live: import('../../types').Live };
  },

  getLiveParticipants: (token: string, liveId: string) =>
    request<{ participants: import('../../types').LiveParticipant[]; viewersCount: number }>(
      `/lives/${liveId}/participants`,
      {},
      token
    ),

  startLive: (
    token: string,
    title?: string,
    opts?: {
      latitude?: number;
      longitude?: number;
      stripeConnectSkipped?: boolean;
      useObs?: boolean;
      contentCategory?: 'music' | 'dance' | 'artistic';
    }
  ) =>
    request<{ live: import('../../types').Live }>(
      '/lives/start',
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          latitude: opts?.latitude,
          longitude: opts?.longitude,
          stripeConnectSkipped: opts?.stripeConnectSkipped,
          useObs: opts?.useObs,
          contentCategory: opts?.contentCategory,
        }),
      },
      token
    ),

  stopLive: (token: string) => request<{ ok: boolean }>('/lives/stop', { method: 'POST' }, token),

  getLivePlayback: (token: string, liveId: string) =>
    request<{
      streamMode: 'cloudflare';
      playbackUrl: string;
      liveInputId?: string;
      isArchived?: boolean;
    }>(`/lives/${liveId}/playback`, {}, token),

  getLiveIceServers: (token: string, liveId: string) =>
    request<{ iceServers: RTCIceServer[] }>(
      `/lives/ice-servers?liveId=${encodeURIComponent(liveId)}`,
      {},
      token
    ),

  getLiveStreamCapabilities: (token: string) =>
    request<{
      cloudflareStreamAvailable: boolean;
      cloudflareConfigured?: boolean;
      livekitAvailable: boolean;
      obsAllowed?: boolean;
      platformPlanId?: string;
    }>('/lives/stream-capabilities', {}, token),

  provisionCloudflareStream: (token: string, liveId: string) =>
    request<{ live: import('../../types').Live }>(
      `/lives/${liveId}/cloudflare-stream`,
      { method: 'POST' },
      token
    ),

  getCloudflareIngest: (token: string, liveId: string) =>
    request<{
      rtmpsUrl: string;
      rtmpUrl?: string;
      streamKey: string;
      playbackUrl: string;
      whipUrl?: string;
      liveInputId: string;
    }>(`/lives/${liveId}/cloudflare-ingest`, {}, token),

  getCloudflareStreamStatus: (token: string, liveId: string) =>
    request<{
      live: boolean;
      videoUid: string | null;
      status?: string;
      liveInputId: string;
      playbackUrl?: string;
    }>(`/lives/${liveId}/cloudflare-stream-status`, {}, token),

  getLiveKitToken: (token: string, liveId: string) =>
    request<{
      token: string;
      serverUrl: string;
      roomName: string;
      canPublish: boolean;
      streamMode: 'livekit';
    }>(`/lives/${liveId}/livekit-token`, {}, token),

  getLiveKitCdnIngest: (token: string, liveId: string) =>
    request<{
      rtmpsUrl: string;
      rtmpUrl: string;
      streamKey: string;
      playbackUrl: string;
      liveInputId: string;
      egressActive: boolean;
    }>(`/lives/${liveId}/livekit-cdn-ingest`, {}, token),

  startEgress: (token: string, liveId: string) =>
    request<{
      egressId: string;
      hlsUrl: string;
      rtmpsUrl: string;
      rtmpUrl: string;
      streamKey: string;
      playbackUrl: string;
      liveInputId: string;
    }>(`/lives/${liveId}/start-egress`, { method: 'POST' }, token),

  stopEgress: (token: string, liveId: string) =>
    request<{ stopped: boolean }>(
      `/lives/${liveId}/stop-egress`,
      { method: 'POST' },
      token
    ),

  liveChat: (token: string, liveId: string) =>
    request<{ messages: import('../../types').ChatMessage[] }>(`/chat/live/${liveId}`, {}, token),

  getUserLives: (token: string, userId: string) =>
    request<{ lives: import('../../components/UserLivesSection').ArchivedLive[] }>(
      `/lives/user/${userId}`,
      {},
      token
    )
} as const;
