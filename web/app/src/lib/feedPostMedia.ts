import type { FeedPost } from '../types';

/** Toutes les images d'une publication (galerie ou image unique). */
export function getFeedPostImageUrls(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): string[] {
  const fromList = (post.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromList.length > 0) return fromList;
  const single = post.imageUrl?.trim();
  return single ? [single] : [];
}

export function feedPostHasImages(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): boolean {
  return getFeedPostImageUrls(post).length > 0;
}
