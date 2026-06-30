import { useLayoutEffect, useState, type RefObject } from 'react';

import {
  ANCHORED_POPOVER_VIEWPORT_PAD,
  clampAnchoredPopoverPosition,
} from '../lib/anchoredPopoverPosition';

type UseAnchoredPopoverPositionOptions = {
  estimatedWidth?: number;
  estimatedHeight?: number;
  preferAbove?: boolean;
};

export function useAnchoredPopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
  options: UseAnchoredPopoverPositionOptions = {},
): { top: number; left: number } | null {
  const { estimatedWidth = 288, estimatedHeight = 240, preferAbove = false } = options;
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }

    const update = () => {
      const btn = anchorRef.current;
      if (!btn) return;
      const anchor = btn.getBoundingClientRect();
      const panel = panelRef.current;
      const w = panel?.offsetWidth ?? estimatedWidth;
      const h = panel?.offsetHeight ?? estimatedHeight;
      setPanelPos(clampAnchoredPopoverPosition(anchor, w, h, preferAbove));
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps drive remeasure when panel content changes
  }, [open, anchorRef, panelRef, estimatedWidth, estimatedHeight, preferAbove, ...deps]);

  return panelPos;
}

export { ANCHORED_POPOVER_VIEWPORT_PAD };
