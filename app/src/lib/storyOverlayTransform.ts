import type { StoryTextOverlay } from './storyImageCompose';
import type { StoryTaggedUser } from '../types';

export const STORY_OVERLAY_SCALE_MIN = 0.5;
export const STORY_OVERLAY_SCALE_MAX = 2;
export const STORY_TEXT_FONT_SIZE_MIN = 14;
export const STORY_TEXT_FONT_SIZE_MAX = 48;
export const STORY_TAG_BASE_FONT_SIZE = 11;

export function clampOverlayScale(scale: number): number {
  return Math.min(STORY_OVERLAY_SCALE_MAX, Math.max(STORY_OVERLAY_SCALE_MIN, scale));
}

export function resolveOverlayScale(scale?: number): number {
  return clampOverlayScale(scale ?? 1);
}

export function resolveTagScale(tag: Pick<StoryTaggedUser, 'scale'>): number {
  return clampOverlayScale(tag.scale ?? 1);
}

export function effectiveTextFontSize(overlay: Pick<StoryTextOverlay, 'fontSize' | 'scale'>): number {
  return Math.round(overlay.fontSize * resolveOverlayScale(overlay.scale));
}

export function effectiveTagFontSize(tag: Pick<StoryTaggedUser, 'scale'>): number {
  return Math.round(STORY_TAG_BASE_FONT_SIZE * resolveTagScale(tag));
}

/** Pincement : nouveau facteur d'échelle à partir de la distance entre deux doigts. */
export function scaleFromPinchDistance(
  startDistance: number,
  currentDistance: number,
  baseScale: number
): number {
  if (startDistance < 1) return baseScale;
  return clampOverlayScale(baseScale * (currentDistance / startDistance));
}

export function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointerCenter(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Poignée coin : échelle selon la distance au centre du calque. */
export function scaleFromCornerDrag(
  startDistance: number,
  currentDistance: number,
  baseScale: number
): number {
  if (startDistance < 8) return baseScale;
  return clampOverlayScale(baseScale * (currentDistance / startDistance));
}
