import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  getLivesGeo,
  isFixedMapGeoSource,
  setLivesGeo,
  findNearestMajorCities,
  haversineKm,
  presetCityMainLabel,
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

  describe('defaults et persistance localStorage', () => {
    beforeEach(() => {
      mockLocalStorage();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sans prefs sauvegardées, source par défaut = my_position', () => {
      const geo = getLivesGeo();
      expect(geo.source).toBe('my_position');
      expect(geo.label).toBe('Ma position');
    });

    it('respecte les prefs existantes en localStorage', () => {
      const stored: LivesGeoPrefs = {
        latitude: 48.8566,
        longitude: 2.3522,
        radiusKm: 30,
        label: 'Paris, France',
        source: 'city',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      const loaded = getLivesGeo();
      expect(loaded.source).toBe('city');
      expect(loaded.label).toBe('Paris, France');
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

  describe('findNearestMajorCities', () => {
    it('retourne Montpellier en tête près de Béziers', () => {
      const nearest = findNearestMajorCities(43.3411, 3.214, 3);
      expect(nearest.length).toBe(3);
      expect(presetCityMainLabel(nearest[0]!)).toBe('Montpellier');
    });

    it('trie par distance croissante', () => {
      const nearest = findNearestMajorCities(48.8566, 2.3522, 3);
      expect(presetCityMainLabel(nearest[0]!)).toBe('Paris');
      expect(nearest[0]!.distanceKm).toBeLessThan(5);
      for (let i = 1; i < nearest.length; i++) {
        expect(nearest[i]!.distanceKm).toBeGreaterThanOrEqual(nearest[i - 1]!.distanceKm);
      }
    });

    it('haversineKm calcule une distance plausible Paris–Lyon', () => {
      const d = haversineKm(48.8566, 2.3522, 45.764, 4.8357);
      expect(d).toBeGreaterThan(350);
      expect(d).toBeLessThan(450);
    });
  });
});
