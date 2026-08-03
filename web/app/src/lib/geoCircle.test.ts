import { describe, expect, it } from 'vitest';
import { circleLatLngRing, destinationPointKm } from './geoCircle';

describe('geoCircle', () => {
  it('destinationPointKm returns ~radius km at bearing 0', () => {
    const start = { lat: 48.85, lon: 2.35 };
    const end = destinationPointKm(start.lat, start.lon, 0, 10);
    const dLat = Math.abs(end.lat - start.lat);
    expect(dLat).toBeGreaterThan(0.08);
    expect(dLat).toBeLessThan(0.12);
  });

  it('circleLatLngRing closes with expected point count', () => {
    const ring = circleLatLngRing(48.85, 2.35, 20, 36);
    expect(ring.length).toBe(37);
    expect(ring[0]!.lat).toBeCloseTo(ring[ring.length - 1]!.lat, 5);
  });
});
