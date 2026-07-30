/** Slides within this distance of any render center mount full media (video/img). */
export const REELS_RENDER_WINDOW = 2;

/** Index from scrollTop / slide height, clamped to feed bounds. */
export function getScrollDerivedIndex(
  scrollTop: number,
  clientHeight: number,
  itemCount: number
): number {
  if (itemCount <= 0 || clientHeight <= 0) return 0;
  const raw = Math.round(scrollTop / clientHeight);
  return Math.max(0, Math.min(itemCount - 1, raw));
}

/** Unique centers for the virtualized render window (state + DOM truth). */
export function collectReelsRenderCenters(
  centers: Array<number | null | undefined>,
  itemCount: number
): number[] {
  const unique = new Set<number>();
  for (const value of centers) {
    if (value == null || !Number.isFinite(value)) continue;
    const clamped = Math.max(0, Math.min(itemCount - 1, Math.trunc(value)));
    unique.add(clamped);
  }
  if (unique.size === 0) unique.add(0);
  return [...unique];
}

/** True when slide `index` should mount media (not an empty spacer). */
export function shouldRenderReelSlide(
  index: number,
  centers: number[],
  window = REELS_RENDER_WINDOW
): boolean {
  for (const center of centers) {
    if (Math.abs(index - center) <= window) return true;
  }
  return false;
}
