import { describe, expect, it } from 'vitest';
import {
  collectReelsRenderCenters,
  getScrollDerivedIndex,
  REELS_RENDER_WINDOW,
  shouldRenderReelSlide,
} from './reelsRenderWindow';

describe('reelsRenderWindow', () => {
  it('derive index from scroll metrics', () => {
    expect(getScrollDerivedIndex(0, 800, 10)).toBe(0);
    expect(getScrollDerivedIndex(799, 800, 10)).toBe(1);
    expect(getScrollDerivedIndex(2400, 800, 10)).toBe(3);
    expect(getScrollDerivedIndex(100, 0, 10)).toBe(0);
  });

  it('always includes visible slide when anchor diverges from scroll', () => {
    const itemCount = 140;
    const scrollTop = 800; // slide 1 visible
    const visible = getScrollDerivedIndex(scrollTop, 800, itemCount);
    expect(visible).toBe(1);

    const anchorOnly = collectReelsRenderCenters([40], itemCount);
    expect(shouldRenderReelSlide(1, anchorOnly)).toBe(false);

    const merged = collectReelsRenderCenters([40, visible], itemCount);
    expect(shouldRenderReelSlide(1, merged)).toBe(true);
    expect(shouldRenderReelSlide(40, merged)).toBe(true);
  });

  it('covers union window around active, anchor and DOM index', () => {
    const centers = collectReelsRenderCenters([0, 5, 12], 140);
    expect(centers).toEqual(expect.arrayContaining([0, 5, 12]));
    expect(shouldRenderReelSlide(12, centers, REELS_RENDER_WINDOW)).toBe(true);
    expect(shouldRenderReelSlide(10, centers, REELS_RENDER_WINDOW)).toBe(true);
    expect(shouldRenderReelSlide(50, centers, REELS_RENDER_WINDOW)).toBe(false);
  });
});
