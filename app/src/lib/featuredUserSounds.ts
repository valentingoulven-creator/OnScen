export type FeaturedUserSoundKind = 'composition' | 'album';

export interface FeaturedUserSoundItem {
  id: string;
  kind: FeaturedUserSoundKind;
  userId: string;
  title: string;
  excerpt: string;
  source: string;
  imageUrl?: string;
  publishedAt: number;
  genres?: string[];
  badgeKey: 'feed.featuredBadgeComposition' | 'feed.featuredBadgeAlbum';
}

export function mapFeaturedSoundFromApi(
  item: Omit<FeaturedUserSoundItem, 'badgeKey'> & { kind: FeaturedUserSoundKind }
): FeaturedUserSoundItem {
  return {
    ...item,
    badgeKey: item.kind === 'album' ? 'feed.featuredBadgeAlbum' : 'feed.featuredBadgeComposition',
  };
}
