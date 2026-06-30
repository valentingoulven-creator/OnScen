import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

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

/** Distance de scroll = (largeur item + gap) × stepCount. */
export function computeHorizontalScrollAmount(
  itemWidth: number,
  gap: number,
  stepCount: number
): number {
  return (itemWidth + gap) * stepCount;
}

export interface HorizontalScrollCarouselProps {
  children: ReactNode;
  itemCount: number;
  ariaPrevLabel: string;
  ariaNextLabel: string;
  scrollClassName?: string;
  /** Nombre d'items par clic flèche (défaut 1). */
  scrollStepCount?: number;
  /** Dégradés latéraux quand le contenu défile (défaut true). */
  fadeEdges?: boolean;
}

/** Carrousel horizontal avec flèches (scroll d'une carte à la fois). */
export function HorizontalScrollCarousel({
  children,
  itemCount,
  ariaPrevLabel,
  ariaNextLabel,
  scrollClassName = 'ms-hscroll-track min-w-0 w-full flex flex-nowrap gap-3 pb-1 overflow-x-auto',
  scrollStepCount = 1,
  fadeEdges = true,
}: HorizontalScrollCarouselProps) {
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

    const sync = () => updateScrollState();
    sync();
    const raf = requestAnimationFrame(sync);

    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [itemCount, updateScrollState]);

  const scrollByCard = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const firstCard = el.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '12') || 12;
      const amount = computeHorizontalScrollAmount(firstCard.offsetWidth, gap, scrollStepCount);
      el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    },
    [scrollStepCount]
  );

  const showArrows = itemCount > 1;
  const arrowBtnClass =
    'absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-full border backdrop-blur-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60';

  const fadeWrapClass = [
    'relative min-w-0 w-full group/carousel',
    fadeEdges ? 'ms-hscroll-fade-wrap' : '',
    fadeEdges && canScrollLeft ? 'ms-hscroll-fade-wrap--can-left' : '',
    fadeEdges && canScrollRight ? 'ms-hscroll-fade-wrap--can-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={fadeWrapClass}>
      {showArrows ? (
        <>
          <button
            type="button"
            onClick={() => scrollByCard('left')}
            disabled={!canScrollLeft}
            className={`${arrowBtnClass} left-0.5 sm:left-1 shadow-[0_0_12px_rgba(0,0,0,0.45)] ${
              canScrollLeft
                ? 'bg-[#12121a]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/40 opacity-100'
                : 'bg-[#12121a]/50 border-purple-500/15 text-purple-400/25 pointer-events-none opacity-0'
            }`}
            aria-label={ariaPrevLabel}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard('right')}
            disabled={!canScrollRight}
            className={`${arrowBtnClass} right-0.5 sm:right-1 shadow-[0_0_12px_rgba(0,0,0,0.45)] ${
              canScrollRight
                ? 'bg-[#12121a]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/40 opacity-100'
                : 'bg-[#12121a]/50 border-purple-500/15 text-purple-400/25 pointer-events-none opacity-0'
            }`}
            aria-label={ariaNextLabel}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </>
      ) : null}

      <div ref={scrollRef} className={scrollClassName}>
        {children}
      </div>
    </div>
  );
}
