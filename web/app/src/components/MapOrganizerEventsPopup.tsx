import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { EventCard } from './EventCard';
import type { FeedPost } from '../types';

interface MapOrganizerEventsPopupProps {
  open: boolean;
  authorUsername: string;
  authorId: string;
  events: FeedPost[];
  onClose: () => void;
  onSelectEvent: (post: FeedPost) => void;
  onOpenAuthor?: (userId: string) => void;
}

export function MapOrganizerEventsPopup({
  open,
  authorUsername,
  authorId,
  events,
  onClose,
  onSelectEvent,
  onOpenAuthor,
}: MapOrganizerEventsPopupProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || events.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('map.organizerEventsTitle', {
        name: authorUsername,
        defaultValue: `Événements de @${authorUsername}`,
      })}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-[#12121a] border border-[#2d2d3d] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-[#2d2d3d]/80 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {t('map.organizerEventsKicker', 'Organisateur')}
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenAuthor?.(authorId);
                onClose();
              }}
              className="text-left text-base font-bold text-white truncate hover:text-indigo-300 transition"
            >
              @{authorUsername}
            </button>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('map.organizerEventsSubtitle', {
                count: events.length,
                defaultValue:
                  events.length === 1
                    ? '1 événement à venir'
                    : `${events.length} événements à venir`,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-black/50 text-gray-200 hover:text-white hover:bg-black/70 border border-white/10 backdrop-blur-sm transition shrink-0"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 space-y-2 px-2">
          {events.map((post) => (
            <li key={post.id}>
              <EventCard
                post={post}
                compact
                embedded
                onOpen={onSelectEvent}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
