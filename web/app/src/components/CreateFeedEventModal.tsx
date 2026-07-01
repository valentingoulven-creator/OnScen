import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { dataUrlToFeedImageDataUrl } from '../lib/feedImagePaste';
import { ACCEPTED_IMAGE_FORMATS, validateImageFileAsync } from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import { validateStoryLinkUrl } from '../lib/storyLink';
import type { FeedPost, StoryTaggedUser, User } from '../types';
import { EventCard } from './EventCard';
import { EventDatePickerInput } from './EventDatePickerInput';
import { EventLocationInput } from './EventLocationInput';
import { StoryUserTagPicker } from './StoryUserTagPicker';
import { formatEventDateRangeChip } from '../lib/eventDateInput';
import { readSavedEventLocation } from '../lib/savedEventLocation';

export interface FeedEventDraft {
  title: string;
  eventType: 'dance' | 'chant' | 'autre';
  confirmedEventDates: { start: string; end: string | null }[];
  eventLocation: string;
  saveEventLocation: boolean;
  eventTaggedUsers: StoryTaggedUser[];
  imageUrl: string;
  eventLinkUrl: string;
}

function defaultDraft(): FeedEventDraft {
  return {
    title: '',
    eventType: 'autre',
    confirmedEventDates: [],
    eventLocation: readSavedEventLocation() ?? '',
    saveEventLocation: true,
    eventTaggedUsers: [],
    imageUrl: '',
    eventLinkUrl: '',
  };
}

function buildEventPreviewPost(draft: FeedEventDraft, author: User): FeedPost {
  const eventDatesIso = draft.confirmedEventDates.map((e) => new Date(e.start).toISOString());
  const link = draft.eventLinkUrl.trim();
  return {
    id: 'event-preview',
    userId: author.id,
    content:
      draft.title.trim() ||
      tFallbackTitle(draft.eventType) ||
      draft.eventLocation.trim() ||
      'Événement',
    imageUrl: draft.imageUrl.trim() || undefined,
    createdAt: Date.now(),
    author: {
      id: author.id,
      username: author.username,
      avatarUrl: author.avatarUrl,
      usernameColor: author.usernameColor,
      usernameWaveFrom: author.usernameWaveFrom,
      usernameWaveTo: author.usernameWaveTo,
    },
    likeCount: 0,
    likedByMe: false,
    upvoteCount: 0,
    upvotedByMe: false,
    commentCount: 0,
    favoriteByMe: false,
    recentComments: [],
    isEvent: true,
    eventDate: eventDatesIso[0],
    eventDates: eventDatesIso.length ? eventDatesIso : undefined,
    eventEndTimes: draft.confirmedEventDates.map((e) =>
      e.end ? new Date(e.end).toISOString() : null
    ),
    eventLocation: draft.eventLocation.trim() || undefined,
    eventType: draft.eventType,
    eventTaggedUsers: draft.eventTaggedUsers.length ? draft.eventTaggedUsers : undefined,
    eventLinkUrl: link || undefined,
  };
}

function tFallbackTitle(eventType: FeedEventDraft['eventType']): string {
  if (eventType === 'dance') return 'Soirée danse';
  if (eventType === 'chant') return 'Concert / chant';
  return 'Événement';
}

function SectionCard({
  icon,
  title,
  required,
  children,
}: {
  icon: ReactNode;
  title: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#2a2a3d] bg-[#0b0b0f]/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2f]/80 bg-[#12121a]/50">
        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/15 text-purple-300 shrink-0">
          {icon}
        </span>
        <h3 className="text-xs font-bold text-white">
          {title}
          {required ? <span className="text-purple-400 ml-0.5">*</span> : null}
        </h3>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </section>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const EVENT_TYPE_META = {
  dance: { emoji: '💃' },
  chant: { emoji: '🎤' },
  autre: { emoji: '✨' },
} as const;

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
  const { user } = useAuth();
  const [draft, setDraft] = useState<FeedEventDraft>(defaultDraft);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [imageAttaching, setImageAttaching] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const locationSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinkError(null);
    setPreviewMode(false);
    const hasMore =
      Boolean(initialDraft?.eventLinkUrl?.trim()) ||
      (initialDraft?.eventTaggedUsers?.length ?? 0) > 0;
    setMoreOpen(hasMore);
    setDraft({
      ...defaultDraft(),
      ...initialDraft,
      confirmedEventDates: initialDraft?.confirmedEventDates ?? [],
      eventTaggedUsers: initialDraft?.eventTaggedUsers ?? [],
      imageUrl: initialDraft?.imageUrl ?? '',
      eventLinkUrl: initialDraft?.eventLinkUrl ?? '',
      title: initialDraft?.title ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewMode) setPreviewMode(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, previewMode]);

  const previewPost = useMemo(() => {
    if (!user) return null;
    const post = buildEventPreviewPost(draft, user);
    if (!post.content.trim() || post.content === 'Événement') {
      const fallback =
        draft.eventType === 'dance'
          ? t('feed.eventTypeDance')
          : draft.eventType === 'chant'
            ? t('feed.eventTypeChant')
            : t('feed.eventTypeAutre');
      return { ...post, content: draft.title.trim() || fallback };
    }
    return post;
  }, [draft, user, t]);

  const hasDate = draft.confirmedEventDates.length >= 1;
  const hasLocation = Boolean(draft.eventLocation.trim());
  const previewReady = hasDate && hasLocation;

  if (!open) return null;

  const scrollToSection = (el: HTMLDivElement | null) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeConfirmedEventDate = (isoStart: string) => {
    setDraft((prev) => ({
      ...prev,
      confirmedEventDates: prev.confirmedEventDates.filter((e) => e.start !== isoStart),
    }));
  };

  const attachImageFromFile = async (file: File) => {
    const validation = await validateImageFileAsync(file);
    if (!validation.valid) {
      setError(validation.error ?? t('feed.eventModalImageInvalid'));
      return;
    }
    setError(null);
    setImageAttaching(true);
    try {
      const prepared = await prepareImageFile(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(prepared);
      });
      const url = await dataUrlToFeedImageDataUrl(dataUrl);
      setDraft((prev) => ({ ...prev, imageUrl: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.eventModalImageInvalid'));
    } finally {
      setImageAttaching(false);
    }
  };

  const handleLinkBlur = () => {
    const raw = draft.eventLinkUrl.trim();
    if (!raw) {
      setLinkError(null);
      return;
    }
    const validated = validateStoryLinkUrl(raw);
    setLinkError(validated.ok ? null : validated.error);
    if (validated.ok) {
      setDraft((prev) => ({ ...prev, eventLinkUrl: validated.url }));
    }
  };

  const handleConfirm = () => {
    if (!hasDate) {
      setError(t('feed.eventModalDateRequired'));
      setPreviewMode(false);
      scrollToSection(dateSectionRef.current);
      return;
    }
    if (!hasLocation) {
      setError(t('feed.eventModalLocationRequired'));
      setPreviewMode(false);
      scrollToSection(locationSectionRef.current);
      return;
    }
    if (draft.eventLinkUrl.trim()) {
      const validated = validateStoryLinkUrl(draft.eventLinkUrl);
      if (!validated.ok) {
        setLinkError(validated.error);
        setError(validated.error);
        setMoreOpen(true);
        setPreviewMode(false);
        return;
      }
      onConfirm({ ...draft, eventLinkUrl: validated.url });
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
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-0 shrink-0" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-[#3d3d4d]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 sm:py-3 border-b border-[#1e1e2f] shrink-0">
          <div className="min-w-0 flex-1">
            <h2 id="create-feed-event-title" className="text-base font-bold text-white truncate">
              {previewMode ? t('feed.eventModalTabPreview') : t('feed.createEvent')}
            </h2>
            {!previewMode ? (
              <div className="flex items-center gap-2 mt-1">
                <ProgressPill done={hasDate} label={t('feed.eventModalProgressDate')} />
                <ProgressPill done={hasLocation} label={t('feed.eventModalProgressLocation')} />
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 mt-0.5">{t('feed.eventModalPreviewHint')}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {previewReady ? (
              <button
                type="button"
                onClick={() => setPreviewMode((v) => !v)}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition ${
                  previewMode
                    ? 'bg-purple-600/30 text-purple-200'
                    : 'text-gray-400 hover:text-white hover:bg-[#1e1e2f]'
                }`}
                aria-label={
                  previewMode ? t('feed.eventModalBackToEdit') : t('feed.eventModalTabPreview')
                }
                title={previewMode ? t('feed.eventModalBackToEdit') : t('feed.eventModalTabPreview')}
              >
                {previewMode ? <PencilIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition"
              aria-label={t('common.cancel')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        >
          {previewMode ? (
            <div className="p-4">
              {previewPost ? (
                <EventCard post={previewPost} onOpen={() => {}} embedded compact />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  {t('feed.eventModalPreviewUnavailable')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Hero cover + title */}
              <div className="relative">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_FORMATS}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void attachImageFromFile(file);
                  }}
                />
                <div className="relative w-full aspect-[2/1] max-h-40 bg-gradient-to-br from-purple-950/70 via-[#12121a] to-[#0b0b0f] overflow-hidden">
                  {draft.imageUrl ? (
                    <img
                      src={draft.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10 pointer-events-none" />
                  {imageAttaching ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                    </div>
                  ) : null}
                  <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                    {draft.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, imageUrl: '' }))}
                        className="w-11 h-11 flex items-center justify-center rounded-full bg-black/55 text-white text-sm font-bold border border-white/15 hover:bg-red-950/70"
                        aria-label={t('feed.removeImage')}
                      >
                        ✕
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={imageAttaching}
                      onClick={() => imageInputRef.current?.click()}
                      className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-full bg-black/55 text-white text-[11px] font-semibold border border-white/15 backdrop-blur-sm hover:bg-black/70"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {draft.imageUrl
                        ? t('feed.eventModalChangeCover')
                        : t('feed.eventModalAddCover')}
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 z-10">
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder={t('feed.eventModalTitlePlaceholder')}
                      maxLength={200}
                      className="w-full bg-transparent border-0 text-lg sm:text-xl font-bold text-white placeholder:text-white/45 focus:outline-none focus:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 space-y-4">
                {/* Event type — segmented */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-2">{t('feed.eventType')}</p>
                  <div
                    className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0b0b0f] border border-[#2a2a3d]"
                    role="radiogroup"
                    aria-label={t('feed.eventType')}
                  >
                    {(
                      [
                        ['dance', t('feed.eventTypeDance')],
                        ['chant', t('feed.eventTypeChant')],
                        ['autre', t('feed.eventTypeAutre')],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`cursor-pointer select-none rounded-lg min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                          draft.eventType === value
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
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
                        <span className="text-base leading-none" aria-hidden>
                          {EVENT_TYPE_META[value].emoji}
                        </span>
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* When */}
                <div ref={dateSectionRef}>
                  <SectionCard
                    icon={<CalendarIcon className="w-4 h-4" />}
                    title={t('feed.eventModalSectionWhen')}
                    required
                  >
                    {draft.confirmedEventDates.length > 0 ? (
                      <ul className="space-y-1.5 mb-2">
                        {draft.confirmedEventDates.map(({ start, end }) => (
                          <li
                            key={start}
                            className="flex items-center gap-2 rounded-xl bg-purple-950/40 border border-purple-500/25 px-3 py-2"
                          >
                            <span className="text-green-400 shrink-0" aria-hidden>
                              <CalendarIcon className="w-4 h-4" />
                            </span>
                            <span className="flex-1 min-w-0 text-sm text-purple-100 capitalize truncate">
                              {formatEventDateRangeChip(start, end, i18n.language)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeConfirmedEventDate(start)}
                              className="shrink-0 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-red-300 transition rounded-lg"
                              aria-label={t('feed.eventDateRemove')}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 mb-2">{t('feed.eventModalDateHint')}</p>
                    )}
                    <EventDatePickerInput
                      confirmedDates={draft.confirmedEventDates.map((e) => e.start)}
                      onAddDate={(isoStart, isoEnd) => {
                        setError(null);
                        setDraft((prev) => ({
                          ...prev,
                          confirmedEventDates: [...prev.confirmedEventDates, { start: isoStart, end: isoEnd }].sort(
                            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
                          ),
                        }));
                      }}
                    />
                  </SectionCard>
                </div>

                {/* Where */}
                <div ref={locationSectionRef}>
                  <SectionCard
                    icon={<MapPinIcon className="w-4 h-4" />}
                    title={t('feed.eventModalSectionWhere')}
                    required
                  >
                    <EventLocationInput
                      value={draft.eventLocation}
                      onChange={(eventLocation) => {
                        setError(null);
                        setDraft((prev) => ({ ...prev, eventLocation }));
                      }}
                      profileCity={profileCity}
                    />
                    <label className="mt-2 flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] px-1">
                      <input
                        type="checkbox"
                        checked={draft.saveEventLocation}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, saveEventLocation: e.target.checked }))
                        }
                        className="melosong-checkbox"
                        aria-label={t('feed.eventLocationSave')}
                      />
                      <span className="text-xs text-gray-400 leading-snug">
                        {t('feed.eventLocationSave')}
                      </span>
                    </label>
                  </SectionCard>
                </div>

                {/* More options — collapsible */}
                <div className="rounded-2xl border border-[#2a2a3d] bg-[#0b0b0f]/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-3 min-h-[44px] text-left hover:bg-[#1e1e2f]/30 transition"
                    aria-expanded={moreOpen}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1e1e2f] text-gray-400">
                        <LinkIcon className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-white">{t('feed.eventModalSectionMore')}</span>
                      {(draft.eventLinkUrl.trim() || draft.eventTaggedUsers.length > 0) && !moreOpen ? (
                        <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full">
                          {draft.eventLinkUrl.trim() && draft.eventTaggedUsers.length > 0
                            ? '2'
                            : '1'}
                        </span>
                      ) : null}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-5 h-5 text-gray-500 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {moreOpen ? (
                    <div className="px-3 pb-3 space-y-3 border-t border-[#1e1e2f]/80 pt-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          {t('feed.eventModalLink')}
                        </label>
                        <input
                          type="url"
                          inputMode="url"
                          value={draft.eventLinkUrl}
                          onChange={(e) => {
                            setLinkError(null);
                            setDraft((prev) => ({ ...prev, eventLinkUrl: e.target.value }));
                          }}
                          onBlur={handleLinkBlur}
                          placeholder="https://…"
                          className={`w-full rounded-xl bg-[#12121a] border px-3 py-2.5 min-h-[44px] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                            linkError ? 'border-red-500/60' : 'border-[#2a2a3d]'
                          }`}
                        />
                        {linkError ? (
                          <p className="mt-1 text-xs text-red-400">{linkError}</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-500">{t('feed.eventModalLinkHint')}</p>
                        )}
                      </div>
                      {token ? (
                        <div className="rounded-xl border border-[#2a2a3d] bg-[#12121a]/80 p-3">
                          <StoryUserTagPicker
                            token={token}
                            tagged={draft.eventTaggedUsers}
                            onChange={(eventTaggedUsers) =>
                              setDraft((prev) => ({ ...prev, eventTaggedUsers }))
                            }
                            maxTags={5}
                          />
                          <p className="mt-1.5 text-[11px] text-gray-500">{t('feed.eventTaggedHint')}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <p className="text-xs text-red-400 px-1" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/80 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {previewMode ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white"
              >
                {t('feed.eventModalBackToEdit')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={imageAttaching || !previewReady}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {t('feed.eventModalConfirm')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white"
              >
                {t('common.cancel')}
              </button>
              {previewReady ? (
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className="min-h-[44px] px-3 rounded-xl border border-purple-500/40 text-purple-200 text-xs font-semibold hover:bg-purple-950/40"
                >
                  {t('feed.eventModalTabPreview')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={imageAttaching}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {t('feed.eventModalConfirm')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function ProgressPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        done
          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
          : 'text-gray-500 bg-[#0b0b0f] border-[#2a2a3d]'
      }`}
    >
      <span aria-hidden>{done ? '✓' : '○'}</span>
      {label}
    </span>
  );
}
