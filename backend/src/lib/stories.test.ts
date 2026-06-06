import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import { createStory, getMyActiveStory, listStoriesForViewer, purgeExpiredStories } from './stories';

function seedUser(id: string, lat: number, lon: number) {
  db.users.set(id, {
    id,
    username: id,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    latitude: lat,
    longitude: lon,
    blurredLatitude: lat,
    blurredLongitude: lon,
    lastSeenAt: Date.now(),
  });
}

describe('stories', () => {
  beforeEach(() => {
    db.users.clear();
    db.stories.length = 0;
    seedUser('me', 48.85, 2.35);
    seedUser('near', 48.86, 2.36);
    seedUser('far', 43.0, 8.0);
  });

  it('creates a story expiring in 24h', () => {
    const r = createStory('me', { content: 'Hello' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.expiresAt - r.story.createdAt).toBe(24 * 60 * 60 * 1000);
    expect(getMyActiveStory('me')?.content).toBe('Hello');
  });

  it('replaces previous active story for same user', () => {
    createStory('me', { content: 'A' });
    createStory('me', { content: 'B' });
    expect(getMyActiveStory('me')?.content).toBe('B');
    expect(db.stories.filter((s) => s.userId === 'me')).toHaveLength(1);
  });

  it('filters nearby stories by radius', () => {
    createStory('near', { content: 'proche' });
    createStory('far', { content: 'loin' });
    const list = listStoriesForViewer('me', {
      latitude: 48.85,
      longitude: 2.35,
      radiusKm: 50,
    });
    const ids = list.map((s) => s.userId);
    expect(ids).toContain('near');
    expect(ids).not.toContain('far');
  });

  it('purges expired stories', () => {
    createStory('me', { content: 'old' });
    db.stories[0].expiresAt = Date.now() - 1;
    purgeExpiredStories();
    expect(getMyActiveStory('me')).toBeNull();
  });

  it('stores music track and tagged users', () => {
    const r = createStory('me', {
      content: 'avec musique',
      musicTrack: { title: 'Song', artist: 'Artist', videoId: 'dQw4w9WgXcQ' },
      taggedUserIds: ['near', 'me', 'unknown'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.musicTrack?.title).toBe('Song');
    expect(r.story.musicTrack?.videoId).toBe('dQw4w9WgXcQ');
    expect(r.story.taggedUsers?.map((u) => u.id)).toEqual(['near']);
  });
});
