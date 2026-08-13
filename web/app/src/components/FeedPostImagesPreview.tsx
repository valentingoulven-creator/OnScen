import { useEffect, useState } from 'react';
import { getFeedPostImageUrls } from '../lib/feedPostMedia';
import type { FeedPost } from '../types';
import { FeedPostImageGallery } from './FeedPostImageGallery';

interface FeedPostImagesPreviewProps {
  post: Pick<FeedPost, 'id' | 'imageUrl' | 'imageUrls'>;
  label?: string;
  variant?: 'feed' | 'modal';
  initialIndex?: number;
}

/** Images d'une publication dans le fil (unique ou galerie). */
export function FeedPostImagesPreview({
  post,
  label = 'Publication',
  variant = 'feed',
  initialIndex = 0,
}: FeedPostImagesPreviewProps) {
  const urls = getFeedPostImageUrls(post);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [post.id, urls.join('|'), initialIndex]);

  if (urls.length === 0) return null;

  return (
    <FeedPostImageGallery
      urls={urls}
      index={index}
      onIndexChange={setIndex}
      label={label}
      variant={variant}
    />
  );
}
