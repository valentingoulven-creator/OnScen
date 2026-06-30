import { describe, expect, it } from 'vitest';
import { getMapSearchFlyRadiusKm, takePendingMapFlyToPlace } from './mapSearchIntent';

describe('getMapSearchFlyRadiusKm', () => {
  it('uses country radius for country kind', () => {
    expect(getMapSearchFlyRadiusKm('France', 'country')).toBe(280);
  });

  it('uses city map radius for city kind', () => {
    expect(getMapSearchFlyRadiusKm('Lyon (69000)', 'city')).toBe(16);
  });
});

describe('takePendingMapFlyToPlace', () => {
  it('returns null when queue empty', () => {
    takePendingMapFlyToPlace();
    expect(takePendingMapFlyToPlace()).toBeNull();
  });
});
