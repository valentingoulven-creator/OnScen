import { describe, expect, it, vi } from 'vitest';

import { syncDirectMessagesToPg } from './pgDirectMessages';
import {
  syncHeartEventsToPg,
  syncSocialTablesFromStore,
  syncUserFollowsToPg,
} from './pgStoreSocialSync';

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

describe('pgDirectMessages', () => {
  it('upserts DMs and prunes stale rows', async () => {
    const { client, queries } = mockClient();
    await syncDirectMessagesToPg(client as never, [
      {
        id: 'dm1',
        senderId: 'u1',
        receiverId: 'u2',
        content: 'hi',
        timestamp: 1,
        accepted: true,
      },
    ]);

    expect(queries.some((q) => q.sql.includes('INSERT INTO direct_messages') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('DELETE FROM direct_messages WHERE NOT'))).toBe(true);
  });
});

describe('pgStoreSocialSync', () => {
  it('upserts user follows and prunes stale pairs', async () => {
    const { client, queries } = mockClient();
    await syncUserFollowsToPg(client as never, { u1: ['u2'] });

    expect(queries.some((q) => q.sql.includes('INSERT INTO user_follows') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('DELETE FROM user_follows'))).toBe(true);
  });

  it('upserts heart events and prunes stale pairs', async () => {
    const { client, queries } = mockClient();
    await syncHeartEventsToPg(client as never, [{ fromId: 'u1', toId: 'u2', createdAt: 1 }]);

    expect(queries.some((q) => q.sql.includes('INSERT INTO heart_events') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('DELETE FROM heart_events'))).toBe(true);
  });

  it('syncs multiple social tables with upsert', async () => {
    const { client, queries } = mockClient();
    await syncSocialTablesFromStore(client as never, {
      directMessages: [
        {
          id: 'dm1',
          senderId: 'u1',
          receiverId: 'u2',
          content: 'hi',
          timestamp: 1,
          accepted: true,
        },
      ],
      salonChats: { s1: [] },
      liveChats: {},
      liveBans: [],
      userBlocks: [],
      userFollows: { u1: ['u2'] },
    });

    expect(queries.some((q) => q.sql.includes('INSERT INTO direct_messages') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO salon_chats') && q.sql.includes('ON CONFLICT'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('INSERT INTO user_follows') && q.sql.includes('ON CONFLICT'))).toBe(true);
  });
});
