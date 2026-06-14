import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SalonQueueItem } from '../types';

/** Nombre max de morceaux affichés dans le panneau host (file d'attente). */
export const SALON_QUEUE_DISPLAY_MAX = 50;

interface SalonQueueSectionProps {
  queue: SalonQueueItem[];
  isHost: boolean;
  allowQueue: boolean;
  onSkip?: () => void;
  onPlayItem?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  skipping?: boolean;
  reordering?: boolean;
  compact?: boolean;
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function QueueDragHandle({
  label,
  disabled,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  label: string;
  disabled?: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="shrink-0 p-1 -ml-0.5 rounded-md text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none select-none disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

export function SalonQueueSection({
  queue,
  isHost,
  allowQueue,
  onSkip,
  onPlayItem,
  onReorder,
  skipping,
  reordering,
  compact,
}: SalonQueueSectionProps) {
  const { t } = useTranslation();
  const visibleQueue = queue.slice(0, SALON_QUEUE_DISPLAY_MAX);
  const hiddenCount = queue.length - visibleQueue.length;
  const listMaxHeight = compact ? 'max-h-[min(40vh,20rem)]' : 'max-h-[min(50vh,28rem)]';
  const canReorder = !!onReorder && visibleQueue.length > 1;

  const listRef = useRef<HTMLUListElement>(null);
  const draggingIdRef = useRef<string | null>(null);
  const previewQueueRef = useRef<SalonQueueItem[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewQueue, setPreviewQueue] = useState<SalonQueueItem[] | null>(null);

  useEffect(() => {
    if (!draggingIdRef.current) {
      previewQueueRef.current = null;
      setPreviewQueue(null);
    }
  }, [visibleQueue]);

  const displayQueue = previewQueue ?? visibleQueue;

  const findDropIndex = useCallback((clientY: number): number => {
    const list = listRef.current;
    if (!list) return 0;
    const rows = list.querySelectorAll<HTMLElement>('[data-queue-item]');
    if (rows.length === 0) return 0;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rows.length - 1;
  }, []);

  const finishDrag = useCallback(
    async (commit: boolean) => {
      const preview = previewQueueRef.current;
      draggingIdRef.current = null;
      previewQueueRef.current = null;
      setDraggingId(null);
      setPreviewQueue(null);

      if (!commit || !preview || !onReorder) return;

      const tail = queue.slice(SALON_QUEUE_DISPLAY_MAX);
      const orderedIds = [...preview.map((item) => item.id), ...tail.map((item) => item.id)];
      await onReorder(orderedIds);
    },
    [onReorder, queue]
  );

  const handlePointerDown = useCallback(
    (itemId: string, e: React.PointerEvent<HTMLButtonElement>) => {
      if (!canReorder || reordering) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingIdRef.current = itemId;
      setDraggingId(itemId);
      const next = [...visibleQueue];
      previewQueueRef.current = next;
      setPreviewQueue(next);
    },
    [canReorder, reordering, visibleQueue]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const draggingId = draggingIdRef.current;
      if (!draggingId) return;
      e.preventDefault();
      setPreviewQueue((prev) => {
        const current = prev ?? visibleQueue;
        const fromIndex = current.findIndex((item) => item.id === draggingId);
        if (fromIndex < 0) return prev;
        const toIndex = findDropIndex(e.clientY);
        if (fromIndex === toIndex) return prev;
        const next = reorderList(current, fromIndex, toIndex);
        previewQueueRef.current = next;
        return next;
      });
    },
    [findDropIndex, visibleQueue]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingIdRef.current) return;
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      void finishDrag(true);
    },
    [finishDrag]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingIdRef.current) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      void finishDrag(false);
    },
    [finishDrag]
  );

  if (!allowQueue) {
    return (
      <p className="text-[10px] text-gray-600 text-center">{t('salon.queue.disabled')}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {t('salon.queue.title')}
            {queue.length > 0 ? (
              <span className="ml-1.5 text-gray-600 normal-case tracking-normal font-medium">
                ({queue.length})
              </span>
            ) : null}
          </h4>
          {canReorder ? (
            <p className="text-[10px] text-gray-600 mt-0.5">{t('salon.queue.reorderHint')}</p>
          ) : null}
        </div>
        {isHost && queue.length > 0 && onSkip && (
          <button
            type="button"
            disabled={skipping || reordering}
            onClick={onSkip}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-semibold disabled:opacity-50 transition shrink-0"
          >
            {t('salon.queue.next')}
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <p className={`text-gray-600 text-center ${compact ? 'text-[10px] py-1' : 'text-xs py-2'}`}>
          {t('salon.queue.empty')}
        </p>
      ) : (
        <>
          <ul
            ref={listRef}
            className={`overflow-y-auto overscroll-contain space-y-1 ${listMaxHeight} ${reordering ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {displayQueue.map((item, i) => {
              const isDragging = draggingId === item.id;
              return (
                <li
                  key={item.id}
                  data-queue-item
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0b0b0f] border text-left transition-shadow ${
                    isDragging
                      ? 'border-purple-500/50 shadow-[0_0_0_1px_rgba(168,85,247,0.25)] opacity-80'
                      : 'border-[#222233]'
                  }`}
                >
                  {canReorder ? (
                    <QueueDragHandle
                      label={t('salon.queue.reorderHandle')}
                      disabled={reordering}
                      onPointerDown={(e) => handlePointerDown(item.id, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                    />
                  ) : null}
                  <span className="text-[10px] text-gray-600 w-4 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {item.artist} · {item.addedByName}
                    </p>
                  </div>
                  {isHost && onPlayItem && (
                    <button
                      type="button"
                      disabled={reordering}
                      onClick={() => onPlayItem(item.id)}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-purple-500/30 text-purple-300 font-semibold shrink-0 hover:bg-purple-500/10 transition disabled:opacity-50"
                    >
                      {t('salon.queue.play')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 ? (
            <p className="text-[10px] text-gray-600 text-center">
              {t('salon.queue.truncated', { count: hiddenCount })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
