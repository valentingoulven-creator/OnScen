import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import { createStory, deleteStory, getMyActiveStory, getUserActiveStories, listStoriesForViewer, MAX_ACTIVE_STORIES_PER_USER, purgeExpiredStories } from './stories';

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
    db.userFavorites.clear();
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

  it('allows multiple active stories for same user', () => {
    createStory('me', { content: 'A' });
    createStory('me', { content: 'B' });
    expect(getMyActiveStory('me')?.content).toBe('B');
    expect(getUserActiveStories('me')).toHaveLength(2);
    expect(getUserActiveStories('me').map((s) => s.content)).toEqual(['A', 'B']);
    expect(db.stories.filter((s) => s.userId === 'me')).toHaveLength(2);
  });

  it('rejects when max active stories reached', () => {
    for (let i = 0; i < MAX_ACTIVE_STORIES_PER_USER; i++) {
      const r = createStory('me', { content: `S${i}` });
      expect(r.ok).toBe(true);
    }
    const overflow = createStory('me', { content: 'too many' });
    expect(overflow.ok).toBe(false);
  });

  it('filters nearby stories by radius', () => {
    createStory('near', { content: 'proche', visibility: 'public' });
    createStory('far', { content: 'loin', visibility: 'public' });
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

  it('allows a story with image only (no text)', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = createStory('me', { imageUrl: dataUrl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.imageUrl).toBe(dataUrl);
    expect(r.story.content).toBeUndefined();
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

  it('stores a clickable link with position and label', () => {
    const r = createStory('me', {
      imageUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      link: {
        url: 'https://example.com/page',
        label: 'Voir plus',
        x: 0.42,
        y: 0.66,
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.link?.url).toBe('https://example.com/page');
    expect(r.story.link?.label).toBe('Voir plus');
    expect(r.story.link?.x).toBe(0.42);
    expect(r.story.link?.y).toBe(0.66);
  });

  it('rejects invalid story links', () => {
    const r = createStory('me', {
      content: 'bad link',
      link: { url: 'javascript:alert(1)', x: 0.5, y: 0.5 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.link).toBeUndefined();
  });

  it('deletes own active story', () => {
    const r = createStory('me', { content: 'bye' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(deleteStory(r.story.id, 'me')).toBe(true);
    expect(getUserActiveStories('me')).toHaveLength(0);
    expect(deleteStory(r.story.id, 'me')).toBe(false);
    expect(deleteStory(r.story.id, 'near')).toBe(false);
  });

  it('followers visibility: only fans of the author can see', () => {
    seedUser('author', 48.85, 2.35);
    seedUser('fan', 48.86, 2.36);
    seedUser('stranger', 48.87, 2.37);
    db.userFavorites.set(
      'fan',
      new Map([
        [
          'author',
          { fanId: 'fan', hostId: 'author', notificationsEnabled: true, createdAt: Date.now() },
        ],
      ])
    );
    db.userFavorites.set(
      'author',
      new Map([
        [
          'stranger',
          { fanId: 'author', hostId: 'stranger', notificationsEnabled: true, createdAt: Date.now() },
        ],
      ])
    );
    createStory('author', { content: 'followers only', visibility: 'followers' });
    expect(listStoriesForViewer('fan').some((s) => s.userId === 'author')).toBe(true);
    expect(listStoriesForViewer('stranger').some((s) => s.userId === 'author')).toBe(false);
    expect(listStoriesForViewer('me').some((s) => s.userId === 'author')).toBe(false);
  });

  it('public visibility: any non-blocked viewer can see', () => {
    createStory('near', { content: 'hello public', visibility: 'public' });
    expect(listStoriesForViewer('me').some((s) => s.userId === 'near')).toBe(true);
    expect(listStoriesForViewer('far').some((s) => s.userId === 'near')).toBe(true);
  });

  it('allows a story with video data url and optional poster', () => {
    const videoUrl =
      'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const poster =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = createStory('me', { videoUrl, imageUrl: poster, videoDurationSec: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.story.videoUrl).toBe(videoUrl);
    expect(r.story.imageUrl).toBe(poster);
    expect(r.story.videoDurationSec).toBe(8);
  });
});
