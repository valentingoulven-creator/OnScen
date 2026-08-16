import { describe, expect, it } from 'vitest';
import { isFeedPostOwner } from './feedPostOwner';

const post = {
  userId: 'user_listener',
  author: { id: 'user_listener', username: 'demo_test_founder' },
};

describe('isFeedPostOwner', () => {
  it('true when session id matches post.userId', () => {
    expect(isFeedPostOwner({ id: 'user_listener' }, post)).toBe(true);
  });

  it('true when session id matches author.id', () => {
    expect(isFeedPostOwner({ id: 'user_listener' }, { userId: 'other', author: post.author })).toBe(
      true
    );
  });

  it('false for another account', () => {
    expect(isFeedPostOwner({ id: 'bot_luna' }, post)).toBe(false);
  });

  it('false without session', () => {
    expect(isFeedPostOwner(null, post)).toBe(false);
  });
});
