import { parseStoryAppLink } from './storyAppLink';

export type AlbumLinkPlatform = 'spotify' | 'deezer' | 'soundy' | 'youtube' | 'other';

export interface AlbumLinkPlatformStyle {
  platform: AlbumLinkPlatform;
  label: string;
  /** Radial gradient stops for the vinyl center label (light → mid → dark). */
  gradientStops: [string, string, string];
  /** Subtle outer ring tint on the disc. */
  ringColor: string;
}

const PLATFORM_STYLES: Record<AlbumLinkPlatform, AlbumLinkPlatformStyle> = {
  spotify: {
    platform: 'spotify',
    label: 'Spotify',
    gradientStops: ['#34d399', '#1db954', '#15803d'],
    ringColor: 'rgba(29, 185, 84, 0.45)',
  },
  deezer: {
    platform: 'deezer',
    label: 'Deezer',
    gradientStops: ['#67e8f9', '#00c7f2', '#0369a1'],
    ringColor: 'rgba(0, 199, 242, 0.45)',
  },
  soundy: {
    platform: 'soundy',
    label: 'Soundy',
    gradientStops: ['#f472b6', '#c026d3', '#581c87'],
    ringColor: 'rgba(244, 114, 182, 0.45)',
  },
  youtube: {
    platform: 'youtube',
    label: 'YouTube',
    gradientStops: ['#fca5a5', '#ef4444', '#991b1b'],
    ringColor: 'rgba(239, 68, 68, 0.45)',
  },
  other: {
    platform: 'other',
    label: 'Lien',
    gradientStops: ['#fde68a', '#f97316', '#c2410c'],
    ringColor: 'rgba(249, 115, 22, 0.45)',
  },
};

const SOUNDY_HOSTS = new Set(['getsoundy.com', 'www.getsoundy.com', 'localhost', '127.0.0.1']);

function isSpotifyHost(host: string): boolean {
  return host === 'open.spotify.com' || host === 'spotify.com' || host.endsWith('.spotify.com');
}

function isDeezerHost(host: string): boolean {
  return host === 'deezer.com' || host.endsWith('.deezer.com');
}

function isYouTubeHost(host: string): boolean {
  return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
}

function isSoundyHost(host: string): boolean {
  if (SOUNDY_HOSTS.has(host)) return true;
  if (typeof window !== 'undefined' && host === window.location.hostname.toLowerCase()) {
    return true;
  }
  return false;
}

/** Detect streaming / in-app platform from an album link URL. */
export function detectAlbumLinkPlatform(url: string): AlbumLinkPlatformStyle {
  const trimmed = url.trim();
  if (!trimmed) return PLATFORM_STYLES.other;

  if (parseStoryAppLink(trimmed)) {
    return PLATFORM_STYLES.soundy;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (isSoundyHost(host)) return PLATFORM_STYLES.soundy;
    if (isSpotifyHost(host)) return PLATFORM_STYLES.spotify;
    if (isDeezerHost(host)) return PLATFORM_STYLES.deezer;
    if (isYouTubeHost(host)) return PLATFORM_STYLES.youtube;
  } catch {
    /* relative or malformed URL → other */
  }

  return PLATFORM_STYLES.other;
}
