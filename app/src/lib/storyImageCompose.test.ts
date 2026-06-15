import { describe, expect, it } from 'vitest';
import {
  computeStoryCropRect,
  defaultStoryTagPosition,
  FEED_VIEWPORT_H,
  FEED_VIEWPORT_W,
  initialFeedCoverScale,
  initialStoryCoverScale,
  resolveStoryTagPosition,
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

  it('returns staggered default tag positions within 0–1', () => {
    const a = defaultStoryTagPosition(0, 3);
    const b = defaultStoryTagPosition(1, 3);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(1);
    expect(a.y).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('resolveStoryTagPosition prefers stored coordinates', () => {
    const resolved = resolveStoryTagPosition({ x: 0.2, y: 0.8 }, 0, 1);
    expect(resolved).toEqual({ x: 0.2, y: 0.8 });
  });
});
