import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  api: { getFeedPosts: vi.fn() },
}));

import {
  applyEventFilterDraftDefaults,
  applyMapEventDayPinFilterForMap,
  buildMapEventsBaseForPins,
  createDefaultEventFilter,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  EMPTY_EVENT_FILTER,
  filterFeedPostsByEventCriteria,
  filterMapEventsByCriteria,
  filterMapEventsOnCalendarDay,
  filterMapEventsOnCalendarDays,
  filterMapEventPinsForView,
  getBrowseSheetCalendarDayKeys,
  getTodayDateInputValue,
  hasActiveEventFilterCriteria,
  isEventDateInRange,
  resolveDefaultEventFilterLocation,
  resolveDefaultUserCityLabel,
} from './mapEventFilter';
import { mergeMapEventMarkers, mergeMapEventsWithSponso } from './mapFeedEvents';
import type { FeedPost, MapEventMarker } from '../types';

function mockLocalStorage(store = new Map<string, string>()) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
}

beforeEach(() => {
  mockLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function post(
  partial: Partial<FeedPost> & Pick<FeedPost, 'id' | 'author'>
): FeedPost {
  return {
    userId: partial.author.id,
    content: 'Jam',
    createdAt: 0,
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
    isEvent: true,
    eventDate: '2026-06-15T20:00:00.000Z',
    eventLocation: 'Paris',
    ...partial,
  };
}

function marker(
  partial: Partial<MapEventMarker> & Pick<MapEventMarker, 'id' | 'latitude' | 'longitude'>
): MapEventMarker {
  return {
    title: 'Test',
    eventDate: '2026-06-15T20:00:00.000Z',
    eventLocation: 'Paris',
    authorId: 'u1',
    authorUsername: 'user',
    ...partial,
  };
}

describe('isEventDateInRange', () => {
  it('accepts event inside inclusive date range', () => {
    expect(isEventDateInRange('2026-06-15T20:00:00.000Z', '2026-06-10', '2026-06-20')).toBe(true);
  });

  it('rejects event before dateFrom', () => {
    expect(isEventDateInRange('2026-06-09T20:00:00.000Z', '2026-06-10', '')).toBe(false);
  });

  it('rejects event after dateTo', () => {
    expect(isEventDateInRange('2026-06-21T08:00:00.000Z', '', '2026-06-20')).toBe(false);
  });
});

describe('filterMapEventsByCriteria', () => {
  const paris = marker({ id: 'p', latitude: 48.8566, longitude: 2.3522 });
  const lyon = marker({
    id: 'l',
    latitude: 45.764,
    longitude: 4.8357,
    eventDate: '2026-06-16T20:00:00.000Z',
  });

  it('filters by dateFrom only (no dateTo)', () => {
    const filtered = filterMapEventsByCriteria([paris, lyon], {
      ...EMPTY_EVENT_FILTER,
      dateFrom: '2026-06-16',
    });
    expect(filtered.map((e) => e.id)).toEqual(['l']);
  });

  it('filters by date range only', () => {
    const filtered = filterMapEventsByCriteria([paris, lyon], {
      ...EMPTY_EVENT_FILTER,
      dateFrom: '2026-06-16',
      dateTo: '2026-06-20',
    });
    expect(filtered.map((e) => e.id)).toEqual(['l']);
  });

  it('filters by location radius', () => {
    const filtered = filterMapEventsByCriteria([paris, lyon], {
      ...EMPTY_EVENT_FILTER,
      location: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      radiusKm: 50,
    });
    expect(filtered.map((e) => e.id)).toEqual(['p']);
  });

  it('keeps viewer own events outside radius', () => {
    const leCres = marker({
      id: 'mine',
      latitude: 43.6489,
      longitude: 3.9394,
      authorId: 'viewer-1',
      eventLocation: 'Le Crès',
    });
    const filtered = filterMapEventsByCriteria([paris, leCres], {
      ...EMPTY_EVENT_FILTER,
      location: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      radiusKm: 30,
    }, { viewerId: 'viewer-1' });
    expect(filtered.map((e) => e.id)).toEqual(['p', 'mine']);
  });

  it('filters by event type', () => {
    const dance = marker({ id: 'd', latitude: 48.8566, longitude: 2.3522, eventType: 'dance' });
    const chant = marker({ id: 'c', latitude: 48.8566, longitude: 2.3522, eventType: 'chant' });
    const other = marker({ id: 'o', latitude: 48.8566, longitude: 2.3522, eventType: 'autre' });
    const noType = marker({ id: 'n', latitude: 48.8566, longitude: 2.3522 });

    expect(
      filterMapEventsByCriteria([dance, chant, other], {
        ...EMPTY_EVENT_FILTER,
        eventType: 'dance',
      }).map((e) => e.id)
    ).toEqual(['d']);

    expect(
      filterMapEventsByCriteria([dance, chant, noType], {
        ...EMPTY_EVENT_FILTER,
        eventType: 'autre',
      }).map((e) => e.id)
    ).toEqual(['n']);
  });

  it('returns all events when criteria empty', () => {
    expect(filterMapEventsByCriteria([paris, lyon], EMPTY_EVENT_FILTER)).toHaveLength(2);
  });
});

describe('resolveDefaultUserCityLabel', () => {
  it('normalizes profile city with country suffix', () => {
    expect(resolveDefaultUserCityLabel('Montpellier')).toBe('Montpellier, France');
    expect(resolveDefaultUserCityLabel('Lyon, France')).toBe('Lyon, France');
  });
});

describe('resolveDefaultEventFilterLocation', () => {
  it('prefers active geolocation over profile city', () => {
    mockLocalStorage(
      new Map([
        [
          'melosong_lives_geo',
          JSON.stringify({
            latitude: 43.6108,
            longitude: 3.8767,
            label: 'Ma position',
            source: 'my_position',
          }),
        ],
      ])
    );
    const result = resolveDefaultEventFilterLocation('Paris');
    expect(result.location).toBe('Montpellier, France');
    expect(result.latitude).toBeCloseTo(43.6108, 3);
    expect(result.longitude).toBeCloseTo(3.8767, 3);
  });
});

describe('createDefaultEventFilter', () => {
  it('sets dateFrom to today and profile city as location', () => {
    const criteria = createDefaultEventFilter('Montpellier');
    expect(criteria.dateFrom).toBe(getTodayDateInputValue());
    expect(criteria.dateTo).toBe('');
    expect(criteria.location).toBe('Montpellier, France');
    expect(criteria.eventType).toBe('all');
  });
});

describe('applyEventFilterDraftDefaults', () => {
  it('fills empty dateFrom and location from profile city', () => {
    const result = applyEventFilterDraftDefaults(EMPTY_EVENT_FILTER, 'Paris');
    expect(result.dateFrom).toBe(getTodayDateInputValue());
    expect(result.location).toBe('Paris, France');
    expect(result.radiusKm).toBe(DEFAULT_EVENT_FILTER_RADIUS_KM);
  });

  it('keeps explicit draft values', () => {
    const result = applyEventFilterDraftDefaults(
      {
        ...EMPTY_EVENT_FILTER,
        dateFrom: '2026-07-01',
        location: 'Lyon, France',
      },
      'Paris'
    );
    expect(result.dateFrom).toBe('2026-07-01');
    expect(result.location).toBe('Lyon, France');
  });
});

describe('hasActiveEventFilterCriteria', () => {
  it('detects active date, location or event type', () => {
    expect(hasActiveEventFilterCriteria(EMPTY_EVENT_FILTER)).toBe(false);
    expect(
      hasActiveEventFilterCriteria({ ...EMPTY_EVENT_FILTER, dateFrom: '2026-06-01' })
    ).toBe(true);
    expect(
      hasActiveEventFilterCriteria({
        ...EMPTY_EVENT_FILTER,
        location: 'Lyon',
        radiusKm: DEFAULT_EVENT_FILTER_RADIUS_KM,
      })
    ).toBe(true);
    expect(
      hasActiveEventFilterCriteria({ ...EMPTY_EVENT_FILTER, eventType: 'dance' })
    ).toBe(true);
  });
});

describe('filterFeedPostsByEventCriteria', () => {
  const parisPost = post({
    id: 'p',
    author: { id: 'u1', username: 'paris' },
    eventDate: '2026-06-15T20:00:00.000Z',
    eventLocation: 'Paris',
  });
  const lyonPost = post({
    id: 'l',
    author: { id: 'u2', username: 'lyon' },
    eventDate: '2026-06-16T20:00:00.000Z',
    eventLocation: 'Lyon',
  });

  it('filters feed posts by dateFrom like map markers', () => {
    const filtered = filterFeedPostsByEventCriteria([parisPost, lyonPost], {
      ...EMPTY_EVENT_FILTER,
      dateFrom: '2026-06-16',
    });
    expect(filtered.map((p) => p.id)).toEqual(['l']);
  });
});

describe('getBrowseSheetCalendarDayKeys', () => {
  const fixedNow = new Date('2026-07-16T10:00:00');

  it('returns 3 days from today when filter is off', () => {
    expect(
      getBrowseSheetCalendarDayKeys(undefined, false, fixedNow)
    ).toEqual(['2026-07-16', '2026-07-17', '2026-07-18']);
  });

  it('returns only dateFrom when range is within 3 days', () => {
    expect(
      getBrowseSheetCalendarDayKeys(
        { ...EMPTY_EVENT_FILTER, dateFrom: '2026-07-16', dateTo: '2026-07-17' },
        true,
        fixedNow
      )
    ).toEqual(['2026-07-16', '2026-07-17']);
  });

  it('expands beyond 4 days when filter range is longer', () => {
    expect(
      getBrowseSheetCalendarDayKeys(
        { ...EMPTY_EVENT_FILTER, dateFrom: '2026-07-16', dateTo: '2026-07-22' },
        true,
        fixedNow
      )
    ).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
    ]);
  });
});

describe('filterMapEventsOnCalendarDay', () => {
  it('keeps only events with an occurrence on the given day', () => {
    const events = [
      marker({ id: 'a', latitude: 48.8, longitude: 2.3, eventDate: '2026-07-20T18:00:00.000Z' }),
      marker({ id: 'b', latitude: 48.9, longitude: 2.4, eventDate: '2026-07-21T18:00:00.000Z' }),
    ];
    expect(filterMapEventsOnCalendarDay(events, '2026-07-20').map((e) => e.id)).toEqual(['a']);
  });
});

describe('filterMapEventsOnCalendarDays', () => {
  it('keeps events occurring on any allowed day', () => {
    const events = [
      marker({ id: 'a', latitude: 48.8, longitude: 2.3, eventDate: '2026-07-22T18:00:00.000Z' }),
      marker({ id: 'b', latitude: 48.9, longitude: 2.4, eventDate: '2026-07-25T18:00:00.000Z' }),
      marker({ id: 'c', latitude: 49, longitude: 2.5, eventDate: '2026-08-01T18:00:00.000Z' }),
    ];
    expect(
      filterMapEventsOnCalendarDays(events, ['2026-07-22', '2026-07-23', '2026-07-24']).map(
        (e) => e.id
      )
    ).toEqual(['a']);
  });
});

describe('filterMapEventPinsForView', () => {
  const merge = (regular: MapEventMarker[], sponsored: MapEventMarker[]) => [
    ...sponsored,
    ...regular,
  ];

  function isoOnDayOffset(offsetDays: number, hour = 18): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  }

  const events = [
    marker({
      id: 'regular-tomorrow',
      latitude: 48.8,
      longitude: 2.3,
      eventDate: isoOnDayOffset(1),
    }),
    marker({
      id: 'sponso-tomorrow',
      latitude: 43.6405,
      longitude: 3.9395,
      eventDate: isoOnDayOffset(1),
      isSponsored: true,
    }),
  ];

  it('keeps sponsored pins on future days while regular pins stay today-only', () => {
    const result = filterMapEventPinsForView(events, {
      eventsFilterOn: false,
      globeOverview: false,
      merge,
    });
    expect(result.map((e) => e.id)).toEqual(['sponso-tomorrow']);
  });

  it('keeps sponsored pins in globe overview when regular uses today-or-tomorrow', () => {
    const todayRegular = marker({
      id: 'regular-today',
      latitude: 48.8,
      longitude: 2.3,
      eventDate: isoOnDayOffset(0),
    });
    const pool = [todayRegular, ...events];
    const result = filterMapEventPinsForView(pool, {
      eventsFilterOn: false,
      globeOverview: true,
      merge,
    });
    expect(result.map((e) => e.id)).toEqual([
      'sponso-tomorrow',
      'regular-today',
      'regular-tomorrow',
    ]);
  });

  it('keeps sponsored pins when events filter criteria exclude them from the pool', () => {
    const sponso = marker({
      id: 'sponso-solar',
      latitude: 43.6405,
      longitude: 3.9395,
      eventDate: isoOnDayOffset(30),
      isSponsored: true,
    });
    const regularParis = marker({
      id: 'regular-paris',
      latitude: 48.8,
      longitude: 2.3,
      eventDate: isoOnDayOffset(0),
    });
    const all = [regularParis, sponso];
    const result = filterMapEventPinsForView(all, {
      eventsFilterOn: true,
      globeOverview: false,
      filteredWhenCriteria: [regularParis],
      merge,
    });
    expect(result.map((e) => e.id)).toEqual(['sponso-solar', 'regular-paris']);
  });

  it('uses full event pool when filter is on but no custom criteria pool', () => {
    const tokyo = marker({
      id: 'world-tokyo',
      latitude: 35.6762,
      longitude: 139.6503,
      eventDate: '2026-08-01T18:00:00.000Z',
    });
    const paris = marker({
      id: 'regular-paris',
      latitude: 48.8,
      longitude: 2.3,
      eventDate: '2026-07-22T18:00:00.000Z',
    });
    const all = [paris, tokyo];
    const result = filterMapEventPinsForView(all, {
      eventsFilterOn: true,
      globeOverview: false,
      filteredWhenCriteria: undefined,
      merge,
    });
    expect(result.map((e) => e.id)).toEqual(['regular-paris', 'world-tokyo']);
  });
});

describe('buildMapEventsBaseForPins', () => {
  const fixedNow = new Date('2026-07-22T12:00:00.000Z');
  const merge = mergeMapEventMarkers;

  const solarFeed: MapEventMarker = {
    id: 'prod-sponso-evt-solar-festival-2026',
    latitude: 43.6405,
    longitude: 3.9395,
    title: 'Solar Festival',
    eventDate: '2026-07-22T18:00:00.000Z',
    eventLocation: 'Solar Festival, Le Crès, France',
    authorId: 'author-solar',
  };

  function includingSponso(markers: MapEventMarker[] = [solarFeed]) {
    return mergeMapEventsWithSponso(markers, [], new Set([solarFeed.id]));
  }

  it('shows tagged sponso pins without any map filter when user is not following', () => {
    const pins = buildMapEventsBaseForPins({
      anyMapFilterActive: false,
      eventsFilterOn: false,
      followingMapAmbientOn: false,
      mapEventsIncludingSponso: includingSponso(),
      followingIds: new Set(),
      savedEventPostIds: new Set(),
      favoriteIds: new Set(),
      eventsFilterCustomized: false,
      filteredMapEvents: [],
      globeOverview: false,
      merge,
      now: fixedNow,
    });

    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({
      id: solarFeed.id,
      isSponsored: true,
    });
  });

  it('tags sponso in following ambient mode instead of using raw feed markers', () => {
    const pins = buildMapEventsBaseForPins({
      anyMapFilterActive: false,
      eventsFilterOn: false,
      followingMapAmbientOn: true,
      mapEventsIncludingSponso: includingSponso(),
      followingIds: new Set(['author-solar']),
      savedEventPostIds: new Set(),
      favoriteIds: new Set(),
      eventsFilterCustomized: false,
      filteredMapEvents: [],
      globeOverview: false,
      merge,
      now: fixedNow,
    });

    expect(pins.find((pin) => pin.id === solarFeed.id)?.isSponsored).toBe(true);
  });
});

describe('applyMapEventDayPinFilterForMap', () => {
  it('keeps sponso pins when day pin filter targets another day', () => {
    const today = new Date();
    today.setHours(18, 0, 0, 0);
    const todayIso = today.toISOString();
    const todayKey = today.toLocaleDateString('en-CA');
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    future.setHours(18, 0, 0, 0);

    const sponso = marker({
      id: 'sponso-future',
      latitude: 43.6405,
      longitude: 3.9395,
      eventDate: future.toISOString(),
      isSponsored: true,
    });
    const regular = marker({
      id: 'regular-today',
      latitude: 48.8,
      longitude: 2.3,
      eventDate: todayIso,
    });

    const result = applyMapEventDayPinFilterForMap([sponso, regular], todayKey);

    expect(result.map((event) => event.id)).toEqual(['sponso-future', 'regular-today']);
  });
});
