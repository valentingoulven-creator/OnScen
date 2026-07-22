import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMapEventMarkersFromPosts,
  buildMapEventMarkersFromSponsoredPosts,
  filterPostsForMapEvents,
  filterPostsForMapSponsoredEvents,
  mergeMapEventMarkers,
} from './mapFeedEvents';
import * as mapEventCoords from './mapEventCoords';
import type { FeedPost } from '../types';

vi.mock('./api', () => ({
  api: { getFeedPosts: vi.fn() },
}));

vi.mock('./mapEventCoords', async (importOriginal) => {
  const actual = await importOriginal<typeof mapEventCoords>();
  return { ...actual, resolveEventCoords: vi.fn() };
});

const resolveEventCoords = vi.mocked(mapEventCoords.resolveEventCoords);

function post(partial: Partial<FeedPost> & Pick<FeedPost, 'id'>): FeedPost {
  return {
    userId: 'u1',
    content: 'Soirée DJ',
    createdAt: Date.now(),
    likeCount: 0,
    likedByMe: false,
    resharedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
    authorHasActiveStory: false,
    author: {
      id: 'u1',
      username: 'DJValou',
    },
    ...partial,
  };
}

afterEach(() => {
  resolveEventCoords.mockReset();
});

describe('filterPostsForMapEvents', () => {
  it('keeps user-created upcoming events with location', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const items = filterPostsForMapEvents([
      post({
        id: 'feed-user_listener-1',
        isEvent: true,
        eventDate: future,
        eventLocation: '2 Rue François Mitterrand, Le Crès',
      }),
      post({ id: 'plain', content: 'hello' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('feed-user_listener-1');
  });

  it('drops past events', () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const items = filterPostsForMapEvents([
      post({
        id: 'old',
        isEvent: true,
        eventDate: past,
        eventLocation: 'Paris',
      }),
    ]);
    expect(items).toHaveLength(0);
  });
});

describe('filterPostsForMapSponsoredEvents', () => {
  it('drops sponsored events entirely before today', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const items = filterPostsForMapSponsoredEvents([
      post({
        id: 'prod-sponso-evt-nuits-sonores-2026',
        isEvent: true,
        eventDate: past,
        eventLocation: 'Nuits Sonores, Lyon, France',
      }),
    ]);
    expect(items).toHaveLength(0);
  });

  it('keeps sponsored events dated today or later', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    const items = filterPostsForMapSponsoredEvents([
      post({
        id: 'prod-sponso-evt-solar-festival-2026',
        isEvent: true,
        eventDate: tomorrow.toISOString(),
        eventLocation: 'Solar Festival, Le Crès, France',
      }),
    ]);
    expect(items).toHaveLength(1);
  });
});

describe('mergeMapEventMarkers', () => {
  it('puts sponsored markers first and dedupes by id', () => {
    const merged = mergeMapEventMarkers(
      [
        { id: 'a', latitude: 1, longitude: 2, title: 'A' },
        { id: 'b', latitude: 3, longitude: 4, title: 'B' },
      ],
      [{ id: 'b', latitude: 5, longitude: 6, title: 'B sponso', isSponsored: true }]
    );
    expect(merged.map((m) => m.id)).toEqual(['b', 'a']);
    expect(merged[0]!.title).toBe('B sponso');
  });
});

describe('buildMapEventMarkersFromPosts', () => {
  it('builds markers when coords resolve', async () => {
    resolveEventCoords.mockResolvedValue({ latitude: 43.649, longitude: 3.939 });
    const future = new Date(Date.now() + 3_600_000).toISOString();

    const markers = await buildMapEventMarkersFromPosts([
      post({
        id: 'feed-user_listener-99',
        isEvent: true,
        eventDate: future,
        eventLocation: '2 Rue François Mitterrand, Le Crès',
        content: 'Set electro',
      }),
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'feed-user_listener-99',
      title: 'Set electro',
      eventLocation: '2 Rue François Mitterrand, Le Crès',
    });
    expect(markers[0]!.latitude).toBeCloseTo(43.649, 2);
    expect(markers[0]!.longitude).toBeCloseTo(3.939, 2);
  });

  it('builds two markers for duplicate known venues without network', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const location = 'Accor Arena, Paris, France';

    const markers = await buildMapEventMarkersFromPosts([
      post({ id: 'a', isEvent: true, eventDate: future, eventLocation: location }),
      post({ id: 'b', isEvent: true, eventDate: future, eventLocation: location }),
    ]);

    expect(markers).toHaveLength(2);
    expect(resolveEventCoords).not.toHaveBeenCalled();
  });

  it('calls onProgress with sync-resolved markers before async completes', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const progress: string[][] = [];

    await buildMapEventMarkersFromPosts(
      [
        post({
          id: 'paris-event',
          isEvent: true,
          eventDate: future,
          eventLocation: 'Accor Arena, Paris, France',
        }),
      ],
      {
        onProgress: (markers) => progress.push(markers.map((m) => m.id)),
      }
    );

    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(progress[0]).toEqual(['paris-event']);
    expect(resolveEventCoords).not.toHaveBeenCalled();
  });

  it('skips posts when geocoding fails', async () => {
    resolveEventCoords.mockResolvedValue(null);
    const future = new Date(Date.now() + 3_600_000).toISOString();

    const markers = await buildMapEventMarkersFromPosts([
      post({
        id: 'no-coords',
        isEvent: true,
        eventDate: future,
        eventLocation: 'Adresse inconnue',
      }),
    ]);

    expect(markers).toHaveLength(0);
  });
});

describe('buildMapEventMarkersFromSponsoredPosts', () => {
  it('builds markers for upcoming sponsored events with known venue', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const markers = await buildMapEventMarkersFromSponsoredPosts([
      post({
        id: 'prod-sponso-evt-solar-festival-2026',
        isEvent: true,
        eventDate: future,
        eventLocation: 'Solar Festival, Le Crès, France',
        content: 'Solar Festival',
      }),
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      id: 'prod-sponso-evt-solar-festival-2026',
      title: 'Solar Festival',
      isSponsored: true,
    });
    expect(resolveEventCoords).not.toHaveBeenCalled();
  });

  it('skips sponsored events entirely before today', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const markers = await buildMapEventMarkersFromSponsoredPosts([
      post({
        id: 'prod-sponso-evt-nuits-sonores-2026',
        isEvent: true,
        eventDate: past,
        eventLocation: 'Nuits Sonores, Lyon, France',
      }),
    ]);
    expect(markers).toHaveLength(0);
  });
});
