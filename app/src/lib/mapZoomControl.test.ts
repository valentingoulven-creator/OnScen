import { describe, expect, it } from 'vitest';
import {
  flatZoomToNorm,
  globeAltToNorm,
  MAP_FLAT_ZOOM_MAX,
  MAP_FLAT_ZOOM_MIN,
  MAP_GLOBE_ALT_MAX,
  MAP_GLOBE_ALT_MIN,
  normToFlatZoom,
  normToGlobeAlt,
} from './mapZoomControl';

describe('mapZoomControl', () => {
  it('round-trips flat zoom through norm', () => {
    const zoom = 11;
    const norm = flatZoomToNorm(zoom);
    expect(normToFlatZoom(norm)).toBeCloseTo(zoom, 5);
  });

  it('maps flat zoom bounds to 0 and 1', () => {
    expect(flatZoomToNorm(MAP_FLAT_ZOOM_MIN)).toBe(0);
    expect(flatZoomToNorm(MAP_FLAT_ZOOM_MAX)).toBe(1);
  });

  it('round-trips globe altitude through norm', () => {
    const alt = 0.4;
    const norm = globeAltToNorm(alt);
    expect(normToGlobeAlt(norm)).toBeCloseTo(alt, 5);
  });

  it('maps globe altitude bounds to 1 and 0', () => {
    expect(globeAltToNorm(MAP_GLOBE_ALT_MIN)).toBe(1);
    expect(globeAltToNorm(MAP_GLOBE_ALT_MAX)).toBe(0);
  });
});
