import { request } from './core';

export const storiesApi = {
  getStories: (
    token: string,
    opts?: { latitude?: number; longitude?: number; radius?: number }
  ) => {
    const params = new URLSearchParams();
    if (opts?.latitude != null) params.set('latitude', String(opts.latitude));
    if (opts?.longitude != null) params.set('longitude', String(opts.longitude));
    if (opts?.radius != null) params.set('radius', String(opts.radius));
    const qs = params.toString();
    return request<{ stories: import('../../types').MapStory[] }>(
      `/stories${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  getMyStory: (token: string) =>
    request<{ story: import('../../types').MapStory | null; stories: import('../../types').MapStory[] }>(
      '/stories/mine',
      {},
      token
    ),

  createStory: (
    token: string,
    body: {
      content?: string;
      imageUrl?: string;
      musicTrack?: import('../../types').StoryMusicTrack;
      taggedUserIds?: string[];
      link?: import('../../types').StoryLink;
      visibility?: 'public' | 'followers';
    }
  ) =>
    request<{ story: import('../../types').MapStory }>(
      '/stories',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  deleteStory: (token: string, storyId: string) =>
    request<{ ok: boolean }>(`/stories/${storyId}`, { method: 'DELETE' }, token)
} as const;
