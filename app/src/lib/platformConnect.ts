import type { MusicPlatform } from './salonPlayback';

export type { MusicPlatform };

/** Plateformes liables au profil (streaming + Instagram). */
export type ConnectPlatform = MusicPlatform | 'instagram';

export type PlatformLinkSummary = {
  platform: ConnectPlatform;
  isRealOAuth?: boolean;
};

export function isPlatformConnected(
  connectedPlatforms: MusicPlatform[] | undefined,
  platform: ConnectPlatform,
  platformLinks?: Array<PlatformLinkSummary> | undefined
): boolean {
  if (platform === 'instagram') {
    return Boolean(platformLinks?.some((l) => l.platform === 'instagram'));
  }
  return (connectedPlatforms ?? []).includes(platform);
}

/** OAuth réel pour une plateforme musicale (Spotify ou YouTube). */
export function isRealMusicPlatformConnected(
  platform: MusicPlatform,
  links: Array<PlatformLinkSummary> | undefined
): boolean {
  return Boolean(links?.some((l) => l.platform === platform && l.isRealOAuth));
}

/** État « Connecté » profil / bannière — OAuth réel pour Spotify/YouTube, lien Instagram sinon. */
export function isProfilePlatformConnected(
  platform: ConnectPlatform,
  platformLinks: Array<PlatformLinkSummary> | undefined
): boolean {
  if (platform === 'instagram') {
    return Boolean(platformLinks?.some((l) => l.platform === 'instagram'));
  }
  return isRealMusicPlatformConnected(platform, platformLinks);
}

/** OAuth réel Spotify ou YouTube — requis pour héberger un salon avec sa bibliothèque. */
export function hasRealMusicPlatformLink(
  links: Array<PlatformLinkSummary> | undefined
): boolean {
  return (links ?? []).some(
    (l) => l.isRealOAuth && (l.platform === 'spotify' || l.platform === 'youtube')
  );
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
