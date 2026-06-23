import { request } from './core';

export const feedApi = {
  getFeedPosts: (
    token: string,
    opts?: {
      limit?: number;
      before?: number;
      eventsOnly?: boolean;
      userEventsOnly?: boolean;
      eventDate?: string;
      eventLocationSearch?: string;
      eventCountry?: string;
      eventType?: 'dance' | 'chant' | 'autre';
      /** When true, the server ranks posts with Algo Soundy instead of chronological order. */
      algo?: boolean;
      /** Fil d'accueil : publications et événements des comptes suivis + les vôtres. */
      followingOnly?: boolean;
      /** Filtre par auteur : seuls les posts de cet utilisateur sont retournés. */
      authorId?: string;
    }
  ) => {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.before != null) params.set('before', String(opts.before));
    if (opts?.eventsOnly) params.set('eventsOnly', 'true');
    if (opts?.userEventsOnly) params.set('userEventsOnly', 'true');
    if (opts?.eventDate) params.set('eventDate', opts.eventDate);
    if (opts?.eventLocationSearch) params.set('eventLocationSearch', opts.eventLocationSearch);
    if (opts?.eventCountry) params.set('eventCountry', opts.eventCountry);
    if (opts?.eventType) params.set('eventType', opts.eventType);
    if (opts?.algo) params.set('algo', 'true');
    if (opts?.followingOnly) params.set('followingOnly', 'true');
    if (opts?.authorId) params.set('authorId', opts.authorId);
    const qs = params.toString();
    return request<{ posts: import('../../types').FeedPost[] }>(
      `/feed${qs ? `?${qs}` : ''}`,
      {},
      token
    );
  },

  createFeedPost: (
    token: string,
    body: {
      content: string;
      imageUrl?: string;
      videoUrl?: string;
      isEvent?: boolean;
      eventDate?: string;
      eventDates?: string[];
      eventEndTimes?: (string | null)[];
      eventLocation?: string;
      eventType?: 'dance' | 'chant' | 'autre';
    }
  ) =>
    request<{ post: import('../../types').FeedPost }>(
      '/feed',
      { method: 'POST', body: JSON.stringify(body) },
      token
    ),

  likeFeedPost: (token: string, postId: string) =>
    request<{ liked: boolean; likeCount: number }>(
      `/feed/posts/${postId}/like`,
      { method: 'POST' },
      token
    ),

  unlikeFeedPost: (token: string, postId: string) =>
    request<{ liked: boolean; likeCount: number }>(
      `/feed/posts/${postId}/like`,
      { method: 'DELETE' },
      token
    ),

  getFeedPostComments: (token: string, postId: string) =>
    request<{ comments: import('../../types').FeedPostComment[] }>(
      `/feed/posts/${postId}/comments`,
      {},
      token
    ),

  postFeedComment: (token: string, postId: string, content: string, textAlign?: import('../../types').CommentAlign) =>
    request<{ comment: import('../../types').FeedPostComment; commentCount: number }>(
      `/feed/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content, ...(textAlign && textAlign !== 'left' ? { textAlign } : {}) }) },
      token
    ),

  reshareFeedPost: (token: string, postId: string) =>
    request<{ post: import('../../types').FeedPost }>(
      `/feed/posts/${postId}/reshare`,
      { method: 'POST' },
      token
    ),

  addFeedPostFavorite: (token: string, postId: string) =>
    request<{ favorited: boolean }>(
      `/feed/posts/${postId}/favorite`,
      { method: 'POST' },
      token
    ),

  removeFeedPostFavorite: (token: string, postId: string) =>
    request<{ favorited: boolean }>(
      `/feed/posts/${postId}/favorite`,
      { method: 'DELETE' },
      token
    ),

  getFavoritedFeedPosts: (token: string) =>
    request<{ posts: import('../../types').FeedPost[] }>('/feed/favorites', {}, token)
} as const;
