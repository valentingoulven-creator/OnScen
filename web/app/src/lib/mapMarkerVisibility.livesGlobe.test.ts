import { describe, expect, it } from 'vitest';
import {
  clipLivesForGlobeView,
  getLivesGlobePinDisplayRadiusKm,
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

describe('getLivesGlobePinDisplayRadiusKm', () => {
  it('uses capital zoom radius when not overview', () => {
    expect(getLivesGlobePinDisplayRadiusKm('street', 0.1)).toBe(280);
    expect(getLivesGlobePinDisplayRadiusKm('city', 0.4)).toBeGreaterThan(400);
  });

  it('uses viewport radius at overview', () => {
    expect(getLivesGlobePinDisplayRadiusKm('overview', 1.2)).toBe(4000);
  });
});

describe('clipLivesForGlobeView', () => {
  const lives = [
    { id: '1', latitude: 48.86, longitude: 2.35 },
    { id: '2', latitude: 51.51, longitude: -0.13 },
  ];

  it('keeps lives within POV radius', () => {
    const clipped = clipLivesForGlobeView(lives, 48.85, 2.35, 'street', 0.1);
    expect(clipped.map((l) => l.id)).toEqual(['1']);
  });

  it('viewport mode keeps lives within 4000 km at city zoom', () => {
    const clipped = clipLivesForGlobeView(lives, 48.85, 2.35, 'street', 0.1, 'viewport');
    expect(clipped.map((l) => l.id)).toEqual(['1', '2']);
  });
});
