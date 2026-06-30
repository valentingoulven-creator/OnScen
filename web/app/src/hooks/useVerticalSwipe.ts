import { useCallback, useRef, type TouchEvent as ReactTouchEvent } from 'react';

export interface UseVerticalSwipeHandlers {
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Vertical swipe-down detection for touch. Ignores gestures that are predominantly horizontal.
 */
export function useVerticalSwipe({
  onSwipeDown,
  threshold = 80,
  enabled = true,
}: UseVerticalSwipeHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'horizontal' | 'vertical' | null>(null);
  const handlersRef = useRef({ onSwipeDown, threshold, enabled });
  handlersRef.current = { onSwipeDown, threshold, enabled };

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    if (!handlersRef.current.enabled) return;
    const t = e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
    axisRef.current = null;
  }, []);

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!handlersRef.current.enabled || !startRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    if (axisRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisRef.current = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
    }
  }, []);

  const onTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (!handlersRef.current.enabled) return;
    const start = startRef.current;
    startRef.current = null;
    if (!start || axisRef.current !== 'vertical') {
      axisRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    if (!t) {
      axisRef.current = null;
      return;
    }
    const dy = t.clientY - start.y;
    const { onSwipeDown: down, threshold: th } = handlersRef.current;
    if (dy > th) down?.();
    axisRef.current = null;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
