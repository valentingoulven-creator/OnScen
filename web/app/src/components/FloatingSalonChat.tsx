import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFloatingChatChromeAutoHide } from '../hooks/useFloatingChatChromeAutoHide';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';

const BG_KEY = STORAGE_KEYS.floatingChatBg;
const POS_KEY = STORAGE_KEYS.floatingChatPos;
const SIZE_KEY = STORAGE_KEYS.floatingChatSize;
const LEGACY_TRANSPARENT_KEY = STORAGE_KEYS.chatOverlayTransparent;

export type FloatingChatBg = 'transparent' | 'gray';

const CHAT_DEFAULT_WIDTH = 300;
const CHAT_DEFAULT_HEIGHT = 360;
const CHAT_MIN_WIDTH = 180;
const CHAT_MAX_WIDTH = 560;
const CHAT_MIN_HEIGHT = 140;
const CHAT_MAX_HEIGHT = 600;
const MARGIN = 12;

type ResizeAxis = 'corner' | 'left';

function readBgMode(): FloatingChatBg {
  try {
    const v = getStorageItem(BG_KEY);
    if (v === 'transparent' || v === 'gray') return v;
    if (getStorageItem(LEGACY_TRANSPARENT_KEY) === '1') return 'transparent';
  } catch {
    /* ignore */
  }
  return 'gray';
}

function readPosition(): { x: number; y: number } | null {
  try {
    const raw = getStorageItem(POS_KEY);
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

function readSize(): { width: number; height: number } | null {
  try {
    const raw = getStorageItem(SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: number; height?: number };
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return {
        width: clamp(parsed.width, CHAT_MIN_WIDTH, CHAT_MAX_WIDTH),
        height: clamp(parsed.height, CHAT_MIN_HEIGHT, CHAT_MAX_HEIGHT),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const HEADER_ICON_BTN =
  'shrink-0 w-11 h-11 flex items-center justify-center rounded transition touch-manipulation';
const HEADER_ICON_BTN_COMPACT = 'shrink-0 w-6 h-6 flex items-center justify-center rounded transition';

export interface FloatingSalonChatProps {
  children: ReactNode;
  title?: string;
  /** Actions juste avant « Masquer le chat » (ex. 📋 actions hôte live). */
  headerTrailingExtra?: ReactNode;
  headerExtra?: ReactNode;
  /** Live théâtre : masque les toggles fond transparent/gris ; garde headerExtra (participants/VIP). */
  compactHeader?: boolean;
  /** Épingler le chat en colonne gauche (live théâtre). */
  onTogglePin?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  onHide?: () => void;
}

export function FloatingSalonChat({
  children,
  title = 'Chat',
  headerTrailingExtra,
  headerExtra,
  compactHeader = false,
  onTogglePin,
  minimized = false,
  onToggleMinimize,
  onHide,
}: FloatingSalonChatProps) {
  const boundsRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const chromeAutoHideEnabled = !minimized;
  const { chromeVisible, revealChrome } = useFloatingChatChromeAutoHide(windowRef, chromeAutoHideEnabled);
  const [isNarrow, setIsNarrow] = useState(false);
  const [bgMode, setBgMode] = useState<FloatingChatBg>(readBgMode);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(readPosition);
  const [size, setSize] = useState<{ width: number; height: number }>(
    () => readSize() ?? { width: CHAT_DEFAULT_WIDTH, height: CHAT_DEFAULT_HEIGHT },
  );
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeRef = useRef<{
    active: boolean;
    pointerId: number;
    axis: ResizeAxis;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startPosX: number;
  } | null>(null);

  const persistBg = useCallback((mode: FloatingChatBg) => {
    try {
      setStorageItem(BG_KEY, mode);
      setStorageItem(LEGACY_TRANSPARENT_KEY, mode === 'transparent' ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const persistPos = useCallback((p: { x: number; y: number }) => {
    try {
      setStorageItem(POS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const persistSize = useCallback((s: { width: number; height: number }) => {
    try {
      setStorageItem(SIZE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const clampToBounds = useCallback(
    (x: number, y: number, w = size.width, h = minimized ? 40 : size.height) => {
      const parent = boundsRef.current;
      if (!parent) return { x, y };
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      return {
        x: clamp(x, MARGIN, Math.max(MARGIN, pw - w - MARGIN)),
        y: clamp(y, MARGIN, Math.max(MARGIN, ph - h - MARGIN)),
      };
    },
    [size.width, size.height, minimized],
  );

  const defaultBottomRight = useCallback(() => {
    const parent = boundsRef.current;
    if (!parent) return null;
    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const ew = size.width;
    const eh = minimized ? 40 : size.height;
    return clampToBounds(pw - ew - MARGIN, ph - eh - MARGIN, ew, eh);
  }, [clampToBounds, size.width, size.height, minimized]);

  useEffect(() => {
    if (pos !== null) return;
    const p = defaultBottomRight();
    if (p) setPos(p);
  }, [pos, defaultBottomRight, minimized]);

  useEffect(() => {
    if (pos === null) return;
    const next = clampToBounds(pos.x, pos.y);
    if (next.x !== pos.x || next.y !== pos.y) {
      setPos(next);
      persistPos(next);
    }
  }, [minimized, size, pos, clampToBounds, persistPos]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const base = current ?? defaultBottomRight();
        if (!base) return current;
        const next = clampToBounds(base.x, base.y);
        persistPos(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToBounds, persistPos, defaultBottomRight]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.active && e.pointerId === drag.pointerId) {
        revealChrome();
        const parent = boundsRef.current;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const x = e.clientX - rect.left - drag.offsetX;
        const y = e.clientY - rect.top - drag.offsetY;
        const next = clampToBounds(x, y);
        setPos(next);
        return;
      }

      const resize = resizeRef.current;
      if (resize?.active && e.pointerId === resize.pointerId) {
        revealChrome();
        const parent = boundsRef.current;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const maxW = Math.min(CHAT_MAX_WIDTH, parentRect.width - MARGIN * 2);
        const maxH = Math.min(CHAT_MAX_HEIGHT, parentRect.height - MARGIN * 2);

        if (resize.axis === 'left') {
          const deltaX = e.clientX - resize.startX;
          const nextWidth = clamp(resize.startWidth - deltaX, CHAT_MIN_WIDTH, maxW);
          const nextPosX = resize.startPosX + (resize.startWidth - nextWidth);
          setSize((current) => ({ ...current, width: nextWidth }));
          setPos((current) => {
            if (!current) return current;
            const next = clampToBounds(nextPosX, current.y, nextWidth, size.height);
            return next;
          });
        } else {
          const nextWidth = clamp(resize.startWidth + (e.clientX - resize.startX), CHAT_MIN_WIDTH, maxW);
          const nextHeight = clamp(resize.startHeight + (e.clientY - resize.startY), CHAT_MIN_HEIGHT, maxH);
          setSize({ width: nextWidth, height: nextHeight });
          setPos((current) => {
            if (!current) return current;
            const next = clampToBounds(current.x, current.y, nextWidth, nextHeight);
            return next;
          });
        }
      }
    },
    [clampToBounds, size.height, revealChrome],
  );

  const endPointer = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.active && e.pointerId === drag.pointerId) {
        dragRef.current = null;
        setPos((current) => {
          if (current) persistPos(current);
          return current;
        });
      }

      const resize = resizeRef.current;
      if (resize?.active && e.pointerId === resize.pointerId) {
        resizeRef.current = null;
        setSize((current) => {
          persistSize(current);
          return current;
        });
        setPos((current) => {
          if (current) persistPos(current);
          return current;
        });
      }
    },
    [persistPos, persistSize],
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

  useEffect(() => {
    const el = windowRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < 228);
    });
    observer.observe(el);
    setIsNarrow(el.clientWidth < 228);
    return () => observer.disconnect();
  }, [minimized, size.width]);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    revealChrome();
    const parent = boundsRef.current;
    const el = windowRef.current;
    if (!parent || !el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let currentX = pos?.x ?? elRect.left - parentRect.left;
    let currentY = pos?.y ?? elRect.top - parentRect.top;
    const clamped = clampToBounds(currentX, currentY);
    currentX = clamped.x;
    currentY = clamped.y;
    setPos({ x: currentX, y: currentY });

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      offsetX: e.clientX - elRect.left,
      offsetY: e.clientY - elRect.top,
    };
  };

  const onResizePointerDown =
    (axis: ResizeAxis) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || minimized) return;
      revealChrome();
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        active: true,
        pointerId: e.pointerId,
        axis,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: size.width,
        startHeight: size.height,
        startPosX: pos?.x ?? 0,
      };
    };

  const shellClass = 'bg-transparent border-transparent shadow-none';

  const headerClass =
    bgMode === 'transparent' ? 'bg-black/25 backdrop-blur-sm border-white/10' : 'bg-[#14141c]/80 border-[#2a2a36]';

  const positionStyle: React.CSSProperties =
    pos !== null ? { left: pos.x, top: pos.y } : { visibility: 'hidden' as const };

  return (
    <div ref={boundsRef} className="floating-salon-chat-bounds pointer-events-none absolute inset-0 z-[50]">
      <div
        ref={windowRef}
        className={`floating-salon-chat pointer-events-auto absolute flex flex-col rounded-xl overflow-hidden ${shellClass}`}
        data-chrome-hidden={chromeAutoHideEnabled && !chromeVisible ? 'true' : undefined}
        data-narrow={isNarrow ? 'true' : undefined}
        style={{
          ...positionStyle,
          width: size.width,
          maxWidth: `min(${size.width}px, calc(100% - ${MARGIN * 2}px))`,
          height: minimized ? undefined : size.height,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={`floating-salon-chat__header shrink-0 relative z-[2] flex items-center gap-0.5 min-w-0 px-2.5 py-1.5 border-b cursor-grab active:cursor-grabbing select-none touch-none ${headerClass}`}
          onPointerDown={onHeaderPointerDown}
        >
          <div className="shrink-0 flex items-center gap-0.5 min-w-0 max-w-[42%]">
            <span className="text-purple-400 text-[10px] leading-none shrink-0" aria-hidden>
              ⠿
            </span>
            <span className="text-purple-400 text-[10px] leading-none shrink-0" aria-hidden>
              💬
            </span>
            <p
              className={`floating-salon-chat__title-text min-w-0 truncate text-[9px] font-bold text-purple-400 uppercase tracking-widest ${
                compactHeader ? 'sr-only' : ''
              }`}
            >
              {title}
            </p>
          </div>

          <div className="flex-1 min-w-0" aria-hidden />

          <div
            className="floating-salon-chat__header-actions shrink-0 flex items-center gap-0.5 min-w-0 max-w-[58%] overflow-x-auto overscroll-x-contain"
            onPointerDown={(e) => e.stopPropagation()}
          >
          {headerExtra ? headerExtra : null}

          {!compactHeader ? (
            <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setBgMode('transparent');
              persistBg('transparent');
            }}
            title="Fond transparent"
            className={`shrink-0 w-6 h-6 flex items-center justify-center rounded transition ${
              bgMode === 'transparent'
                ? 'text-purple-300 bg-purple-900/40'
                : 'text-gray-500 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Fond transparent"
            aria-pressed={bgMode === 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="3" y1="9" x2="9" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setBgMode('gray');
              persistBg('gray');
            }}
            title="Fond gris"
            className={`shrink-0 w-6 h-6 flex items-center justify-center rounded transition ${
              bgMode === 'gray'
                ? 'text-purple-300 bg-purple-900/40'
                : 'text-gray-500 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Fond gris"
            aria-pressed={bgMode === 'gray'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
            </>
          ) : null}

          {onTogglePin && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onTogglePin}
              title="Épingler à gauche"
              className={`${compactHeader ? HEADER_ICON_BTN : HEADER_ICON_BTN_COMPACT} text-gray-500 hover:text-amber-300 hover:bg-white/10`}
              aria-label="Épingler le chat à gauche"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M6 1v7M4 3l2-2 2 2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M3 8h6v3H3z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          )}

          {onToggleMinimize && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleMinimize}
              title={minimized ? 'Agrandir' : 'Réduire'}
              className={`${compactHeader ? HEADER_ICON_BTN : HEADER_ICON_BTN_COMPACT} text-gray-500 hover:text-white hover:bg-white/10`}
              aria-label={minimized ? 'Agrandir le chat' : 'Réduire le chat'}
              aria-expanded={!minimized}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                {minimized ? (
                  <polyline
                    points="1,7 5,3 9,7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <polyline
                    points="1,3 5,7 9,3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>
          )}

          {headerTrailingExtra ? (
            <div className="shrink-0 flex items-center">{headerTrailingExtra}</div>
          ) : null}

          {onHide && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onHide}
              className={`${compactHeader ? HEADER_ICON_BTN : HEADER_ICON_BTN_COMPACT} text-gray-500 hover:text-white hover:bg-white/10 text-lg leading-none`}
              aria-label="Masquer le chat"
            >
              ×
            </button>
          )}
          </div>
        </div>

        {!minimized && (
          <div className="floating-salon-chat__body relative flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
            <div
              role="separator"
              aria-label="Redimensionner la largeur"
              onPointerDown={onResizePointerDown('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-11 cursor-ew-resize touch-none flex items-center justify-center"
              title="Redimensionner la largeur"
            >
              <span
                className="w-0.5 h-10 rounded-full bg-white/25 pointer-events-none"
                aria-hidden
              />
            </div>
            <div
              role="separator"
              aria-label="Redimensionner le chat"
              onPointerDown={onResizePointerDown('corner')}
              className="absolute bottom-0 right-0 z-10 w-11 h-11 cursor-nwse-resize touch-none flex items-end justify-end"
              title="Redimensionner"
            >
              <svg
                viewBox="0 0 16 16"
                className="mb-1.5 mr-1.5 w-3 h-3 text-gray-500/80 pointer-events-none"
                fill="none"
                aria-hidden
              >
                <path d="M14 14L6 14M14 14L14 6M14 14L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
