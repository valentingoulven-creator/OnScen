import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { EventDatePickerInput } from './EventDatePickerInput';
import { EventLocationInput } from './EventLocationInput';
import { StoryUserTagPicker } from './StoryUserTagPicker';
import { formatEventDateRangeChip } from '../lib/eventDateInput';
import { readSavedEventLocation } from '../lib/savedEventLocation';
import type { StoryTaggedUser } from '../types';

export interface FeedEventDraft {
  eventType: 'dance' | 'chant' | 'autre';
  confirmedEventDates: { start: string; end: string | null }[];
  eventLocation: string;
  saveEventLocation: boolean;
  eventTaggedUsers: StoryTaggedUser[];
}

function defaultDraft(): FeedEventDraft {
  return {
    eventType: 'autre',
    confirmedEventDates: [],
    eventLocation: readSavedEventLocation() ?? '',
    saveEventLocation: true,
    eventTaggedUsers: [],
  };
}

interface CreateFeedEventModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (draft: FeedEventDraft) => void;
  initialDraft?: Partial<FeedEventDraft>;
  token: string | null;
  profileCity?: string;
}

export function CreateFeedEventModal({
  open,
  onClose,
  onConfirm,
  initialDraft,
  token,
  profileCity,
}: CreateFeedEventModalProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<FeedEventDraft>(defaultDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft({
      ...defaultDraft(),
      ...initialDraft,
      confirmedEventDates: initialDraft?.confirmedEventDates ?? [],
      eventTaggedUsers: initialDraft?.eventTaggedUsers ?? [],
    });
    // Resync uniquement à l'ouverture — évite reset pendant la saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const removeConfirmedEventDate = (isoStart: string) => {
    setDraft((prev) => ({
      ...prev,
      confirmedEventDates: prev.confirmedEventDates.filter((e) => e.start !== isoStart),
    }));
  };

  const handleConfirm = () => {
    if (draft.confirmedEventDates.length < 1) {
      setError(t('feed.eventModalDateRequired'));
      return;
    }
    if (!draft.eventLocation.trim()) {
      setError(t('feed.eventModalLocationRequired'));
      return;
    }
    onConfirm(draft);
  };

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-feed-event-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1e1e2f] shrink-0">
          <h2 id="create-feed-event-title" className="text-base font-bold text-white">
            {t('feed.createEvent')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition"
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">
            {t('feed.eventDetails')}
          </p>

          <div>
            <p className="block text-[10px] text-gray-300 mb-1.5">{t('feed.eventType')}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('feed.eventType')}>
              {(
                [
                  ['dance', t('feed.eventTypeDance')],
                  ['chant', t('feed.eventTypeChant')],
                  ['autre', t('feed.eventTypeAutre')],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer select-none rounded-full px-3 py-1.5 min-h-[44px] flex items-center text-[11px] font-semibold border transition ${
                    draft.eventType === value
                      ? 'bg-purple-600/40 border-purple-400/60 text-purple-100'
                      : 'bg-[#0b0b0f] border-[#2a2a3d] text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="feedEventType"
                    value={value}
                    checked={draft.eventType === value}
                    onChange={() => setDraft((prev) => ({ ...prev, eventType: value }))}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-300 mb-1">
              {draft.confirmedEventDates.length > 0 ? t('feed.eventDates') : t('feed.eventDate')} *
            </label>
            {draft.confirmedEventDates.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {draft.confirmedEventDates.map(({ start, end }) => (
                  <li
                    key={start}
                    className="flex items-center gap-2 rounded-lg bg-[#0b0b0f] border border-green-500/40 px-2.5 py-1.5"
                  >
                    <span className="pointer-events-none text-green-400 shrink-0" aria-hidden>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0 text-xs text-purple-100 capitalize truncate">
                      {formatEventDateRangeChip(start, end, i18n.language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeConfirmedEventDate(start)}
                      className="shrink-0 min-w-11 min-h-11 flex items-center justify-center text-[10px] font-semibold text-gray-500 hover:text-red-300 transition"
                      aria-label={t('feed.eventDateRemove')}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <EventDatePickerInput
              confirmedDates={draft.confirmedEventDates.map((e) => e.start)}
              onAddDate={(isoStart, isoEnd) => {
                setDraft((prev) => ({
                  ...prev,
                  confirmedEventDates: [...prev.confirmedEventDates, { start: isoStart, end: isoEnd }].sort(
                    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
                  ),
                }));
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-300 mb-1">{t('feed.eventLocation')} *</label>
            <EventLocationInput
              value={draft.eventLocation}
              onChange={(eventLocation) => setDraft((prev) => ({ ...prev, eventLocation }))}
              profileCity={profileCity}
            />
            <label className="mt-2 flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
              <input
                type="checkbox"
                checked={draft.saveEventLocation}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, saveEventLocation: e.target.checked }))
                }
                className="melosong-checkbox"
                aria-label={t('feed.eventLocationSave')}
              />
              <span className="text-[10px] text-gray-400">{t('feed.eventLocationSave')}</span>
            </label>
          </div>

          {token ? (
            <div className="rounded-lg border border-[#2a2a3d] bg-[#0b0b0f]/80 p-3">
              <StoryUserTagPicker
                token={token}
                tagged={draft.eventTaggedUsers}
                onChange={(eventTaggedUsers) => setDraft((prev) => ({ ...prev, eventTaggedUsers }))}
                maxTags={5}
              />
              <p className="mt-1.5 text-[10px] text-gray-500">{t('feed.eventTaggedHint')}</p>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold"
          >
            {t('feed.eventModalConfirm')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
