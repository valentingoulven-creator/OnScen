import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const POS_KEY = 'salon_video_pip_pos';
const PIP_WIDTH = 320;
const HEADER_HEIGHT = 32;
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
  const videoH = Math.round((PIP_WIDTH * 9) / 16);
  const totalH = HEADER_HEIGHT + videoH;
  return {
    x: clamp(w - PIP_WIDTH - MARGIN, MARGIN, w - PIP_WIDTH),
    y: clamp(h - totalH - MARGIN, MARGIN, h - totalH),
  };
}

export interface DraggableVideoPipProps {
  onClose: () => void;
  /** Conteneur cible pour le portail du lecteur YouTube. */
  onMount: (el: HTMLElement | null) => void;
  title?: string;
}

export function DraggableVideoPip({ onClose, onMount, title = 'Vidéo' }: DraggableVideoPipProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => readPosition() ?? defaultBottomRight());
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    onMount(mountRef.current);
    return () => onMount(null);
  }, [onMount]);

  const persistPos = useCallback((p: { x: number; y: number }) => {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const clampToViewport = useCallback((x: number, y: number) => {
    const videoH = Math.round((PIP_WIDTH * 9) / 16);
    const totalH = HEADER_HEIGHT + videoH;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: clamp(x, MARGIN, Math.max(MARGIN, vw - PIP_WIDTH - MARGIN)),
      y: clamp(y, MARGIN, Math.max(MARGIN, vh - totalH - MARGIN)),
    };
  }, []);

  useEffect(() => {
    if (pos === null) return;
    const next = clampToViewport(pos.x, pos.y);
    if (next.x !== pos.x || next.y !== pos.y) {
      setPos(next);
      persistPos(next);
    }
  }, [pos, clampToViewport, persistPos]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        if (!current) return current;
        const next = clampToViewport(current.x, current.y);
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
      const x = e.clientX - drag.offsetX;
      const y = e.clientY - drag.offsetY;
      setPos(clampToViewport(x, y));
    },
    [clampToViewport]
  );

  const endPointer = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag?.active || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setPos((current) => {
        if (current) persistPos(current);
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

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = windowRef.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  };

  if (typeof document === 'undefined') return null;

  const positionStyle: React.CSSProperties =
    pos !== null ? { left: pos.x, top: pos.y } : { visibility: 'hidden' };

  return createPortal(
    <div
      ref={windowRef}
      className="salon-video-pip fixed z-[60] flex flex-col rounded-xl shadow-2xl overflow-hidden border border-[#2a2a36] bg-[#0b0b0f] pointer-events-auto"
      style={{ ...positionStyle, width: PIP_WIDTH }}
      role="dialog"
      aria-label={title}
    >
      <div
        className="salon-video-pip__header shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-[#2a2a36] bg-[#14141c]/95 cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={onHeaderPointerDown}
      >
        <span className="text-[10px] text-purple-400/80 leading-none shrink-0" aria-hidden>
          ⠿
        </span>
        <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
          {title}
        </p>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
          title="Ancrer la vidéo"
          aria-label="Ancrer la vidéo"
        >
          ↙
        </button>
      </div>
      <div ref={mountRef} className="salon-video-pip__stage relative w-full aspect-video bg-black min-h-0" />
    </div>,
    document.body
  );
}
