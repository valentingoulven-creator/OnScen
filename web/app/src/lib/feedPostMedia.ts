import { isValidYoutubeVideoId, parseYoutubeVideoId } from './salonPlayback';
import type { FeedPost } from '../types';

/** Miniature YouTube (img.youtube.com / i.ytimg.com) → id vidéo. */
export const YOUTUBE_THUMBNAIL_RE =
  /(?:img\.youtube\.com\/vi\/|i\.ytimg\.com\/vi\/)([a-zA-Z0-9_-]{6,})\//;

export function parseYoutubeThumbnailVideoId(url: string | undefined | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const match = raw.match(YOUTUBE_THUMBNAIL_RE)?.[1];
  return match && isValidYoutubeVideoId(match) ? match : null;
}

/** Toutes les images d'une publication (galerie ou image unique). */
export function getFeedPostImageUrls(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): string[] {
  const fromList = (post.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromList.length > 0) return fromList;
  const single = post.imageUrl?.trim();
  return single ? [single] : [];
}

/** Images hors miniatures YouTube (affichées en galerie statique). */
export function getFeedPostNonYoutubeImageUrls(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): string[] {
  return getFeedPostImageUrls(post).filter((url) => !parseYoutubeThumbnailVideoId(url));
}

/** Id YouTube depuis videoUrl ou miniature imageUrl/imageUrls. */
export function resolveFeedPostYoutubeVideoId(
  post: Pick<FeedPost, 'videoUrl' | 'imageUrl' | 'imageUrls'>
): string | null {
  const fromVideo = parseYoutubeVideoId(post.videoUrl);
  if (fromVideo) return fromVideo;
  for (const url of getFeedPostImageUrls(post)) {
    const fromThumb = parseYoutubeThumbnailVideoId(url);
    if (fromThumb) return fromThumb;
  }
  return null;
}

/** URL vidéo native (data:, blob:, mp4…) — exclut les liens YouTube. */
export function resolveFeedPostNativeVideoUrl(
  post: Pick<FeedPost, 'videoUrl'>
): string | null {
  const raw = post.videoUrl?.trim();
  if (!raw || parseYoutubeVideoId(raw)) return null;
  return raw;
}

export function feedPostHasImages(post: Pick<FeedPost, 'imageUrl' | 'imageUrls'>): boolean {
  return getFeedPostImageUrls(post).length > 0;
}

export function feedPostHasPlayableMedia(
  post: Pick<FeedPost, 'imageUrl' | 'imageUrls' | 'videoUrl'>
): boolean {
  return (
    Boolean(resolveFeedPostYoutubeVideoId(post)) ||
    Boolean(resolveFeedPostNativeVideoUrl(post)) ||
    getFeedPostNonYoutubeImageUrls(post).length > 0
  );
}
