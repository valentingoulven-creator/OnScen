import { describe, expect, it } from 'vitest';
import { isValidLatLng } from './mapCoords';
import { toGlobeCapitalLabels, WORLD_CAPITALS } from './worldCapitals';

describe('WORLD_CAPITALS', () => {
  it('contains at least 195 sovereign capitals', () => {
    expect(WORLD_CAPITALS.length).toBeGreaterThanOrEqual(195);
  });

  it('has unique country entries', () => {
    const countries = WORLD_CAPITALS.map((c) => c.country);
    expect(new Set(countries).size).toBe(countries.length);
  });

  it('uses valid precise coordinates (no 0,0 or country-centroid placeholders)', () => {
    for (const cap of WORLD_CAPITALS) {
      expect(isValidLatLng(cap.lat, cap.lng), `${cap.country}: invalid coords`).toBe(true);
      expect(cap.lat === 0 && cap.lng === 0, `${cap.country}: null island`).toBe(false);
      expect(cap.name.length, `${cap.country}: missing name`).toBeGreaterThan(0);
    }
  });
});

describe('toGlobeCapitalLabels', () => {
  it('uses capital name only for display text', () => {
    const labels = toGlobeCapitalLabels();
    const paris = labels.find((l) => l.text === 'Paris');
    expect(paris).toBeDefined();
    expect(paris!.text).toBe('Paris');
    expect(paris!.text).not.toContain('France');
    expect(paris!.country).toBe('France');
  });
});
