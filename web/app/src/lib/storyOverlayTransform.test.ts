import { describe, expect, it } from 'vitest';
import {
  clampOverlayScale,
  effectiveTagFontSize,
  effectiveTextFontSize,
  scaleFromCornerDrag,
  scaleFromPinchDistance,
  STORY_OVERLAY_SCALE_MAX,
  STORY_OVERLAY_SCALE_MIN,
  STORY_TAG_BASE_FONT_SIZE,
} from './storyOverlayTransform';

describe('storyOverlayTransform', () => {
  it('clamps overlay scale to 0.5–2', () => {
    expect(clampOverlayScale(0.1)).toBe(STORY_OVERLAY_SCALE_MIN);
    expect(clampOverlayScale(3)).toBe(STORY_OVERLAY_SCALE_MAX);
    expect(clampOverlayScale(1)).toBe(1);
  });

  it('computes effective text and tag font sizes', () => {
    expect(effectiveTextFontSize({ fontSize: 28, scale: 2 })).toBe(56);
    expect(effectiveTextFontSize({ fontSize: 28 })).toBe(28);
    expect(effectiveTagFontSize({ scale: 0.5 })).toBe(
      Math.round(STORY_TAG_BASE_FONT_SIZE * 0.5)
    );
  });

  it('scales from pinch distance ratio', () => {
    expect(scaleFromPinchDistance(100, 200, 1)).toBe(2);
    expect(scaleFromPinchDistance(100, 50, 1)).toBe(0.5);
    expect(scaleFromPinchDistance(0, 100, 1)).toBe(1);
  });

  it('scales from corner drag distance ratio', () => {
    expect(scaleFromCornerDrag(40, 80, 1)).toBe(2);
    expect(scaleFromCornerDrag(40, 20, 1)).toBe(0.5);
    expect(scaleFromCornerDrag(4, 40, 1)).toBe(1);
  });
});
