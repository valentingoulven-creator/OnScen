import { useCallback, useEffect, useRef, useState } from 'react';

const POS_KEY = 'salon_video_pip_pos';
// 240 px wide → 240×135 video (16:9). YouTube TOS minimum is 200×113; 240 gives a
// comfortable margin while keeping the PiP as small as possible.
export const VIDEO_PIP_WIDTH = 240;
export const VIDEO_PIP_HEADER_HEIGHT = 24;
const MARGIN = 12;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readPosition(): { x: number; y: number } | null {
  try {
    const raw = sessionStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function defaultBottomRight(): { x: number; y: number } {
  const w = typeof window !== 'undefined' ? window.innerWidth : 800;
  const h = typeof window !== 'undefined' ? window.innerHeight : 600;
  const videoH = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
  const totalH = VIDEO_PIP_HEADER_HEIGHT + videoH;
  return {
    x: clamp(w - VIDEO_PIP_WIDTH - MARGIN, MARGIN, w - VIDEO_PIP_WIDTH),
    y: clamp(h - totalH - MARGIN, MARGIN, h - totalH),
  };
}

export interface VideoPipFloatApi {
  position: { x: number; y: number };
  onHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function useDraggableVideoPip(active: boolean, onClose: () => void): VideoPipFloatApi {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => readPosition() ?? defaultBottomRight());
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const persistPos = useCallback((p: { x: number; y: number }) => {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const clampToViewport = useCallback((x: number, y: number) => {
    const videoH = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
    const totalH = VIDEO_PIP_HEADER_HEIGHT + videoH;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: clamp(x, MARGIN, Math.max(MARGIN, vw - VIDEO_PIP_WIDTH - MARGIN)),
      y: clamp(y, MARGIN, Math.max(MARGIN, vh - totalH - MARGIN)),
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    setPos((current) => {
      const next = clampToViewport(current.x, current.y);
      // Return same reference when coords are unchanged to avoid a gratuitous re-render (#185)
      if (next.x === current.x && next.y === current.y) return current;
      persistPos(next);
      return next;
    });
  }, [active, clampToViewport, persistPos]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const next = clampToViewport(current.x, current.y);
        // Return same reference when coords are unchanged to avoid a gratuitous re-render (#185)
        if (next.x === current.x && next.y === current.y) return current;
        persistPos(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToViewport, persistPos]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag?.active || e.pointerId !== drag.pointerId) return;
      setPos(clampToViewport(e.clientX - drag.offsetX, e.clientY - drag.offsetY));
    },
    [clampToViewport]
  );

  const endPointer = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag?.active || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setPos((current) => {
        persistPos(current);
        return current;
      });
    },
    [persistPos]
  );

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPointer);
      window.removeEventListener('pointercancel', endPointer);
    };
  }, [onPointerMove, endPointer]);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
    };
  }, [pos.x, pos.y]);

  return {
    position: pos,
    onHeaderPointerDown,
    onClose,
  };
}
