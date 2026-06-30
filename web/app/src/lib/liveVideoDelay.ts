/** Délai intentionnel du flux vidéo côté spectateurs (modération / décalage). */

export const DEFAULT_LIVE_VIDEO_DELAY_SECONDS = 0;

export const MAX_LIVE_VIDEO_DELAY_SECONDS = 120;

export const LIVE_VIDEO_DELAY_PRESETS = [0, 5, 10, 15, 30, 60] as const;

export type LiveVideoDelayPreset = (typeof LIVE_VIDEO_DELAY_PRESETS)[number];

export function clampLiveVideoDelaySeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIVE_VIDEO_DELAY_SECONDS;
  return Math.max(0, Math.min(MAX_LIVE_VIDEO_DELAY_SECONDS, Math.round(value)));
}

export function getLiveVideoDelaySeconds(value: unknown): number {
  return clampLiveVideoDelaySeconds(typeof value === 'number' ? value : DEFAULT_LIVE_VIDEO_DELAY_SECONDS);
}

export function isLiveVideoDelayPreset(value: number): value is LiveVideoDelayPreset {
  return (LIVE_VIDEO_DELAY_PRESETS as readonly number[]).includes(value);
}
