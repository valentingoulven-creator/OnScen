import { describe, expect, it, vi } from 'vitest';

import {
  deleteFeedPostFromPg,
  schedulePersistFeedPostLike,
  upsertFeedPost,
} from './pgFeedPosts';

vi.mock('../db/pool', () => ({
  isPostgresEnabled: () => true,
  getPool: () => ({
    query: vi.fn(async () => ({ rows: [] })),
  }),
}));

describe('pgFeedPosts', () => {
  it('upserts feed post with ON CONFLICT', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await upsertFeedPost({ query } as never, {
      id: 'p1',
      userId: 'u1',
      content: 'hello',
      createdAt: 1,
    });
    expect(String(query.mock.calls[0][0])).toContain('ON CONFLICT');
  });

  it('deletes post and related rows', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await deleteFeedPostFromPg({ query } as never, 'p1');
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('schedulePersistFeedPostLike does not throw', () => {
    expect(() => schedulePersistFeedPostLike('p1', 'u1', true)).not.toThrow();
  });
});
