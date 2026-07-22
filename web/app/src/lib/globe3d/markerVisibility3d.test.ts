import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS } from './constants';
import { altitudeToDistance } from './cameraMath';
import { lonLatToVector3 } from './geoMath';
import {
  htmlMarkerSurfaceRadius,
  isGlobePointFacingCamera,
} from './markerVisibility3d';

describe('isGlobePointFacingCamera', () => {
  it('returns true for a marker facing the camera above Paris', () => {
    const marker = lonLatToVector3(2.35, 48.85, EARTH_RADIUS);
    const camera = lonLatToVector3(2.35, 48.85, altitudeToDistance(0.2));
    expect(isGlobePointFacingCamera(marker, camera)).toBe(true);
  });

  it('returns false for a marker on the opposite hemisphere', () => {
    const marker = lonLatToVector3(2.35, 48.85, EARTH_RADIUS);
    const camera = lonLatToVector3(-2.35, -48.85, altitudeToDistance(0.8));
    expect(isGlobePointFacingCamera(marker, camera)).toBe(false);
  });

  it('keeps close-zoom markers visible (regression: drei occlude false positive)', () => {
    const marker = lonLatToVector3(3.88, 43.61, EARTH_RADIUS * 1.045);
    const camera = lonLatToVector3(3.88, 43.61, altitudeToDistance(0.04));
    expect(isGlobePointFacingCamera(marker, camera)).toBe(true);
  });
});

describe('htmlMarkerSurfaceRadius', () => {
  it('returns MARKER_SURFACE_RADIUS (no zoom lift — pins on surface)', () => {
    const street = htmlMarkerSurfaceRadius(altitudeToDistance(0.05));
    const overview = htmlMarkerSurfaceRadius(altitudeToDistance(1.0));
    expect(street).toBe(overview);
    expect(street).toBeGreaterThan(EARTH_RADIUS);
  });

  it('returns a finite radius for invalid camera distance', () => {
    expect(htmlMarkerSurfaceRadius(EARTH_RADIUS)).toBeGreaterThan(0);
  });
});
