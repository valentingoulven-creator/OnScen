import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from './EventCard';
import type { FeedPost } from '../types';

export interface EventsCarouselProps {
  posts: FeedPost[];
  onOpen: (post: FeedPost) => void;
  onShare?: (post: FeedPost) => void;
  getExtraBadges?: (post: FeedPost) => ReactNode;
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}

const SCROLL_EDGE_EPS = 4;

/** Carrousel horizontal d'événements (même layout que « Prochains événements »). */
export function EventsCarousel({ posts, onOpen, onShare, getExtraBadges }: EventsCarouselProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > SCROLL_EDGE_EPS);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE_EPS);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [posts.length, updateScrollState]);

  const scrollByCard = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    if (!firstCard) return;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '12') || 12;
    const amount = firstCard.offsetWidth + gap;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  if (posts.length === 0) return null;

  const showArrows = posts.length > 1;
  const arrowBtnClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full border backdrop-blur-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

  return (
    <div className="relative min-w-0 w-full group/carousel">
      {showArrows ? (
        <>
          <button
            type="button"
            onClick={() => scrollByCard('left')}
            disabled={!canScrollLeft}
            className={`${arrowBtnClass} left-0 -translate-x-1 shadow-[0_0_12px_rgba(0,0,0,0.45)] ${
              canScrollLeft
                ? 'bg-[#12121a]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/40'
                : 'bg-[#12121a]/50 border-purple-500/15 text-purple-400/25 pointer-events-none opacity-0'
            }`}
            aria-label={t('feed.carouselPrev')}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('right')}
            disabled={!canScrollRight}
            className={`${arrowBtnClass} right-0 translate-x-1 shadow-[0_0_12px_rgba(0,0,0,0.45)] ${
              canScrollRight
                ? 'bg-[#12121a]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/40'
                : 'bg-[#12121a]/50 border-purple-500/15 text-purple-400/25 pointer-events-none opacity-0'
            }`}
            aria-label={t('feed.carouselNext')}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </>
      ) : null}

      <div
        ref={scrollRef}
        className="events-carousel min-w-0 w-full flex flex-nowrap gap-3 pb-1 -mx-3 px-3"
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
          />
        ))}
      </div>
    </div>
  );
}
