import { useEffect, useState } from 'react';
import { getFeedPostImageUrls } from '../lib/feedPostMedia';
import type { FeedPost } from '../types';
import { FeedPostImageGallery } from './FeedPostImageGallery';

interface FeedPostImagesPreviewProps {
  post: Pick<FeedPost, 'id' | 'imageUrl' | 'imageUrls'>;
  label?: string;
}

/** Images d'une publication dans le fil (unique ou galerie). */
export function FeedPostImagesPreview({ post, label = 'Publication' }: FeedPostImagesPreviewProps) {
  const urls = getFeedPostImageUrls(post);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [post.id, urls.join('|')]);

  if (urls.length === 0) return null;

  return (
    <FeedPostImageGallery
      urls={urls}
      index={index}
      onIndexChange={setIndex}
      label={label}
      variant="feed"
    />
  );
}
