import { useCallback, useRef, type TouchEvent as ReactTouchEvent } from 'react';

export interface UseHorizontalSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Horizontal swipe detection for touch. Ignores gestures that are predominantly vertical
 * so parent scroll containers keep working.
 */
export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: UseHorizontalSwipeHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'horizontal' | 'vertical' | null>(null);
  const handlersRef = useRef({ onSwipeLeft, onSwipeRight, threshold, enabled });
  handlersRef.current = { onSwipeLeft, onSwipeRight, threshold, enabled };

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
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
  }, []);

  const onTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (!handlersRef.current.enabled) return;
    const start = startRef.current;
    startRef.current = null;
    if (!start || axisRef.current !== 'horizontal') {
      axisRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    if (!t) {
      axisRef.current = null;
      return;
    }
    const dx = t.clientX - start.x;
    const { onSwipeLeft: left, onSwipeRight: right, threshold: th } = handlersRef.current;
    if (dx < -th) left?.();
    else if (dx > th) right?.();
    axisRef.current = null;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
