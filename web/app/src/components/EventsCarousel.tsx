import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from './EventCard';
import { HorizontalScrollCarousel } from './HorizontalScrollCarousel';
import type { FeedPost } from '../types';

export interface EventsCarouselProps {
  posts: FeedPost[];
  onOpen: (post: FeedPost) => void;
  onShare?: (post: FeedPost) => void;
  getExtraBadges?: (post: FeedPost) => ReactNode;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
}

/** Carrousel horizontal d'événements (même layout que « Prochains événements »). */
export function EventsCarousel({ posts, onOpen, onShare, getExtraBadges, onPostChange }: EventsCarouselProps) {
  const { t } = useTranslation();

  if (posts.length === 0) return null;

  return (
    <HorizontalScrollCarousel
      itemCount={posts.length}
      ariaPrevLabel={t('feed.carouselPrev')}
      ariaNextLabel={t('feed.carouselNext')}
      scrollClassName="events-carousel ms-hscroll-track min-w-0 w-full flex flex-nowrap gap-3 pb-1"
    >
      {posts.map((post) => (
        <EventCard
          key={post.id}
          post={post}
          onOpen={onOpen}
          onShare={onShare}
          layout="carousel"
          compact={false}
          extraBadges={getExtraBadges?.(post)}
          onPostChange={(patch) => onPostChange?.(post.id, patch)}
        />
      ))}
    </HorizontalScrollCarousel>
  );
}
