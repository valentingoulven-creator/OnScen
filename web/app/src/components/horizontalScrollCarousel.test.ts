import { describe, expect, it } from 'vitest';
import { computeHorizontalScrollAmount } from './HorizontalScrollCarousel';
import { STORIES_RINGS_SCROLL_STEP } from './StoriesRingsCarousel';

describe('computeHorizontalScrollAmount', () => {
  it('multiplie largeur item + gap par le nombre de pas', () => {
    expect(computeHorizontalScrollAmount(64, 8, 1)).toBe(72);
    expect(computeHorizontalScrollAmount(64, 8, 3.5)).toBe(252);
  });
});

describe('STORIES_RINGS_SCROLL_STEP', () => {
  it('défile environ 3 à 4 anneaux par clic', () => {
    expect(STORIES_RINGS_SCROLL_STEP).toBeGreaterThanOrEqual(3);
    expect(STORIES_RINGS_SCROLL_STEP).toBeLessThanOrEqual(4);
  });
});
