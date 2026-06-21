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

/** État « Connecté » profil / bannière — OAuth réel pour Spotify, lien YouTube mock ou réel, Instagram sinon. */
export function isProfilePlatformConnected(
  platform: ConnectPlatform,
  platformLinks: Array<PlatformLinkSummary> | undefined
): boolean {
  if (platform === 'instagram') {
    return Boolean(platformLinks?.some((l) => l.platform === 'instagram'));
  }
  if (platform === 'youtube') {
    return Boolean(platformLinks?.some((l) => l.platform === 'youtube'));
  }
  return isRealMusicPlatformConnected(platform, platformLinks);
}

/** OAuth réel YouTube — requis pour héberger un salon avec sa bibliothèque. */
export function hasRealMusicPlatformLink(
  links: Array<PlatformLinkSummary> | undefined
): boolean {
  return (links ?? []).some(
    (l) => l.isRealOAuth && l.platform === 'youtube'
  );
}

export function isSpotifyPremiumProduct(product?: string): boolean {
  return product?.trim().toLowerCase() === 'premium';
}

/** OAuth réel requis pour créer / héberger / rejoindre un salon sur cette plateforme. */
export function isMusicPlatformLinkedForSalon(
  platform: MusicPlatform,
  connectedPlatforms: MusicPlatform[] | undefined,
  platformLinks: Array<PlatformLinkSummary> | undefined
): boolean {
  if (platform === 'youtube') {
    if (platformLinks?.some((l) => l.platform === 'youtube')) return true;
    return isPlatformConnected(connectedPlatforms, platform);
  }
  if (platformLinks?.length) {
    return isProfilePlatformConnected(platform, platformLinks);
  }
  return isPlatformConnected(connectedPlatforms, platform);
}

/** Salons YouTube : compte YouTube lié requis (hôte et participants). */
export function canAccessYoutubeSalon(
  connectedPlatforms: MusicPlatform[] | undefined,
  platformLinks: Array<PlatformLinkSummary> | undefined
): boolean {
  return isMusicPlatformLinkedForSalon('youtube', connectedPlatforms, platformLinks);
}

/** Auditeur : compte YouTube lié requis pour rejoindre un salon YouTube. L'hôte n'est pas bloqué. */
export function canJoinSalonAsParticipant(
  salonPlatform: MusicPlatform,
  connectedPlatforms: MusicPlatform[] | undefined,
  isHost?: boolean
): boolean {
  if (isHost) return true;
  if (salonPlatform === 'spotify') return true;
  if (salonPlatform !== 'youtube') return true;
  return isPlatformConnected(connectedPlatforms, salonPlatform);
}

export function salonParticipantAccessMessageKey(
  platform: MusicPlatform
): 'salon.accessSpotifyRequired' | 'salon.accessYoutubeRequired' {
  return platform === 'spotify' ? 'salon.accessSpotifyRequired' : 'salon.accessYoutubeRequired';
}

export const PLATFORM_LABELS: Record<
  ConnectPlatform,
  { label: string; emoji: string; connectKey: string }
> = {
  spotify: { label: 'Spotify', emoji: '🎧', connectKey: 'platform.connectSpotify' },
  youtube: { label: 'YouTube', emoji: '▶️', connectKey: 'platform.connectYoutube' },
  instagram: { label: 'Instagram', emoji: '📸', connectKey: 'platform.connectInstagram' },
};
