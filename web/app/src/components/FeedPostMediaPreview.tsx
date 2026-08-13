import type { FeedPost } from '../types';
import {
  getFeedPostNonYoutubeImageUrls,
  resolveFeedPostNativeVideoUrl,
  resolveFeedPostYoutubeVideoId,
} from '../lib/feedPostMedia';
import { FeedPostImagesPreview } from './FeedPostImagesPreview';
import { FeedPostNativeVideo } from './FeedPostNativeVideo';
import { FeedPostYoutubePlayer } from './FeedPostYoutubePlayer';

type FeedPostMediaPreviewProps = {
  post: Pick<FeedPost, 'id' | 'imageUrl' | 'imageUrls' | 'videoUrl'>;
  label?: string;
  variant?: 'feed' | 'modal';
  initialImageIndex?: number;
};

/**
 * Médias publication fil : YouTube (miniature ou URL), vidéo native, galerie images.
 * Lecture inline avec pause + mute (web + tel).
 */
export function FeedPostMediaPreview({
  post,
  label = 'Publication',
  variant = 'feed',
  initialImageIndex = 0,
}: FeedPostMediaPreviewProps) {
  const youtubeId = resolveFeedPostYoutubeVideoId(post);
  const nativeVideoUrl = resolveFeedPostNativeVideoUrl(post);
  const imageUrls = getFeedPostNonYoutubeImageUrls(post);

  if (!youtubeId && !nativeVideoUrl && imageUrls.length === 0) return null;

  return (
    <div className="space-y-2">
      {youtubeId ? <FeedPostYoutubePlayer videoId={youtubeId} variant={variant} /> : null}
      {nativeVideoUrl ? <FeedPostNativeVideo src={nativeVideoUrl} variant={variant} /> : null}
      {imageUrls.length > 0 ? (
        <FeedPostImagesPreview
          post={{ ...post, imageUrl: undefined, imageUrls }}
          label={label}
          variant={variant}
          initialIndex={initialImageIndex}
        />
      ) : null}
    </div>
  );
}
