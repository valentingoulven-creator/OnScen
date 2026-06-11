import type { MusicPlatform } from './salonPlayback';

export type { MusicPlatform };

/** Plateformes liables au profil (streaming + Instagram). */
export type ConnectPlatform = MusicPlatform | 'instagram';

export function isPlatformConnected(
  connectedPlatforms: MusicPlatform[] | undefined,
  platform: ConnectPlatform,
  platformLinks?: Array<{ platform: ConnectPlatform }> | undefined
): boolean {
  if (platform === 'instagram') {
    return Boolean(platformLinks?.some((l) => l.platform === 'instagram'));
  }
  return (connectedPlatforms ?? []).includes(platform);
}

export function isSpotifyPremiumProduct(product?: string): boolean {
  return product?.trim().toLowerCase() === 'premium';
}

export const PLATFORM_LABELS: Record<
  ConnectPlatform,
  { label: string; emoji: string; connectKey: string }
> = {
  spotify: { label: 'Spotify', emoji: '🎧', connectKey: 'platform.connectSpotify' },
  youtube: { label: 'YouTube', emoji: '▶️', connectKey: 'platform.connectYoutube' },
  instagram: { label: 'Instagram', emoji: '📸', connectKey: 'platform.connectInstagram' },
};
