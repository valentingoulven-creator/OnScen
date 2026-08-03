import { describe, expect, it } from 'vitest';
import {
  getLivesGlobeViewportRadiusKm,
  GLOBE_LIVES_VIEWPORT_RADIUS_KM,
} from './mapMarkerVisibility';

describe('getLivesGlobeViewportRadiusKm', () => {
  it('returns 4000 km on globe (overview and zoomed)', () => {
    expect(getLivesGlobeViewportRadiusKm('overview', 1.2)).toBe(4000);
    expect(getLivesGlobeViewportRadiusKm('city', 0.4)).toBe(GLOBE_LIVES_VIEWPORT_RADIUS_KM);
    expect(getLivesGlobeViewportRadiusKm('street', 0.1)).toBe(4000);
  });
});
