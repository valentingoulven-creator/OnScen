import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DISPLAY_DURATION_SEC,
  getDisplayDurationMs,
  MAP_BANNER_EXPORT_H,
  MAP_BANNER_EXPORT_W,
  MAP_BANNER_IMAGE_H,
  MAP_BANNER_IMAGE_W,
  normalizeDisplayDurationSec,
  SPONSOR_IMAGE_SPECS,
} from './sponsorDisplaySpec';

describe('sponsorDisplaySpec', () => {
  it('normalise la durée entre 3 et 60 secondes', () => {
    expect(normalizeDisplayDurationSec(undefined)).toBe(DEFAULT_DISPLAY_DURATION_SEC);
    expect(normalizeDisplayDurationSec(8)).toBe(8);
    expect(normalizeDisplayDurationSec(1)).toBe(3);
    expect(normalizeDisplayDurationSec(120)).toBe(60);
    expect(normalizeDisplayDurationSec('12')).toBe(12);
  });

  it('convertit la durée en millisecondes', () => {
    expect(getDisplayDurationMs(8)).toBe(8000);
    expect(getDisplayDurationMs()).toBe(8000);
  });

  it('définit des specs image par emplacement', () => {
    expect(SPONSOR_IMAGE_SPECS.map_banner.logoPx).toContain('80');
    expect(SPONSOR_IMAGE_SPECS.map_banner.bannerPx).toContain(`${MAP_BANNER_IMAGE_W} × ${MAP_BANNER_IMAGE_H}`);
    expect(SPONSOR_IMAGE_SPECS.map_banner.bannerPx).toContain(`${MAP_BANNER_EXPORT_W} × ${MAP_BANNER_EXPORT_H}`);
    expect(SPONSOR_IMAGE_SPECS.feed_inline.bannerPx).toContain('343');
    expect(SPONSOR_IMAGE_SPECS.stories_banner.bannerPx).toContain('390');
  });

  it('aligne export bandeau carte sur ratio 20:3', () => {
    expect(MAP_BANNER_EXPORT_W / MAP_BANNER_EXPORT_H).toBeCloseTo(20 / 3, 5);
    expect(MAP_BANNER_EXPORT_W / MAP_BANNER_IMAGE_W).toBe(2);
    expect(MAP_BANNER_EXPORT_H / MAP_BANNER_IMAGE_H).toBe(2);
  });
});
