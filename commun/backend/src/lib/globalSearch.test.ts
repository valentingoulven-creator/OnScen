import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../models/schema';
import { globalSearch } from './globalSearch';

describe('globalSearch', () => {
  beforeEach(() => {
    db.users.clear();
    db.feedPosts.length = 0;
    db.albums.length = 0;
    db.compositions.length = 0;
  });

  it('returns empty for short query', () => {
    expect(globalSearch('u1', 'a')).toEqual({
      users: [],
      events: [],
      albums: [],
      songs: [],
    });
  });

  it('finds users, events, albums and songs', () => {
    db.users.set('viewer', {
      id: 'viewer',
      username: 'viewer',
      email: 'v@test.com',
      passwordHash: 'x',
      createdAt: Date.now(),
    });
    db.users.set('dj', {
      id: 'dj',
      username: 'DJValou',
      email: 'dj@test.com',
      passwordHash: 'x',
      createdAt: Date.now(),
      city: 'Lyon',
    });

    const future = new Date(Date.now() + 86_400_000).toISOString();
    db.feedPosts.push({
      id: 'evt-1',
      userId: 'dj',
      content: 'Soirée electro Lyon',
      createdAt: Date.now(),
      isEvent: true,
      eventDate: future,
      eventLocation: 'Lyon, France',
    });

    db.albums.push({
      id: 'album-1',
      userId: 'dj',
      title: 'Summer Vibes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    db.compositions.push({
      id: 'song-1',
      userId: 'dj',
      title: 'Midnight Run',
      artist: 'DJValou',
      fileUrl: '/uploads/x.mp3',
      createdAt: Date.now(),
    });

    const users = globalSearch('viewer', 'djval');
    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.username).toBe('DJValou');

    const events = globalSearch('viewer', 'lyon');
    expect(events.events.some((e) => e.id === 'evt-1')).toBe(true);

    const albums = globalSearch('viewer', 'summer');
    expect(albums.albums.some((a) => a.title === 'Summer Vibes')).toBe(true);

    const songs = globalSearch('viewer', 'midnight');
    expect(songs.songs.some((s) => s.title === 'Midnight Run')).toBe(true);
  });
});
