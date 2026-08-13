import { describe, expect, it } from 'vitest';
import {
  computeHorizontalScrollAmount,
  getClosestHorizontalScrollIndex,
  scrollLeftToCenterChild,
} from './HorizontalScrollCarousel';
import { STORIES_RINGS_SCROLL_STEP } from './StoriesRingsCarousel';

describe('computeHorizontalScrollAmount', () => {
  it('multiplie largeur item + gap par le nombre de pas', () => {
    expect(computeHorizontalScrollAmount(64, 8, 1)).toBe(72);
    expect(computeHorizontalScrollAmount(64, 8, 3.5)).toBe(252);
  });
});

describe('getClosestHorizontalScrollIndex', () => {
  it('retourne l’index dont le centre est le plus proche du viewport', () => {
    const children = [
      { offsetLeft: 0, offsetWidth: 300 },
      { offsetLeft: 312, offsetWidth: 300 },
      { offsetLeft: 624, offsetWidth: 300 },
    ];
    expect(getClosestHorizontalScrollIndex(0, 400, children)).toBe(0);
    expect(getClosestHorizontalScrollIndex(50, 400, children)).toBe(0);
    expect(getClosestHorizontalScrollIndex(262, 400, children)).toBe(1);
    expect(getClosestHorizontalScrollIndex(500, 400, children)).toBe(2);
  });
});

describe('scrollLeftToCenterChild', () => {
  it('centre la carte dans le viewport et borne aux extrémités', () => {
    const child = { offsetLeft: 312, offsetWidth: 300 };
    expect(scrollLeftToCenterChild(400, 1200, child)).toBe(262);
    expect(scrollLeftToCenterChild(400, 500, { offsetLeft: 0, offsetWidth: 300 })).toBe(0);
    expect(scrollLeftToCenterChild(400, 900, { offsetLeft: 500, offsetWidth: 300 })).toBe(450);
  });
});

describe('STORIES_RINGS_SCROLL_STEP', () => {
  it('défile environ 3 à 4 anneaux par clic', () => {
    expect(STORIES_RINGS_SCROLL_STEP).toBeGreaterThanOrEqual(3);
    expect(STORIES_RINGS_SCROLL_STEP).toBeLessThanOrEqual(4);
  });
});
