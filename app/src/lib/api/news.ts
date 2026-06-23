import { request } from './core';

export const newsApi = {
  getFeaturedSounds: (token: string, limit = 5) =>
    request<{ items: import('../featuredUserSounds').FeaturedUserSoundItem[] }>(
      `/feed/featured-sounds?limit=${limit}`,
      {},
      token
    ),

  getWeeklyTopSongs: (token: string, limit = 10) =>
    request<{
      songs: Array<{
        rank: number;
        proposalId: string;
        salonId: string;
        title: string;
        artist: string;
        youtubeUrl?: string;
        spotifyUrl?: string;
        fileUrl?: string;
        proposerName: string;
        voteCount: number;
        weekStart: number;
        sourceType: 'salon' | 'composition';
        compositionId?: string;
        compositionOwnerId?: string;
      }>;
    }>(`/feed/weekly-top-songs?limit=${limit}`, {}, token),

  getNews: () =>
    request<{ news: import('../../types').MusicNewsItem[] }>('/news', {}),

  getTrendingUsers: (token: string, country?: string) => {
    const params = new URLSearchParams();
    if (country) params.set('country', country);
    const qs = params.toString();
    return request<{ users: import('../../types').TrendingUser[] }>(
      `/trending/users${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  }
} as const;
