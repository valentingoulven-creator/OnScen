import { request } from './core';

export const musicApi = {
  getMusicHome: (
    token: string,
    opts: { latitude: number; longitude: number; radiusKm: number; label: string }
  ) => {
    const params = new URLSearchParams({
      latitude: String(opts.latitude),
      longitude: String(opts.longitude),
      radiusKm: String(opts.radiusKm),
      label: opts.label,
    });
    return request<import('../musicTypes').MusicHomePayload>(`/music/home?${params}`, {}, token);
  }
} as const;
