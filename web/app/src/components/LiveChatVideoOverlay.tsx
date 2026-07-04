/**
 * Chat en overlay flottant, superposé à la vidéo du live — option personnelle
 * (hôte ou spectateur), déplaçable au doigt/souris, sans persistance serveur.
 * Style volontairement "sans fond" (texte + ombre) pour ne pas masquer la vidéo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useOptionalChatRoomFeed } from './ChatPanel';
import { UsernameDisplay } from './UsernameDisplay';

const OVERLAY_MARGIN_PX = 6;
const DEFAULT_POS: OverlayPos = { xPct: 0.04, yPct: 0.06 };
const MAX_MESSAGES = 30;

interface OverlayPos {
  xPct: number;
  yPct: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function useDraggableChatOverlay(
  containerRef: RefObject<HTMLElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
  active: boolean
) {
  const [pos, setPos] = useState<OverlayPos>(DEFAULT_POS);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  const clampPct = useCallback(
    (xPct: number, yPct: number): OverlayPos => {
      const container = containerRef.current;
      const overlay = overlayRef.current;
      if (!container || !overlay) return { xPct: clamp(xPct, 0, 1), yPct: clamp(yPct, 0, 1) };
      const cRect = container.getBoundingClientRect();
      const oRect = overlay.getBoundingClientRect();
      if (cRect.width <= 0 || cRect.height <= 0) return { xPct, yPct };
      const marginXPct = OVERLAY_MARGIN_PX / cRect.width;
      const marginYPct = OVERLAY_MARGIN_PX / cRect.height;
      const maxXPct = Math.max(marginXPct, 1 - oRect.width / cRect.width - marginXPct);
      const maxYPct = Math.max(marginYPct, 1 - oRect.height / cRect.height - marginYPct);
      return {
        xPct: clamp(xPct, marginXPct, maxXPct),
        yPct: clamp(yPct, marginYPct, maxYPct),
      };
    },
    [containerRef, overlayRef]
  );

  // Re-clamp once the overlay has its real measured size, and on activation.
  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => setPos((p) => clampPct(p.xPct, p.yPct)));
    return () => cancelAnimationFrame(raf);
  }, [active, clampPct]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => setPos((p) => clampPct(p.xPct, p.yPct));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, clampPct]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      if (cRect.width <= 0 || cRect.height <= 0) return;
      const dxPct = (e.clientX - drag.startClientX) / cRect.width;
      const dyPct = (e.clientY - drag.startClientY) / cRect.height;
      setPos(clampPct(drag.startXPct + dxPct, drag.startYPct + dyPct));
    },
    [containerRef, clampPct]
  );

  const endPointer = useCallback((e: PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPointer);
      window.removeEventListener('pointercancel', endPointer);
    };
  }, [active, onPointerMove, endPointer]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXPct: pos.xPct,
        startYPct: pos.yPct,
      };
    },
    [pos.xPct, pos.yPct]
  );

  return { pos, onHandlePointerDown };
}

interface OverlayLine {
  id: string;
  senderName: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  content: string;
}

export function LiveChatVideoOverlay({
  containerRef,
  active,
  onClose,
}: {
  /** Zone vidéo servant de repère pour le glisser-déposer (ex. .live-video-stage-area). */
  containerRef: RefObject<HTMLElement | null>;
  active: boolean;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const { pos, onHandlePointerDown } = useDraggableChatOverlay(containerRef, overlayRef, active);
  const chatRoom = useOptionalChatRoomFeed();

  const messages = useMemo<OverlayLine[]>(() => {
    if (!chatRoom) return [];
    const out: OverlayLine[] = [];
    for (const item of chatRoom.feed) {
      if (item.kind !== 'message') continue;
      const m = item.data;
      out.push({
        id: m.id,
        senderName: m.senderName,
        usernameColor: m.senderUsernameColor,
        usernameWaveFrom: m.senderUsernameWaveFrom,
        usernameWaveTo: m.senderUsernameWaveTo,
        content: m.content || (m.attachmentUrl ? '📎 Pièce jointe' : ''),
      });
    }
    return out.slice(-MAX_MESSAGES);
  }, [chatRoom]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages.length]);

  if (!active || !chatRoom) return null;

  return (
    <div
      ref={overlayRef}
      className="live-chat-video-overlay absolute z-30 pointer-events-auto select-none"
      style={{ left: `${pos.xPct * 100}%`, top: `${pos.yPct * 100}%`, width: 'min(66%, 260px)' }}
    >
      <div
        className="flex items-center gap-1 mb-1 w-fit rounded-full bg-black/25 px-2 py-1 opacity-70 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={onHandlePointerDown}
      >
        <span className="text-[10px] text-white/80 leading-none" aria-hidden>
          ⠿
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">Chat</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="ml-0.5 w-4 h-4 flex items-center justify-center rounded text-white/70 hover:text-white text-[11px] leading-none"
          aria-label="Masquer le chat sur la vidéo"
          title="Masquer le chat sur la vidéo"
        >
          ×
        </button>
      </div>
      <div
        ref={feedRef}
        className="live-chat-video-overlay__feed flex flex-col gap-1 max-h-[32dvh] sm:max-h-[38dvh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {messages.map((m) => (
          <p
            key={m.id}
            className="live-chat-video-overlay__line text-[12px] leading-snug break-words text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.7)]"
          >
            <UsernameDisplay
              username={m.senderName}
              usernameColor={m.usernameColor}
              usernameWaveFrom={m.usernameWaveFrom}
              usernameWaveTo={m.usernameWaveTo}
              className="font-bold"
            />
            {m.content ? <span className="ml-1">{m.content}</span> : null}
          </p>
        ))}
      </div>
    </div>
  );
}
