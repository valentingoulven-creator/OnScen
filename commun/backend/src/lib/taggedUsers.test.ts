import { beforeEach, describe, expect, it } from 'vitest';
import { db, type User } from '../models/schema';
import { createFeedPost } from './feedPosts';
import { normalizeTaggedUserIds, normalizeEventTaggedUserIds, resolveTaggedUsers } from './taggedUsers';

function seedUser(id: string, username: string): User {
  return {
    id,
    username,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };
}

describe('taggedUsers', () => {
  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    db.users.set('host', seedUser('host', 'bar'));
    db.users.set('dj', seedUser('dj', 'dj_val'));
  });

  it('normalizes and resolves tagged user ids', () => {
    const ids = normalizeTaggedUserIds(['dj', 'host', 'missing'], 'host');
    expect(ids).toEqual(['dj']);
    const users = resolveTaggedUsers(ids);
    expect(users?.[0]?.username).toBe('dj_val');
  });
});

describe('createFeedPost event tags', () => {
  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    db.users.set('host', seedUser('host', 'bar'));
    db.users.set('dj', seedUser('dj', 'dj_val'));
  });

  it('stores eventTaggedUsers on event posts', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = createFeedPost('host', {
      content: 'Soirée electro',
      isEvent: true,
      eventDate: future,
      eventDates: [future],
      eventLocation: 'Bar Le Patio, Le Crès',
      eventTaggedUserIds: ['dj'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.eventTaggedUsers?.map((u) => u.id)).toEqual(['dj']);
  });

  it('skips users who declined external event tags', () => {
    db.users.set('dj', { ...seedUser('dj', 'dj_val'), allowExternalEventTags: false });
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = createFeedPost('host', {
      content: 'Soirée',
      isEvent: true,
      eventDate: future,
      eventDates: [future],
      eventLocation: 'Lyon',
      eventTaggedUserIds: ['dj'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.post.eventTaggedUsers).toBeUndefined();
    expect(normalizeEventTaggedUserIds(['dj'], 'host')).toBeUndefined();
  });
});
