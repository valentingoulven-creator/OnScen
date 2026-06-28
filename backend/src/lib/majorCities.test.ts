import { describe, expect, it } from 'vitest';
import { findNearestMajorCities, resetMajorCitiesCacheForTests } from './majorCities';

describe('majorCities', () => {
  it('retourne Montpellier en tête près de Béziers (repli mémoire)', async () => {
    resetMajorCitiesCacheForTests();
    const nearest = await findNearestMajorCities(43.3411, 3.214, 3);
    expect(nearest.length).toBe(3);
    expect(nearest[0]!.name).toBe('Montpellier');
  });

  it('trie par distance croissante depuis Paris', async () => {
    resetMajorCitiesCacheForTests();
    const nearest = await findNearestMajorCities(48.8566, 2.3522, 3);
    expect(nearest[0]!.name).toBe('Paris');
    expect(nearest[0]!.distanceKm).toBeLessThan(5);
    for (let i = 1; i < nearest.length; i++) {
      expect(nearest[i]!.distanceKm).toBeGreaterThanOrEqual(nearest[i - 1]!.distanceKm);
    }
  });
});
