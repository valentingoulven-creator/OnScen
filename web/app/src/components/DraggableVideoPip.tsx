import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

// 200 px wide → 200×113 video (16:9) — YouTube TOS minimum embed size.
export const VIDEO_PIP_WIDTH = 200;
export const VIDEO_PIP_HEADER_HEIGHT = 24;

/** 44×44px touch target within the compact PiP header bar. */
export const VIDEO_PIP_HEADER_BTN_CLASS =
  'shrink-0 -my-2.5 min-w-11 min-h-11 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition touch-manipulation';

const MARGIN = 16;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Default PiP position — right of map sidebar, below header. */
export function defaultVideoPipPos(): { x: number; y: number } {
  return { x: 237, y: 224 };
}

export interface VideoPipFloatApi {
  position: { x: number; y: number };
  onHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function useDraggableVideoPip(
  active: boolean,
  onClose: () => void,
  initialPosition?: () => { x: number; y: number },
  /** When this value changes, position resets to initial (e.g. live id). */
  resetKey?: string | number,
): VideoPipFloatApi {
  const initialPositionRef = useRef(initialPosition ?? defaultVideoPipPos);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => initialPositionRef.current());
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

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

  // Reset to default on each activation (false → true) and on first mount when already active.
  const prevActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    if (active && !wasActive) {
      setPos(initialPositionRef.current());
    }
  }, [active]);

  useEffect(() => {
    if (resetKey === undefined) return;
    setPos(initialPositionRef.current());
  }, [resetKey]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const next = clampToViewport(current.x, current.y);
        // Return same reference when coords are unchanged to avoid a gratuitous re-render (#185)
        if (next.x === current.x && next.y === current.y) return current;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToViewport]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag?.active || e.pointerId !== drag.pointerId) return;
      setPos(clampToViewport(e.clientX - drag.offsetX, e.clientY - drag.offsetY));
    },
    [clampToViewport]
  );

  const endPointer = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
  }, []);

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

/** PiP header × — host : confirmation avant arrêt ; spectateur : quitte sans confirmation. */
export function LiveVideoPipCloseButton({
  isHost,
  onDismiss,
}: {
  isHost: boolean;
  onDismiss: () => void | Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const runDismiss = async () => {
    setDismissing(true);
    try {
      await onDismiss();
      setConfirmOpen(false);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          if (isHost) {
            setConfirmOpen(true);
            return;
          }
          void runDismiss();
        }}
        className={VIDEO_PIP_HEADER_BTN_CLASS}
        title={isHost ? 'Arrêter le live' : 'Quitter le live'}
        aria-label={isHost ? 'Arrêter le live' : 'Quitter le live'}
      >
        <span className="text-base leading-none" aria-hidden>
          ×
        </span>
      </button>
      {isHost ? (
        <ConfirmModal
          open={confirmOpen}
          title="Arrêter le live ?"
          description="Le live sera coupé pour tous les spectateurs. Cette action est définitive."
          confirmLabel="Arrêter le live"
          cancelLabel="Annuler"
          loading={dismissing}
          loadingLabel="Arrêt…"
          onCancel={() => {
            if (!dismissing) setConfirmOpen(false);
          }}
          onConfirm={() => void runDismiss()}
        />
      ) : null}
    </>
  );
}
