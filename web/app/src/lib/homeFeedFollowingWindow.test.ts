import { describe, expect, it } from 'vitest';
import {
  filterNonFollowingFeedPosts,
  getHomeFeedFollowingCutoffMs,
  HOME_FEED_FOLLOWING_RECENT_MS,
  partitionFollowingFeedByRecency,
} from './homeFeedFollowingWindow';
import type { FeedPost } from '../types';

function post(id: string, createdAt: number, userId = 'u1'): FeedPost {
  return {
    id,
    userId,
    author: { id: userId, username: 'a' },
    content: '',
    createdAt,
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
  };
}

describe('homeFeedFollowingWindow', () => {
  it('partitions by 2-day cutoff', () => {
    const now = 1_000_000;
    const cutoff = now - HOME_FEED_FOLLOWING_RECENT_MS;
    const { recent, older } = partitionFollowingFeedByRecency(
      [post('a', cutoff + 1), post('b', cutoff - 1)],
      cutoff
    );
    expect(recent.map((p) => p.id)).toEqual(['a']);
    expect(older.map((p) => p.id)).toEqual(['b']);
  });

  it('getHomeFeedFollowingCutoffMs uses 2 days', () => {
    const now = 5_000_000;
    expect(getHomeFeedFollowingCutoffMs(now)).toBe(now - HOME_FEED_FOLLOWING_RECENT_MS);
  });

  it('filterNonFollowingFeedPosts excludes viewer and following', () => {
    const following = new Set(['f1']);
    const filtered = filterNonFollowingFeedPosts(
      [post('1', 1, 'viewer'), post('2', 1, 'f1'), post('3', 1, 'other')],
      'viewer',
      following
    );
    expect(filtered.map((p) => p.id)).toEqual(['3']);
  });
});
