import { VideoPresets, type VideoCaptureOptions } from 'livekit-client';
import {
  getLiveVideoDimensions,
  type LiveVideoAspectRatioPreset,
} from './liveVideoAspectRatio';

export type LiveVideoResolutionPreset = '1080p' | '720p' | '480p';

export const DEFAULT_LIVE_VIDEO_RESOLUTION: LiveVideoResolutionPreset = '1080p';

export const LIVE_VIDEO_RESOLUTION_OPTIONS: Array<{
  id: LiveVideoResolutionPreset;
  width: number;
  height: number;
}> = [
  { id: '1080p', width: 1920, height: 1080 },
  { id: '720p', width: 1280, height: 720 },
  { id: '480p', width: 854, height: 480 },
];

export function getLiveVideoResolutionPreset(raw?: string | null): LiveVideoResolutionPreset {
  if (raw === '1080p' || raw === '720p' || raw === '480p') return raw;
  return DEFAULT_LIVE_VIDEO_RESOLUTION;
}

export function getLiveVideoResolutionDimensions(
  preset: LiveVideoResolutionPreset,
  aspect: LiveVideoAspectRatioPreset = '16:9'
): { width: number; height: number } {
  return getLiveVideoDimensions(preset, aspect);
}

/** Contraintes getUserMedia (WebRTC navigateur). */
export function mediaVideoConstraintsForPreset(
  preset: LiveVideoResolutionPreset,
  deviceId?: string,
  aspect: LiveVideoAspectRatioPreset = '16:9'
): MediaTrackConstraints {
  const { width, height } = getLiveVideoDimensions(preset, aspect);
  return {
    ...(deviceId ? { deviceId: { ideal: deviceId } } : { facingMode: 'user' as const }),
    width: { ideal: width, max: width },
    height: { ideal: height, max: height },
    aspectRatio: { ideal: width / height },
    frameRate: { ideal: 30, max: 30 },
  };
}

export function buildLiveKitVideoCaptureOptions(
  preset: LiveVideoResolutionPreset,
  deviceId?: string,
  aspect: LiveVideoAspectRatioPreset = '16:9'
): VideoCaptureOptions {
  const { width, height } = getLiveVideoDimensions(preset, aspect);
  const resolution =
    aspect === '16:9' && preset === '1080p'
      ? VideoPresets.h1080.resolution
      : aspect === '16:9' && preset === '720p'
        ? VideoPresets.h720.resolution
        : { width, height, frameRate: 30, aspectRatio: width / height };
  return {
    ...(deviceId ? { deviceId } : {}),
    resolution,
  };
}

export function buildLiveKitAudioCaptureOptions(deviceId?: string) {
  return deviceId ? { deviceId } : {};
}
