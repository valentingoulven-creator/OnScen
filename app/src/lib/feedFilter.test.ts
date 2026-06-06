import { describe, expect, it } from 'vitest';
import { applyFeedPreferences } from './feedFilter';
import { DEFAULT_FEED_USER_PREFS, type FeedUserPrefs } from './feedUserPrefs';
import type { FeedPost } from '../types';

const FIXED_CREATED_AT = 1_700_000_000_000;

function post(
  id: string,
  authorId: string,
  extra?: Partial<FeedPost['author']>
): FeedPost {
  return {
    id,
    userId: authorId,
    content: `Post ${id}`,
    createdAt: FIXED_CREATED_AT + Number(id),
    author: {
      id: authorId,
      username: authorId,
      ...extra,
    },
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
  };
}

describe('applyFeedPreferences', () => {
  const viewerId = 'me';
  const posts = [
    post('1', 'a', { profileType: 'dj' }),
    post('2', 'b', { profileType: 'bar' }),
    post('3', 'c', { favoriteGenres: ['Jazz'] }),
    post('4', viewerId),
  ];

  it('laisse tout passer par défaut', () => {
    expect(
      applyFeedPreferences(posts, DEFAULT_FEED_USER_PREFS, { viewerId })
    ).toHaveLength(4);
  });

  it('filtre favoris seulement', () => {
    const prefs: FeedUserPrefs = { ...DEFAULT_FEED_USER_PREFS, audienceScope: 'favorites_only' };
    const fav = new Set(['b']);
    const ids = applyFeedPreferences(posts, prefs, { viewerId, favoriteIds: fav }).map((p) => p.id);
    expect(ids).toEqual(['2', '4']);
  });

  it('filtre par type de profil dj', () => {
    const prefs: FeedUserPrefs = { ...DEFAULT_FEED_USER_PREFS, profileTypes: ['dj'] };
    const ids = applyFeedPreferences(posts, prefs, { viewerId }).map((p) => p.id);
    expect(ids).toEqual(['1', '4']);
  });

  it('filtre par affinités musicales', () => {
    const prefs: FeedUserPrefs = { ...DEFAULT_FEED_USER_PREFS, musicalAffinitiesOnly: true };
    const viewerTastes = { favoriteGenres: ['Jazz'] };
    const ids = applyFeedPreferences(posts, prefs, { viewerId, viewerTastes }).map((p) => p.id);
    expect(ids).toEqual(['3', '4']);
  });

  it('place les favoris en premier', () => {
    const prefs: FeedUserPrefs = { ...DEFAULT_FEED_USER_PREFS, favoritesFirst: true };
    const fav = new Set(['c']);
    const result = applyFeedPreferences(posts, prefs, { viewerId, favoriteIds: fav });
    expect(result.map((p) => p.id)).toEqual(['3', '1', '2', '4']);
  });
});
