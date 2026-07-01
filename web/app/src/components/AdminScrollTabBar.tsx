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

export interface AdminScrollTabBarProps {
  children: ReactNode;
  className?: string;
  variant?: 'pills' | 'underline';
  'aria-label': string;
  ariaPrevLabel?: string;
  ariaNextLabel?: string;
}

const SCROLL_EDGE_EPS = 4;

const adminTabArrowClass =
  'absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-9 h-9 rounded-full border backdrop-blur-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 shadow-[0_0_10px_rgba(0,0,0,0.35)]';

/**
 * Barre d'onglets admin — pills (wrap, tout visible) ou underline (scroll horizontal).
 * Le variant underline défile sans scrollbar visible : dégradés + flèches latérales.
 */
export function AdminScrollTabBar({
  children,
  className = '',
  variant = 'pills',
  'aria-label': ariaLabel,
  ariaPrevLabel = 'Onglets précédents',
  ariaNextLabel = 'Onglets suivants',
}: AdminScrollTabBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > SCROLL_EDGE_EPS);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE_EPS);
  }, []);

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const el = navRef.current;
    if (!el) return;
    const firstTab = el.querySelector('.ms-admin-tab-bar__inner > *') as HTMLElement | null;
    const amount = firstTab ? Math.max(firstTab.offsetWidth, el.clientWidth * 0.45) : el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (variant !== 'underline') return;
    const el = navRef.current;
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
  }, [variant, updateScrollState, children]);

  const isUnderline = variant === 'underline';

  const wrapClass = [
    'ms-admin-tab-bar-wrap',
    isUnderline ? 'ms-admin-tab-bar-wrap--underline' : '',
    isUnderline ? 'ms-hscroll-fade-wrap' : '',
    isUnderline && canScrollLeft ? 'ms-hscroll-fade-wrap--can-left' : '',
    isUnderline && canScrollRight ? 'ms-hscroll-fade-wrap--can-right' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      {isUnderline ? (
        <>
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            disabled={!canScrollLeft}
            className={`${adminTabArrowClass} left-0 ${
              canScrollLeft
                ? 'bg-[#0b0b0f]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/35 opacity-100'
                : 'bg-[#0b0b0f]/40 border-purple-500/10 text-purple-400/20 pointer-events-none opacity-0'
            }`}
            aria-label={ariaPrevLabel}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            disabled={!canScrollRight}
            className={`${adminTabArrowClass} right-0 ${
              canScrollRight
                ? 'bg-[#0b0b0f]/95 border-purple-500/45 text-purple-200 hover:border-purple-400/70 hover:text-white hover:bg-purple-900/35 opacity-100'
                : 'bg-[#0b0b0f]/40 border-purple-500/10 text-purple-400/20 pointer-events-none opacity-0'
            }`}
            aria-label={ariaNextLabel}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </>
      ) : null}
      <nav
        ref={navRef}
        className={`ms-admin-tab-bar${isUnderline ? ' ms-admin-tab-bar--underline' : ''}`}
        aria-label={ariaLabel}
        role="tablist"
      >
        <div className="ms-admin-tab-bar__inner">{children}</div>
      </nav>
    </div>
  );
}
