import { describe, expect, it } from 'vitest';
import {
  computeStoryCropRect,
  FEED_VIEWPORT_H,
  FEED_VIEWPORT_W,
  initialFeedCoverScale,
  initialStoryCoverScale,
} from './storyImageCompose';

describe('storyImageCompose', () => {
  it('computes initial cover scale for portrait viewport', () => {
    const scale = initialStoryCoverScale(4000, 3000);
    expect(scale).toBeGreaterThan(0);
  });

  it('returns valid crop rect within image bounds', () => {
    const crop = computeStoryCropRect(1000, 800, 280, 498, 0.5, 0, 0);
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sw).toBeGreaterThan(0);
    expect(crop.sh).toBeGreaterThan(0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(1000);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(800);
  });

  it('computes initial cover scale for feed 4:5 viewport', () => {
    const scale = initialFeedCoverScale(4000, 3000);
    expect(scale).toBeGreaterThan(0);
    expect(FEED_VIEWPORT_W / FEED_VIEWPORT_H).toBeCloseTo(0.8, 2);
  });
});
