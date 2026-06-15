import type { MusicReel } from '../content/reels';
import type { Salon } from '../types';

export type FeaturedUserSoundKind = 'salon' | 'reel';

export interface FeaturedUserSoundItem {
  id: string;
  kind: FeaturedUserSoundKind;
  title: string;
  excerpt: string;
  source: string;
  imageUrl?: string;
  publishedAt: number;
  genres?: string[];
  badgeKey: 'feed.featuredBadgeSalon' | 'feed.featuredBadgeReel';
}

type ReelWithMeta = MusicReel & { createdAt?: number; authorId?: string };

export function salonToFeaturedSound(salon: Salon): FeaturedUserSoundItem {
  const track = salon.playbackState;
  const trackLine =
    track?.title && track?.artist
      ? `${track.title} · ${track.artist}`
      : salon.platform === 'spotify'
        ? 'Session Spotify'
        : 'Session YouTube';
  return {
    id: salon.id,
    kind: 'salon',
    title: salon.title,
    excerpt: trackLine,
    source: salon.hostName,
    imageUrl: track?.albumArtUrl ?? salon.hostAvatarUrl,
    publishedAt: salon.createdAt ?? 0,
    genres: [salon.platform === 'spotify' ? 'Spotify' : 'YouTube'],
    badgeKey: 'feed.featuredBadgeSalon',
  };
}

export function reelToFeaturedSound(reel: ReelWithMeta): FeaturedUserSoundItem | null {
  const authorId = reel.authorId?.trim();
  if (!authorId) return null;
  return {
    id: reel.id,
    kind: 'reel',
    title: reel.title,
    excerpt: `${reel.artist} · ${reel.genre}`,
    source: reel.authorUsername?.trim() || 'Utilisateur',
    imageUrl: reel.posterUrl,
    publishedAt: reel.createdAt ?? 0,
    genres: reel.genre ? [reel.genre] : undefined,
    badgeKey: 'feed.featuredBadgeReel',
  };
}

/** Recent user-published salons + reels (non-bot), newest first. */
export function pickRecentUserSounds(
  salons: Salon[],
  reels: ReelWithMeta[],
  limit = 5
): FeaturedUserSoundItem[] {
  const salonItems = salons
    .filter((s) => !s.isBot && (s.createdAt ?? 0) > 0)
    .map(salonToFeaturedSound);
  const reelItems = reels
    .map(reelToFeaturedSound)
    .filter((item): item is FeaturedUserSoundItem => item != null);
  return [...salonItems, ...reelItems]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit);
}
