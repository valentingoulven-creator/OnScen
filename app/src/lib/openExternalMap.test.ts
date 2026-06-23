import { describe, expect, it } from 'vitest';
import { buildExternalMapUrl } from './openExternalMap';

describe('buildExternalMapUrl', () => {
  const label = 'Le Corum Opéra Berlioz, Montpellier, France';
  const coords = { label, latitude: 43.612, longitude: 3.8805 };

  it('builds Google Maps URL with coordinates', () => {
    expect(buildExternalMapUrl('google', coords)).toBe(
      'https://www.google.com/maps/search/?api=1&query=43.612%2C3.8805'
    );
  });

  it('builds Waze URL with label fallback', () => {
    expect(buildExternalMapUrl('waze', { label })).toContain('waze.com/ul?q=');
    expect(decodeURIComponent(buildExternalMapUrl('waze', { label }))).toContain(label);
  });

  it('builds Apple Maps URL with coordinates', () => {
    expect(buildExternalMapUrl('apple', coords)).toContain('maps.apple.com/?ll=43.612,3.8805');
  });
});
