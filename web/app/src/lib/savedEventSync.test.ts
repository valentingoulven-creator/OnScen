import { describe, expect, it } from 'vitest';
import { applySavedEventChanged, applySavedEventPostsChanged } from './savedEventSync';
import type { FeedPost } from '../types';

function eventPost(id: string): FeedPost {
  return {
    id,
    userId: 'u1',
    content: 'Concert',
    createdAt: 1,
    author: { id: 'u1', username: 'host' },
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
    isEvent: true,
    eventLocation: 'Montpellier',
  };
}

describe('applySavedEventChanged', () => {
  it('adds postId when saved', () => {
    expect(applySavedEventChanged(new Set(['a']), 'b', true)).toEqual(new Set(['a', 'b']));
  });

  it('removes postId when unsaved', () => {
    expect(applySavedEventChanged(new Set(['a', 'b']), 'b', false)).toEqual(new Set(['a']));
  });
});

describe('applySavedEventPostsChanged', () => {
  it('appends an event post when saved', () => {
    const post = eventPost('e2');
    const next = applySavedEventPostsChanged([eventPost('e1')], {
      postId: 'e2',
      saved: true,
      post,
    });
    expect(next.map((p) => p.id)).toEqual(['e1', 'e2']);
    expect(next[1]?.favoriteByMe).toBe(true);
  });

  it('removes a post when unsaved', () => {
    const next = applySavedEventPostsChanged([eventPost('e1'), eventPost('e2')], {
      postId: 'e2',
      saved: false,
    });
    expect(next.map((p) => p.id)).toEqual(['e1']);
  });

  it('ignores a non-event post', () => {
    const post = { ...eventPost('p1'), isEvent: false };
    const prev = [eventPost('e1')];
    expect(applySavedEventPostsChanged(prev, { postId: 'p1', saved: true, post })).toEqual(prev);
  });
});
