import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const SCROLL_EDGE_EPS = 4;

export interface AdminScrollTabBarProps {
  children: ReactNode;
  className?: string;
  'aria-label': string;
  fadeEdges?: boolean;
}

/** Barre d'onglets admin : scroll horizontal, snap, dégradés latéraux optionnels. */
export function AdminScrollTabBar({
  children,
  className = '',
  'aria-label': ariaLabel,
  fadeEdges = true,
}: AdminScrollTabBarProps) {
  const scrollRef = useRef<HTMLElement>(null);
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
  }, [updateScrollState, children]);

  const wrapClass = [
    'ms-admin-tab-bar-wrap',
    fadeEdges ? 'ms-hscroll-fade-wrap' : '',
    fadeEdges && canScrollLeft ? 'ms-hscroll-fade-wrap--can-left' : '',
    fadeEdges && canScrollRight ? 'ms-hscroll-fade-wrap--can-right' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <nav ref={scrollRef} className="ms-admin-tab-bar" aria-label={ariaLabel}>
        <div className="ms-admin-tab-bar__inner">{children}</div>
      </nav>
    </div>
  );
}
