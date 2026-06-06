import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyFavoritesFirst,
  filterLivesForMap,
  getNearbyPanelPreferences,
  isNearbyDistanceFilterActive,
  setNearbyPanelPreferences,
  sortNearbyPeople,
} from './nearbyPanelSettings';
import type { Live, NearbyPerson } from '../types';

function mockLocalStorage() {
  const store = new Map<string, string>();
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
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return store;
}

function person(id: string, distanceKm: number): NearbyPerson {
  return {
    id,
    username: id,
    distanceKm,
  };
}

describe('nearbyPanelSettings favorites', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage();
  });

  it('favoritesFirst est toujours true par défaut', () => {
    expect(getNearbyPanelPreferences().favoritesFirst).toBe(true);
  });

  it('isNearbyDistanceFilterActive suit sortBy', () => {
    setNearbyPanelPreferences({ sortBy: 'distance' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(true);
    setNearbyPanelPreferences({ sortBy: 'audience' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(false);
    setNearbyPanelPreferences({ sortBy: 'none' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(false);
  });

  it('persiste sortBy none', () => {
    setNearbyPanelPreferences({ sortBy: 'none' });
    expect(getNearbyPanelPreferences().sortBy).toBe('none');
  });

  it('sortNearbyPeople avec sortBy none ne trie que par favoris', () => {
    const people = [person('far', 10), person('fav', 5), person('near', 1)];
    const sorted = sortNearbyPeople(people, 'none', [], {
      favoriteIds: new Set(['fav']),
      favoritesFirst: true,
    });
    expect(sorted.map((p) => p.id)).toEqual(['fav', 'far', 'near']);
  });

  it('persiste musicalAffinitiesOnly', () => {
    setNearbyPanelPreferences({ musicalAffinitiesOnly: true });
    expect(getNearbyPanelPreferences().musicalAffinitiesOnly).toBe(true);
  });

  it('applyFavoritesFirst place les favoris en tête', () => {
    const items = ['a', 'b', 'c', 'd'];
    const fav = new Set(['b', 'd']);
    expect(applyFavoritesFirst(items, (x) => x, fav, true)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sortNearbyPeople respecte favoritesFirst après tri distance', () => {
    const people = [person('far', 10), person('fav', 5), person('near', 1)];
    const sorted = sortNearbyPeople(people, 'distance', [], {
      favoriteIds: new Set(['fav']),
      favoritesFirst: true,
    });
    expect(sorted.map((p) => p.id)).toEqual(['fav', 'near', 'far']);
  });

  it('filterLivesForMap filtre par proximité seulement si tri distance', () => {
    const lives: Pick<Live, 'hostId' | 'platform'>[] = [
      { hostId: 'h1', platform: 'spotify' },
      { hostId: 'h2', platform: 'youtube' },
    ];
    const people: NearbyPerson[] = [
      { id: 'h1', username: 'host1', distanceKm: 1 },
    ];
    const mapPrefs = { platformFilter: 'all' as const, livesOnly: false, sortBy: 'none' as const };

    expect(filterLivesForMap(lives, people, mapPrefs)).toHaveLength(2);

    const filtered = filterLivesForMap(lives, people, { ...mapPrefs, sortBy: 'distance' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].hostId).toBe('h1');
  });
});
