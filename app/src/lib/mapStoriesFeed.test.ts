import { describe, expect, it } from 'vitest';
import { buildMapStoryEntries, buildViewableStories } from './mapStoriesFeed';
import type { MapStoryEntry } from './mapStoriesFeed';
import type { MapStory, NearbyPerson, User } from '../types';
import type { MusicReel } from '../content/reels';

const person: NearbyPerson = { id: 'u1', username: 'Alice' };

const reel: MusicReel = {
  id: 'r1',
  authorId: 'u1',
  title: 'T',
  artist: 'A',
  genre: 'pop',
  mediaType: 'image',
  posterUrl: 'https://example.com/p.jpg',
};

const story: MapStory = {
  id: 's1',
  userId: 'u2',
  content: 'Salut',
  createdAt: Date.now(),
  expiresAt: Date.now() + 86_400_000,
  author: { id: 'u2', username: 'Bob' },
};

describe('buildMapStoryEntries', () => {
  it('includes nearby users with active ephemeral story only', () => {
    const entries = buildMapStoryEntries(
      [{ id: 'u2', username: 'Bob' }],
      [],
      [],
      { ephemeralStories: [story] }
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].storyId).toBe('s1');
    expect(entries[0].hasActiveStory).toBe(true);
  });

  it('merges reel and story on same user', () => {
    const entries = buildMapStoryEntries([person], [], [reel], {
      ephemeralStories: [
        { ...story, userId: 'u1', author: { id: 'u1', username: 'Alice' } },
      ],
    });
    expect(entries[0].reelId).toBe('r1');
    expect(entries[0].storyId).toBeDefined();
  });

  it('adds story-only users not in nearby list', () => {
    const entries = buildMapStoryEntries([], [] as User[], [], {
      ephemeralStories: [story],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].username).toBe('Bob');
  });
});

describe('buildViewableStories', () => {
  const myStory: MapStory = {
    id: 'mine',
    userId: 'me',
    content: 'Ma story',
    createdAt: Date.now(),
    expiresAt: Date.now() + 86_400_000,
    author: { id: 'me', username: 'Moi' },
  };

  it('orders my story first then entry stories', () => {
    const entries: MapStoryEntry[] = [
      {
        userId: 'u2',
        username: 'Bob',
        storyId: 's1',
        hasActiveStory: true,
        isFavorite: false,
      },
    ];
    const byUser = new Map([['u2', [story]]]);
    const list = buildViewableStories(entries, byUser, [myStory]);
    expect(list.map((s) => s.id)).toEqual(['mine', 's1']);
  });

  it('includes all segments in user stack', () => {
    const s2: MapStory = { ...story, id: 's2', createdAt: story.createdAt + 1000 };
    const entries: MapStoryEntry[] = [
      {
        userId: 'u2',
        username: 'Bob',
        storyId: 's2',
        hasActiveStory: true,
        storyCount: 2,
        isFavorite: false,
      },
    ];
    const byUser = new Map([['u2', [story, s2]]]);
    const list = buildViewableStories(entries, byUser, null);
    expect(list.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('skips entries without active story', () => {
    const entries: MapStoryEntry[] = [
      { userId: 'u1', username: 'Alice', reelId: 'r1', isFavorite: false },
    ];
    expect(buildViewableStories(entries, new Map(), null)).toEqual([]);
  });
});
