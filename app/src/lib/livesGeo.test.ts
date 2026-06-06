import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getLivesGeo,
  isFixedMapGeoSource,
  setLivesGeo,
  type LivesGeoPrefs,
} from './livesGeo';

const STORAGE_KEY = 'melosong_lives_geo';

function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
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
  };
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  return store;
}

describe('livesGeo', () => {
  it('isFixedMapGeoSource couvre ville et adresse', () => {
    expect(isFixedMapGeoSource('city')).toBe(true);
    expect(isFixedMapGeoSource('address')).toBe(true);
    expect(isFixedMapGeoSource('my_position')).toBe(false);
  });

  describe('persistance localStorage', () => {
    beforeEach(() => {
      mockLocalStorage();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('persiste source address et addressLine', () => {
      const prefs: LivesGeoPrefs = {
        latitude: 43.61,
        longitude: 3.87,
        radiusKm: 15,
        label: '12 Rue Example, Montpellier',
        source: 'address',
        addressLine: '12 Rue Example, 34000 Montpellier',
      };
      setLivesGeo(prefs);
      const loaded = getLivesGeo();
      expect(loaded.source).toBe('address');
      expect(loaded.addressLine).toBe(prefs.addressLine);
      expect(loaded.latitude).toBeCloseTo(43.61);
      expect(STORAGE_KEY).toBe('melosong_lives_geo');
    });
  });
});
