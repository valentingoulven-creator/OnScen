import { describe, expect, it } from 'vitest';
import { buildMapStoryEntries, buildViewableStories, filterMapStoryEntriesToFollowing } from './mapStoriesFeed';
import type { MapStoryEntry } from './mapStoriesFeed';
import type { Live, MapStory, NearbyPerson, User } from '../types';
import type { MusicReel } from '../content/reels';
import { buildActiveLiveByHost } from './mapLiveEndSync';

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

  it('includes live person with viewer count', () => {
    const entries = buildMapStoryEntries(
      [{ id: 'u3', username: 'Nova', isLive: true, liveId: 'live-1', liveViewersCount: 42 }],
      [],
      []
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].isLive).toBe(true);
    expect(entries[0].liveId).toBe('live-1');
    expect(entries[0].liveViewersCount).toBe(42);
  });

  it('ignores stale isLive on favorites when absent from activeLiveByHost', () => {
    const fav: User = {
      id: 'u4',
      username: 'Nova Sound',
      isGhostMode: false,
      isLive: true,
      liveId: 'stale-live',
      liveViewersCount: 9,
    };
    const storyWithImage: MapStory = {
      ...story,
      userId: 'u4',
      author: { id: 'u4', username: 'Nova Sound' },
      imageUrl: 'https://images.unsplash.com/photo-story.jpg',
    };
    const activeLiveByHost = buildActiveLiveByHost([
      {
        id: 'other-live',
        hostId: 'other-host',
        hostName: 'Other',
        title: 'Live',
        platform: 'youtube',
        playbackState: {
          platform: 'youtube',
          trackId: '',
          title: 'T',
          artist: 'A',
          isPlaying: true,
          progressMs: 0,
          updatedAt: Date.now(),
        },
        latitude: 48.85,
        longitude: 2.35,
        viewersCount: 1,
        isActive: true,
        cameraActive: true,
      } as Live,
    ]);
    const entries = buildMapStoryEntries([], [fav], [], {
      ephemeralStories: [storyWithImage],
      activeLiveByHost,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].hasActiveStory).toBe(true);
    expect(entries[0].isLive).toBeUndefined();
    expect(entries[0].liveId).toBeUndefined();
  });

  it('keeps isLive when host is in activeLiveByHost', () => {
    const activeLiveByHost = buildActiveLiveByHost([
      {
        id: 'live-1',
        hostId: 'u3',
        hostName: 'Nova',
        title: 'Live',
        platform: 'youtube',
        playbackState: {
          platform: 'youtube',
          trackId: '',
          title: 'T',
          artist: 'A',
          isPlaying: true,
          progressMs: 0,
          updatedAt: Date.now(),
        },
        latitude: 48.85,
        longitude: 2.35,
        viewersCount: 42,
        isActive: true,
        cameraActive: true,
      } as Live,
    ]);
    const entries = buildMapStoryEntries(
      [{ id: 'u3', username: 'Nova', isLive: true, liveId: 'stale-live' }],
      [],
      [],
      { activeLiveByHost }
    );
    expect(entries[0]?.isLive).toBe(true);
    expect(entries[0]?.liveId).toBe('live-1');
  });

  it('includes followed host with active salon only', () => {
    const entries = buildMapStoryEntries(
      [
        {
          id: 'host-salon',
          username: 'PopSete',
          salonId: 'salon-1',
          salonTitle: 'Pop Party',
        },
      ],
      [],
      []
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].salonId).toBe('salon-1');
  });
});

describe('filterMapStoryEntriesToFollowing', () => {
  it('keeps only followed users with ring content', () => {
    const entries: MapStoryEntry[] = [
      { userId: 'followed', username: 'A', isFavorite: false, isLive: true, liveId: 'l1' },
      { userId: 'stranger', username: 'B', isFavorite: false, hasActiveStory: true, storyId: 's1' },
      { userId: 'followed', username: 'A', isFavorite: false, reelId: 'r1' },
    ];
    const filtered = filterMapStoryEntriesToFollowing(entries, new Set(['followed']), 'me');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.userId === 'followed')).toBe(true);
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
