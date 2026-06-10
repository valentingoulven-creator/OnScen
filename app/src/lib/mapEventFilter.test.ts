import { describe, expect, it } from 'vitest';
import {
  applyEventFilterDraftDefaults,
  createDefaultEventFilter,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  EMPTY_EVENT_FILTER,
  filterMapEventsByCriteria,
  getTodayDateInputValue,
  hasActiveEventFilterCriteria,
  isEventDateInRange,
  resolveDefaultUserCityLabel,
} from './mapEventFilter';
import type { MapEventMarker } from '../types';

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

describe('createDefaultEventFilter', () => {
  it('sets dateFrom to today and profile city as location', () => {
    const criteria = createDefaultEventFilter('Montpellier');
    expect(criteria.dateFrom).toBe(getTodayDateInputValue());
    expect(criteria.dateTo).toBe('');
    expect(criteria.location).toBe('Montpellier, France');
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
  it('detects active date or location', () => {
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
  });
});
