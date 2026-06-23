import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyFavoritesFirst,
  filterLivesForMap,
  getNearbyPanelPreferences,
  isNearbyDistanceFilterActive,
  resolveNearbyDistanceFilterForMap,
  peopleMarkersOnMap,
  personHasMapActivity,
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

  it('defaults sans localStorage : tri distance, rayon 20 km', () => {
    const prefs = getNearbyPanelPreferences();
    expect(prefs.sortBy).toBe('distance');
    expect(prefs.radiusKm).toBe(20);
  });

  it('respecte les prefs existantes en localStorage', () => {
    localStorage.setItem(
      'melosong_nearby_panel_prefs',
      JSON.stringify({ sortBy: 'audience', musicalAffinitiesOnly: true })
    );
    localStorage.setItem('melosong_nearby_radius_km', '45');
    const prefs = getNearbyPanelPreferences();
    expect(prefs.sortBy).toBe('audience');
    expect(prefs.musicalAffinitiesOnly).toBe(true);
    expect(prefs.radiusKm).toBe(45);
  });

  it('isNearbyDistanceFilterActive suit sortBy', () => {
    setNearbyPanelPreferences({ sortBy: 'distance' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(true);
    setNearbyPanelPreferences({ sortBy: 'audience' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(false);
    setNearbyPanelPreferences({ sortBy: 'none' });
    expect(isNearbyDistanceFilterActive(getNearbyPanelPreferences())).toBe(false);
  });

  it('resolveNearbyDistanceFilterForMap désactive le rayon en mode Salon', () => {
    setNearbyPanelPreferences({ sortBy: 'distance' });
    const prefs = getNearbyPanelPreferences();
    expect(resolveNearbyDistanceFilterForMap(prefs, true)).toBe(false);
    expect(resolveNearbyDistanceFilterForMap(prefs, false)).toBe(true);
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
      { hostId: 'h1', platform: 'youtube' },
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

  it('personHasMapActivity : live, salon ou auteur événement', () => {
    const idle: NearbyPerson = { id: 'idle', username: 'idle', latitude: 48.8, longitude: 2.3 };
    const live: NearbyPerson = { ...idle, id: 'live', isLive: true };
    const salonHost: NearbyPerson = { ...idle, id: 'host', salonId: 's1' };
    const eventAuthor: NearbyPerson = { ...idle, id: 'author' };
    const eventAuthors = new Set(['author']);

    expect(personHasMapActivity(idle)).toBe(false);
    expect(personHasMapActivity(live)).toBe(true);
    expect(personHasMapActivity(salonHost)).toBe(true);
    expect(personHasMapActivity(eventAuthor, eventAuthors)).toBe(true);
    expect(personHasMapActivity(eventAuthor)).toBe(false);
  });

  it('peopleMarkersOnMap masque les utilisateurs sans activité', () => {
    const people: NearbyPerson[] = [
      { id: 'idle', username: 'idle', latitude: 48.8, longitude: 2.3 },
      { id: 'live', username: 'live', latitude: 48.81, longitude: 2.31, isLive: true },
      { id: 'no-coords', username: 'ghost', isLive: true },
    ];
    expect(peopleMarkersOnMap(people).map((p) => p.id)).toEqual(['live']);
  });
});
