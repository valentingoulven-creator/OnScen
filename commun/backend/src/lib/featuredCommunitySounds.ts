import { db } from '../models/schema';

export type FeaturedCommunitySoundKind = 'composition' | 'album';

export interface FeaturedCommunitySound {
  id: string;
  kind: FeaturedCommunitySoundKind;
  userId: string;
  title: string;
  excerpt: string;
  source: string;
  imageUrl?: string;
  publishedAt: number;
  genres?: string[];
}

function usernameFor(userId: string): string {
  return db.users.get(userId)?.username?.trim() || 'Utilisateur';
}

function albumCoverFor(userId: string, albumId?: string): string | undefined {
  if (!albumId) return undefined;
  const album = db.albums.find((a) => a.id === albumId && a.userId === userId);
  return album?.coverUrl?.trim() || undefined;
}

function trackCountForAlbum(userId: string, albumId: string): number {
  return db.compositions.filter((c) => c.userId === userId && c.albumId === albumId).length;
}

/** Sons et albums récents publiés par la communauté (hors reels / salons). */
export function listFeaturedCommunitySounds(limit = 5): FeaturedCommunitySound[] {
  const compositions: FeaturedCommunitySound[] = db.compositions.map((c) => ({
    id: c.id,
    kind: 'composition',
    userId: c.userId,
    title: c.title,
    excerpt: c.artist?.trim() ? `${c.artist.trim()} · Son` : 'Son original',
    source: usernameFor(c.userId),
    imageUrl: albumCoverFor(c.userId, c.albumId),
    publishedAt: c.createdAt,
    genres: c.artist?.trim() ? [c.artist.trim()] : ['Son'],
  }));

  const albums: FeaturedCommunitySound[] = db.albums.map((a) => {
    const count = trackCountForAlbum(a.userId, a.id);
    return {
      id: a.id,
      kind: 'album',
      userId: a.userId,
      title: a.title,
      excerpt: count > 0 ? `${count} titre${count > 1 ? 's' : ''}` : 'Album',
      source: usernameFor(a.userId),
      imageUrl: a.coverUrl?.trim(),
      publishedAt: a.createdAt,
      genres: ['Album'],
    };
  });

  return [...compositions, ...albums]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
