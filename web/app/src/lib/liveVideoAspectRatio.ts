import type { LiveVideoResolutionPreset } from './liveVideoResolution';

export type LiveVideoAspectRatioPreset = '16:9' | '9:16' | '4:3';

export const DEFAULT_LIVE_VIDEO_ASPECT_RATIO: LiveVideoAspectRatioPreset = '16:9';

export const LIVE_VIDEO_ASPECT_RATIO_OPTIONS: Array<{
  id: LiveVideoAspectRatioPreset;
  widthRatio: number;
  heightRatio: number;
}> = [
  { id: '16:9', widthRatio: 16, heightRatio: 9 },
  { id: '9:16', widthRatio: 9, heightRatio: 16 },
  { id: '4:3', widthRatio: 4, heightRatio: 3 },
];

const RESOLUTION_BASE_PX: Record<LiveVideoResolutionPreset, number> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
};

export function getLiveVideoAspectRatioPreset(raw?: string | null): LiveVideoAspectRatioPreset {
  if (raw === '16:9' || raw === '9:16' || raw === '4:3') return raw;
  return DEFAULT_LIVE_VIDEO_ASPECT_RATIO;
}

export function getLiveVideoAspectRatioCss(preset: LiveVideoAspectRatioPreset): string {
  const found = LIVE_VIDEO_ASPECT_RATIO_OPTIONS.find((o) => o.id === preset);
  if (!found) return '16 / 9';
  return `${found.widthRatio} / ${found.heightRatio}`;
}

/** Ratio largeur/hauteur pour dimensionner la colonne vidéo live (spectateurs). */
export function getLiveStackWidthRatioCss(preset: LiveVideoAspectRatioPreset): string {
  return getLiveVideoAspectRatioCss(preset);
}

export function getLiveVideoAspectRatioClass(preset: LiveVideoAspectRatioPreset): string {
  return `live-video-aspect-${preset.replace(':', '-')}`;
}

/** Dimensions capture (Twitch / OBS) pour une résolution + format. */
export function getLiveVideoDimensions(
  resolution: LiveVideoResolutionPreset,
  aspect: LiveVideoAspectRatioPreset
): { width: number; height: number } {
  const base = RESOLUTION_BASE_PX[resolution];
  const found = LIVE_VIDEO_ASPECT_RATIO_OPTIONS.find((o) => o.id === aspect) ?? LIVE_VIDEO_ASPECT_RATIO_OPTIONS[0];
  const { widthRatio, heightRatio } = found;

  if (widthRatio >= heightRatio) {
    const height = base;
    const width = Math.round((base * widthRatio) / heightRatio);
    return { width, height };
  }

  const width = base;
  const height = Math.round((base * heightRatio) / widthRatio);
  return { width, height };
}
