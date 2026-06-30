import { describe, expect, it, vi } from 'vitest';

import { syncFeedTablesToPg, syncNotificationsToPg } from './pgStoreFeedSync';

function mockClient() {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql: String(sql).trim(), params });
      return { rows: [] };
    }),
  };
  return { client, queries };
}

describe('pgStoreFeedSync', () => {
  it('upserts feed posts and prunes stale rows', async () => {
    const { client, queries } = mockClient();
    await syncFeedTablesToPg(client as never, {
      feedPosts: [{ id: 'p1', userId: 'u1', content: 'hi', createdAt: 1 } as never],
      feedPostLikes: { p1: ['u2'] },
      feedPostComments: {},
      feedPostFavorites: { u2: ['p1'] },
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO feed_posts') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('DELETE FROM feed_posts WHERE NOT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('feed_post_likes') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('feed_post_favorites'))).toBe(true);
  });

  it('upserts notifications and prunes stale rows', async () => {
    const { client, queries } = mockClient();
    await syncNotificationsToPg(client as never, [
      {
        id: 'n1',
        recipientId: 'u1',
        senderId: 'u2',
        senderName: 'Bob',
        type: 'heart',
        message: 'hi',
        read: false,
        createdAt: 1,
      } as never,
    ]);

    expect(queries.some((q) => q.sql.includes('INSERT INTO notifications') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('DELETE FROM notifications WHERE NOT'))).toBe(true);
  });
});
