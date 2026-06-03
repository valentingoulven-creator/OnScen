import type { MusicPlatform } from './salonPlayback';

export type { MusicPlatform };

export function isPlatformConnected(
  connectedPlatforms: MusicPlatform[] | undefined,
  platform: MusicPlatform
): boolean {
  return (connectedPlatforms ?? []).includes(platform);
}

export const PLATFORM_LABELS: Record<MusicPlatform, { label: string; emoji: string; connect: string }> = {
  spotify: { label: 'Spotify', emoji: '🎧', connect: 'Connecter Spotify' },
  youtube: { label: 'YouTube', emoji: '▶️', connect: 'Connecter YouTube' },
};
