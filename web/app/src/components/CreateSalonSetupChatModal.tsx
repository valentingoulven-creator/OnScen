import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { isMusicPlatformLinkedForSalon } from '../lib/platformConnect';
import { generateSalonId } from '../lib/salonDeepLink';
import { copyShareLink, getSalonShareUrl } from '../lib/shareLink';
import {
  buildPlaylistLoadBody,
  deferSalonPlaylistLoad,
  initialSalonCreateLocation,
  translateSalonCreateError,
} from '../lib/salonCreateFlow';
import {
  filterCreateSalonGenreSuggestions,
  isAllCreateSalonGenresSelected,
  MAX_CREATE_SALON_GENRES,
  resolveCreateSalonGenreOptions,
  selectAllCreateSalonGenres,
  toggleCreateSalonGenre,
  writeSavedCreateSalonGenres,
} from '../lib/createSalonGenres';
import { normalizeTag } from '../lib/musicAffinities';
import {
  applySavedSalonCreateSetup,
  prefsFromSalonCreateForm,
} from '../lib/salonCreateSetupPrefs';
import type { SetupChatMessage } from '../lib/liveSetupChatFlow';
import {
  getVisibleSalonSetupExchange,
  nextPhaseAfterTitle,
  nextSalonChatMessageId,
  SALON_SETUP_PHASE_BOT_QUESTION,
  summarizeSalonSetup,
  type SalonSetupChangeTarget,
  type SalonSetupChatPhase,
} from '../lib/salonSetupChatFlow';
import { SessionLocationPicker } from './SessionLocationPicker';
import type { LivesGeoPrefs } from '../lib/livesGeo';
import { PlatformConnectCard } from './PlatformConnectCard';
import {
  CreateSalonPlaylistPicker,
  type CreateSalonPlaylistSelection,
} from './CreateSalonPlaylistPicker';
import { SalonInviteLinkCopy } from './SalonInviteLinkCopy';
import { SalonInviteUserSearch } from './SalonInviteUserSearch';
import type { DmContact, Salon, User } from '../types';

export interface CreateSalonForm {
  title: string;
  platform: 'youtube';
  accessMode: 'public' | 'invite';
  allowedUserIds: string[];
  trackTitle: string;
  artist: string;
  youtubePlaylist: CreateSalonPlaylistSelection | null;
  allowQueue: boolean;
  genres: string[];
}

export type CreateSalonModalPreset = {
  platform?: 'youtube';
  accessMode?: 'public' | 'invite';
  allowedUserIds?: string[];
  title?: string;
};

export interface CreateSalonSetupChatModalProps {
  token: string;
  username: string;
  connectedPlatforms?: User['connectedPlatforms'];
  platformLinks?: User['platformLinks'];
  profileGenres?: string[];
  open: boolean;
  fallbackLatitude: number;
  fallbackLongitude: number;
  profileCity?: string;
  preset?: CreateSalonModalPreset | null;
  activeSalonId?: string | null;
  hostIsLive?: boolean;
  onClose: () => void;
  onCreated: (salon: Salon, lat: number, lon: number) => void;
  onOpenExistingSalon?: (salonId: string) => void;
  onUserUpdated?: (user: User) => void;
  onDeferredError?: (message: string) => void;
}

function ChatBubble({ message, compact }: { message: SetupChatMessage; compact?: boolean }) {
  const isBot = message.role === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[min(100%,13.5rem)] px-2.5 rounded-2xl leading-snug ${
          compact ? 'py-1.5 text-[12px]' : 'py-2 text-[13px]'
        } ${
          isBot
            ? 'bg-[#1e1e2f] text-gray-100 rounded-bl-md border border-[#2d2d3d]'
            : 'bg-purple-600/90 text-white rounded-br-md'
        }`}
      >
        {isBot ? <span className="mr-1" aria-hidden>🎙️</span> : null}
        {message.text}
      </div>
    </div>
  );
}

function ActionChip({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-[0.98] disabled:opacity-40';
  const styles =
    variant === 'primary'
      ? 'bg-purple-600 hover:bg-purple-500 text-white'
      : variant === 'ghost'
        ? 'bg-transparent border border-[#2d2d3d] text-gray-400 hover:text-white'
        : 'bg-[#2d2d3d] hover:bg-[#3d3d4d] text-white';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}

export function CreateSalonSetupChatModal({
  token,
  username,
  connectedPlatforms,
  platformLinks,
  profileGenres,
  open,
  fallbackLatitude,
  fallbackLongitude,
  profileCity,
  preset = null,
  activeSalonId = null,
  hostIsLive = false,
  onClose,
  onCreated,
  onOpenExistingSalon,
  onUserUpdated,
  onDeferredError,
}: CreateSalonSetupChatModalProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<SetupChatMessage[]>([]);
  const [phase, setPhase] = useState<SalonSetupChatPhase>('loading');
  const [chatReady, setChatReady] = useState(false);
  const [editReturn, setEditReturn] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [genreQuery, setGenreQuery] = useState('');
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftSalonId, setDraftSalonId] = useState(() => generateSalonId());
  const [toast, setToast] = useState<string | null>(null);
  const [salonLocation, setSalonLocation] = useState<LivesGeoPrefs>(() =>
    initialSalonCreateLocation(fallbackLatitude, fallbackLongitude)
  );
  const openedAtRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<CreateSalonForm>({
    title: '',
    platform: 'youtube',
    accessMode: 'public',
    allowedUserIds: [],
    trackTitle: '',
    artist: username,
    youtubePlaylist: null,
    allowQueue: true,
    genres: [],
  });

  const skipAccessSection = preset?.accessMode === 'invite';
  const platformLinked = isMusicPlatformLinkedForSalon('youtube', connectedPlatforms, platformLinks);
  const canSubmitSalon = platformLinked && !hostIsLive;

  const genreOptions = useMemo(
    () => resolveCreateSalonGenreOptions(profileGenres),
    [profileGenres]
  );
  const filteredGenreOptions = useMemo(
    () => filterCreateSalonGenreSuggestions(genreOptions, genreQuery),
    [genreOptions, genreQuery]
  );

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextSalonChatMessageId(), role: 'user', text }]);
  }, []);

  const pushBot = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextSalonChatMessageId(), role: 'bot', text }]);
  }, []);

  const exchangeMessages = getVisibleSalonSetupExchange(messages, phase);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!open || !token) {
      setChatReady(false);
      return;
    }
    let cancelled = false;
    if (activeSalonId?.trim()) {
      void api.getSalon(token, activeSalonId.trim()).catch(async () => {
        if (cancelled) return;
        try {
          const { user } = await api.me(token);
          onUserUpdated?.(user);
        } catch {
          /* ignore */
        }
      });
    }
    openedAtRef.current = Date.now();
    setChatReady(false);
    setEditReturn(false);
    setToast(null);
    setGenreQuery('');
    setDraftSalonId(generateSalonId());
    setPhase('loading');
    setMessages([]);

    const defaultTitle = preset?.title?.trim() || t('salon.create.defaultSalonTitle', { username });
    const initialGeo = initialSalonCreateLocation(fallbackLatitude, fallbackLongitude);

    void (async () => {
      let configured = false;
      let saved: import('../lib/salonCreateSetupPrefs').SalonCreateSetupPrefs | null = null;
      try {
        const res = await api.getSalonSetup(token);
        saved = res.setup;
        configured = res.configured;
      } catch {
        /* session / offline */
      }
      if (cancelled) return;

      const useSaved = configured && Boolean(saved) && !skipAccessSection;
      const applied = applySavedSalonCreateSetup(useSaved ? saved : null, {
        defaultTitle,
        initialGeo,
        profileGenres,
        presetAccess: preset?.accessMode,
        presetAllowedUserIds: preset?.allowedUserIds,
      });

      setSalonLocation(applied.salonLocation);
      setForm({
        title: applied.title,
        platform: 'youtube',
        accessMode: applied.accessMode,
        allowedUserIds: preset?.allowedUserIds ?? [],
        trackTitle: t('salon.create.defaultSessionTitle'),
        artist: username,
        youtubePlaylist: null,
        allowQueue: applied.allowQueue,
        genres: applied.genres,
      });
      setTitleDraft(applied.title);

      const linkedAtOpen = isMusicPlatformLinkedForSalon(
        'youtube',
        connectedPlatforms,
        platformLinks
      );

      const summaryText = summarizeSalonSetup(
        {
          title: applied.title,
          accessMode: applied.accessMode,
          locationLabel: applied.salonLocation.label,
          genres: applied.genres,
          allowQueue: applied.allowQueue,
          playlistTitle: null,
        },
        {
          public: t('salon.public'),
          invite: t('salon.inviteOnly'),
          allGenres: t('salon.create.fieldGenresAll'),
          queueOn: t('salon.create.setupChatQueueOnShort'),
          queueOff: t('salon.create.setupChatQueueOffShort'),
          noPlaylist: t('salon.create.setupChatPlaylistSkip'),
        }
      );

      if (useSaved && linkedAtOpen) {
        setPhase('return_ask');
        setMessages([
          {
            id: nextSalonChatMessageId(),
            role: 'bot',
            text: t('salon.create.setupChatReturnHello', { summary: summaryText }),
          },
        ]);
      } else {
        setPhase(linkedAtOpen ? 'title' : 'youtube');
        setMessages([
          { id: nextSalonChatMessageId(), role: 'bot', text: t('salon.create.setupChatHello') },
        ]);
      }

      setChatReady(true);
      api.getDmContacts(token).then((r) => {
        if (!cancelled) setContacts(r.contacts);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    token,
    username,
    preset,
    t,
    fallbackLatitude,
    fallbackLongitude,
    profileGenres,
    skipAccessSection,
    connectedPlatforms,
    platformLinks,
    activeSalonId,
    onUserUpdated,
  ]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open || !chatReady || phase === 'loading' || phase === 'return_ask') return;
    if (phase === 'youtube' && !platformLinked) return;
    const questionKey = SALON_SETUP_PHASE_BOT_QUESTION[phase];
    if (!questionKey) return;
    const text = t(`salon.create.${questionKey}`);
    setMessages((prev) => {
      if (prev.some((m) => m.role === 'bot' && m.text === text)) return prev;
      return [...prev, { id: nextSalonChatMessageId(), role: 'bot', text }];
    });
  }, [open, chatReady, phase, t, platformLinked]);

  const allowedUserIdsSet = new Set(form.allowedUserIds);

  const toggleGuest = (userId: string, add: boolean) => {
    setForm((f) => ({
      ...f,
      allowedUserIds: add
        ? f.allowedUserIds.includes(userId)
          ? f.allowedUserIds
          : [...f.allowedUserIds, userId]
        : f.allowedUserIds.filter((x) => x !== userId),
    }));
  };

  const resolvePosition = () => {
    if (form.accessMode === 'invite') {
      return Promise.resolve({
        latitude: fallbackLatitude,
        longitude: fallbackLongitude,
      });
    }
    return Promise.resolve({
      latitude: salonLocation.latitude,
      longitude: salonLocation.longitude,
    });
  };

  const submitBlockedReason = hostIsLive
    ? t('salon.create.errorHostLiveActive')
    : !platformLinked
      ? t('salon.create.errorPlatformNotLinkedYoutube')
      : null;

  const resolveCreateError = (e: unknown): string => translateSalonCreateError(t, e, 'youtube');

  const reportCreateError = (message: string) => {
    if (onDeferredError) {
      onDeferredError(message);
    } else {
      showToast(message);
    }
  };

  const goToPlaylistOrConfirm = () => {
    setPhase(platformLinked ? 'playlist' : 'confirm');
  };

  const submit = async () => {
    if (!canSubmitSalon) {
      reportCreateError(submitBlockedReason ?? t('salon.create.errorFailed'));
      return;
    }
    if (activeSalonId?.trim()) {
      try {
        await api.getSalon(token, activeSalonId.trim());
        const msg = t('salon.create.errorAlreadyActive');
        onOpenExistingSalon?.(activeSalonId.trim());
        reportCreateError(msg);
        onClose();
        return;
      } catch {
        /* salonId périmé (salon arrêté) — rafraîchir le profil puis créer */
        try {
          const { user } = await api.me(token);
          onUserUpdated?.(user);
        } catch {
          /* ignore */
        }
      }
    }
    setSaving(true);
    try {
      const useYoutubePlaylist = Boolean(form.youtubePlaylist);
      const { latitude, longitude } = await resolvePosition();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        reportCreateError(t('salon.create.errorFailed'));
        return;
      }

      const { salon } = await api.createSalon(token, {
        ...(form.accessMode === 'invite' ? { id: draftSalonId } : {}),
        title: form.title.trim(),
        platform: 'youtube',
        latitude,
        longitude,
        accessMode: form.accessMode,
        allowedUserIds: form.accessMode === 'invite' ? form.allowedUserIds : [],
        trackTitle: useYoutubePlaylist ? form.youtubePlaylist!.title : form.trackTitle.trim(),
        artist: form.artist.trim(),
        allowQueue: form.allowQueue,
        ...(form.genres.length > 0 ? { genres: form.genres } : {}),
      });

      writeSavedCreateSalonGenres(form.genres);
      try {
        await api.putSalonSetup(token, prefsFromSalonCreateForm(form, salonLocation));
      } catch {
        /* best effort — config locale genres déjà écrite */
      }

      const playlistLoadBody = useYoutubePlaylist
        ? buildPlaylistLoadBody(form.youtubePlaylist)
        : null;

      if (form.accessMode === 'invite') {
        void getSalonShareUrl(salon.id)
          .then((shareUrl) => copyShareLink(shareUrl))
          .catch(() => {});
      }

      onCreated(salon, latitude, longitude);
      onClose();

      try {
        const { user: freshUser } = await api.me(token);
        onUserUpdated?.(freshUser);
      } catch {
        /* best effort */
      }

      if (playlistLoadBody) {
        deferSalonPlaylistLoad(token, salon.id, playlistLoadBody, (error) => {
          onDeferredError?.(resolveCreateError(error));
        });
      }
    } catch (e) {
      const message = resolveCreateError(e);
      const existingId =
        e instanceof ApiRequestError && e.salonId?.trim() ? e.salonId.trim() : undefined;
      if (
        e instanceof ApiRequestError &&
        e.code === 'SALON_ALREADY_ACTIVE' &&
        existingId &&
        onOpenExistingSalon
      ) {
        onOpenExistingSalon(existingId);
        reportCreateError(message);
        onClose();
        return;
      }
      reportCreateError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClose = () => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  const summary = summarizeSalonSetup(
    {
      title: form.title,
      accessMode: form.accessMode,
      locationLabel: salonLocation.label,
      genres: form.genres,
      allowQueue: form.allowQueue,
      playlistTitle: form.youtubePlaylist?.title ?? null,
    },
    {
      public: t('salon.public'),
      invite: t('salon.inviteOnly'),
      allGenres: t('salon.create.fieldGenresAll'),
      queueOn: t('salon.create.setupChatQueueOnShort'),
      queueOff: t('salon.create.setupChatQueueOffShort'),
      noPlaylist: t('salon.create.setupChatPlaylistSkip'),
    }
  );

  const finishAfterEdit = (
    overrides?: Partial<{
      title: string;
      accessMode: 'public' | 'invite';
      locationLabel: string;
      genres: string[];
      allowQueue: boolean;
      playlistTitle: string | null;
    }>
  ) => {
    const nextSummary = summarizeSalonSetup(
      {
        title: overrides?.title ?? form.title,
        accessMode: overrides?.accessMode ?? form.accessMode,
        locationLabel: overrides?.locationLabel ?? salonLocation.label,
        genres: overrides?.genres ?? form.genres,
        allowQueue: overrides?.allowQueue ?? form.allowQueue,
        playlistTitle: overrides?.playlistTitle ?? form.youtubePlaylist?.title ?? null,
      },
      {
        public: t('salon.public'),
        invite: t('salon.inviteOnly'),
        allGenres: t('salon.create.fieldGenresAll'),
        queueOn: t('salon.create.setupChatQueueOnShort'),
        queueOff: t('salon.create.setupChatQueueOffShort'),
        noPlaylist: t('salon.create.setupChatPlaylistSkip'),
      }
    );
    pushBot(t('salon.create.setupChatUpdated', { summary: nextSummary }));
    setPhase('return_ask');
    setEditReturn(false);
  };

  const handlePickChange = (target: SalonSetupChangeTarget) => {
    const labels: Record<SalonSetupChangeTarget, string> = {
      title: t('salon.create.setupChatChangeTitle'),
      access: t('salon.create.setupChatChangeAccess'),
      location: t('salon.create.setupChatChangeLocation'),
      genres: t('salon.create.setupChatChangeGenres'),
      queue: t('salon.create.setupChatChangeQueue'),
      playlist: t('salon.create.setupChatChangePlaylist'),
    };
    pushUser(labels[target]);
    setEditReturn(true);
    if (target === 'title') setTitleDraft(form.title);
    setPhase(target);
  };

  const showStepFooter =
    phase === 'youtube' ||
    phase === 'title' ||
    phase === 'invite' ||
    phase === 'location' ||
    phase === 'genres' ||
    phase === 'playlist' ||
    phase === 'confirm';

  const renderStepPrimaryAction = () => {
    switch (phase) {
      case 'youtube':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={!platformLinked}
            onClick={() => {
              pushUser(t('salon.create.setupChatYoutubeOk'));
              setPhase('title');
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'title':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={!titleDraft.trim()}
            onClick={() => {
              const trimmed = titleDraft.trim();
              setForm((f) => ({ ...f, title: trimmed }));
              pushUser(trimmed);
              if (editReturn) {
                finishAfterEdit({ title: trimmed });
                return;
              }
              setPhase(nextPhaseAfterTitle(form.accessMode, skipAccessSection));
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'invite':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            onClick={() => {
              pushUser(t('salon.create.setupChatInviteOk'));
              if (editReturn) {
                finishAfterEdit();
                return;
              }
              setPhase('genres');
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'location':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            onClick={() => {
              pushUser(salonLocation.label || t('salon.create.setupChatLocationOk'));
              if (editReturn) {
                finishAfterEdit({ locationLabel: salonLocation.label });
                return;
              }
              setPhase('genres');
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'genres':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            onClick={() => {
              const label =
                form.genres.length > 0
                  ? form.genres.slice(0, 3).join(', ')
                  : t('salon.create.fieldGenresAll');
              pushUser(label);
              if (editReturn) {
                finishAfterEdit({ genres: form.genres });
                return;
              }
              setPhase('queue');
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'playlist':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            onClick={() => {
              pushUser(
                form.youtubePlaylist?.title?.trim() ||
                  t('salon.create.setupChatPlaylistSkip')
              );
              if (editReturn) {
                finishAfterEdit({
                  playlistTitle: form.youtubePlaylist?.title?.trim() ?? null,
                });
                return;
              }
              setPhase('confirm');
            }}
          >
            {t('salon.create.setupChatBtnContinue')}
          </ActionChip>
        );
      case 'confirm':
        return (
          <ActionChip
            variant="primary"
            className="w-full"
            disabled={saving || !canSubmitSalon}
            onClick={() => void submit()}
          >
            {saving ? t('salon.create.submitting') : t('salon.create.submit')}
          </ActionChip>
        );
      default:
        return null;
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-[2px] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-salon-chat-title"
      onClick={handleBackdropClose}
    >
      <div
        className="w-full max-w-[min(100%,19rem)] sm:max-w-[21rem] bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-0 max-h-[min(88dvh,calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600 shrink-0" />

        <div className="shrink-0 border-b border-[#1e1e2f] px-3 sm:px-4 pt-2.5 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              id="create-salon-chat-title"
              className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5"
            >
              <span className="text-purple-400" aria-hidden>●</span>
              {t('salon.create.setupChatTitle')}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
              {t('salon.create.setupChatSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition text-xl"
            aria-label={t('salon.create.close')}
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {exchangeMessages.length > 0 && (
            <div className="shrink-0 px-3 pt-2.5 pb-2 space-y-2 border-b border-[#1e1e2f]/50">
              {exchangeMessages.map((m) => (
                <ChatBubble key={m.id} message={m} compact />
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 space-y-2">
            {phase === 'loading' && (
              <p className="text-[11px] text-gray-500 animate-pulse pt-1">
                {t('salon.create.setupChatLoading')}
              </p>
            )}

            {phase === 'return_ask' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <ActionChip
                  variant="primary"
                  disabled={!canSubmitSalon || saving}
                  onClick={() => {
                    pushUser(t('salon.create.setupChatUseSaved'));
                    void submit();
                  }}
                >
                  {t('salon.create.setupChatBtnUseSaved')}
                </ActionChip>
                <ActionChip
                  onClick={() => {
                    pushUser(t('salon.create.setupChatBtnModify'));
                    setPhase('return_pick');
                  }}
                >
                  {t('salon.create.setupChatBtnModify')}
                </ActionChip>
              </div>
            )}

            {phase === 'return_pick' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(
                  [
                    ['title', t('salon.create.setupChatChipTitle')],
                    ...(!skipAccessSection
                      ? ([['access', t('salon.create.setupChatChipAccess')]] as const)
                      : []),
                    ...(form.accessMode === 'public'
                      ? ([['location', t('salon.create.setupChatChipLocation')]] as const)
                      : []),
                    ['genres', t('salon.create.setupChatChipGenres')],
                    ['queue', t('salon.create.setupChatChipQueue')],
                    ['playlist', t('salon.create.setupChatChipPlaylist')],
                  ] as const
                ).map(([target, label]) => (
                  <ActionChip key={target} onClick={() => handlePickChange(target)}>
                    {label}
                  </ActionChip>
                ))}
                <ActionChip
                  variant="ghost"
                  onClick={() => {
                    setPhase('return_ask');
                    pushBot(
                      t('salon.create.setupChatReturnHello', { summary })
                    );
                  }}
                >
                  {t('salon.create.setupChatBtnBack')}
                </ActionChip>
              </div>
            )}

            {phase === 'youtube' && (
              <div className="space-y-2 pt-0.5">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0b0b0f] border border-[#2d2d3d]">
                  <span className="text-red-500 text-sm font-bold">YouTube</span>
                  {platformLinked ? (
                    <span className="ml-auto text-[10px] font-semibold text-green-300">
                      {t('salon.create.youtubeConnectedShort')}
                    </span>
                  ) : (
                    <span className="ml-auto text-[10px] text-amber-400/90">
                      {t('salon.create.youtubeConnectHint')}
                    </span>
                  )}
                </div>
                {!platformLinked && (
                  <PlatformConnectCard
                    token={token}
                    platform="youtube"
                    connectedPlatforms={connectedPlatforms}
                    platformLinks={platformLinks}
                    onUserUpdated={onUserUpdated}
                  />
                )}
              </div>
            )}

            {phase === 'title' && (
              <div className="pt-0.5">
                <input
                  type="text"
                  value={titleDraft}
                  maxLength={120}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder={t('salon.create.fieldSalonNamePlaceholder')}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60"
                />
              </div>
            )}

            {phase === 'access' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <ActionChip
                  onClick={() => {
                    setForm((f) => ({ ...f, accessMode: 'public' }));
                    pushUser(t('salon.public'));
                    if (editReturn) {
                      finishAfterEdit({ accessMode: 'public' });
                      return;
                    }
                    setPhase('location');
                  }}
                >
                  {t('salon.create.setupChatAccessPublic')}
                </ActionChip>
                <ActionChip
                  onClick={() => {
                    setForm((f) => ({ ...f, accessMode: 'invite' }));
                    pushUser(t('salon.inviteOnly'));
                    if (editReturn) {
                      finishAfterEdit({ accessMode: 'invite' });
                      return;
                    }
                    setPhase('invite');
                  }}
                >
                  {t('salon.create.setupChatAccessInvite')}
                </ActionChip>
              </div>
            )}

            {phase === 'invite' && (
              <div className="space-y-2 pt-0.5 rounded-xl border border-[#2d2d3d] p-2 bg-[#0b0b0f]/80">
                <SalonInviteLinkCopy salonId={draftSalonId} />
                <div>
                  <p className="text-[10px] font-medium text-gray-400 mb-1">
                    {t('salon.create.inviteUsersLabel')}
                  </p>
                  <SalonInviteUserSearch
                    token={token}
                    contacts={contacts}
                    allowedUserIds={allowedUserIdsSet}
                    onToggle={toggleGuest}
                  />
                </div>
                <p className="text-[10px] text-gray-500 leading-snug">
                  {t('salon.create.accessInviteDetail')}
                </p>
              </div>
            )}

            {phase === 'location' && (
              <div className="pt-0.5">
                <SessionLocationPicker
                  value={salonLocation}
                  onChange={setSalonLocation}
                  variant="salon"
                  profileCity={profileCity}
                  anchorLatitude={fallbackLatitude}
                  anchorLongitude={fallbackLongitude}
                  token={token}
                />
              </div>
            )}

            {phase === 'genres' && (
              <div className="pt-0.5 space-y-1.5 rounded-xl border border-[#2d2d3d] p-2 bg-[#0b0b0f]/80">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium text-gray-400">
                    {t('salon.create.fieldGenres')}
                    <span className="ml-1 text-gray-600">
                      {form.genres.length}/{MAX_CREATE_SALON_GENRES}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        genres: selectAllCreateSalonGenres(
                          genreQuery.trim() ? filteredGenreOptions : genreOptions
                        ),
                      }))
                    }
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition ${
                      isAllCreateSalonGenresSelected(
                        form.genres,
                        genreQuery.trim() ? filteredGenreOptions : genreOptions
                      )
                        ? 'bg-purple-600/40 border-purple-400/60 text-purple-100'
                        : 'border-[#2d2d3d] text-gray-400 hover:border-purple-500/40'
                    }`}
                  >
                    {t('salon.create.fieldGenresAll')}
                  </button>
                </div>
                <input
                  type="search"
                  value={genreQuery}
                  onChange={(e) => setGenreQuery(e.target.value)}
                  placeholder={t('salon.create.fieldGenresSearch')}
                  className="w-full bg-[#12121a] border border-[#2d2d3d] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60"
                  autoComplete="off"
                />
                {form.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.genres.map((genre) => (
                      <button
                        key={`sel-${genre}`}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            genres: toggleCreateSalonGenre(f.genres, genre),
                          }))
                        }
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold border border-purple-400/50 bg-purple-600/30 text-purple-100"
                      >
                        {genre} ×
                      </button>
                    ))}
                  </div>
                )}
                {genreQuery.trim() ? (
                  <div className="rounded-lg border border-[#2d2d3d] bg-[#12121a] p-1.5 max-h-28 overflow-y-auto overscroll-y-contain">
                    <div className="flex flex-wrap gap-1">
                      {filteredGenreOptions.length === 0 ? (
                        <p className="text-[10px] text-gray-500 px-1">
                          {t('salon.create.fieldGenresEmpty')}
                        </p>
                      ) : (
                        filteredGenreOptions.map((genre) => {
                          const selected = form.genres.some(
                            (g) => normalizeTag(g) === normalizeTag(genre)
                          );
                          const disabled =
                            !selected && form.genres.length >= MAX_CREATE_SALON_GENRES;
                          return (
                            <button
                              key={genre}
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  genres: toggleCreateSalonGenre(f.genres, genre),
                                }))
                              }
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition disabled:opacity-35 ${
                                selected
                                  ? 'bg-purple-600/40 border-purple-400/60 text-purple-100'
                                  : 'border-[#2d2d3d] text-gray-400 hover:border-purple-500/40'
                              }`}
                            >
                              {genre}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500 leading-snug">
                    {t('salon.create.fieldGenresSearchPrompt')}
                  </p>
                )}
              </div>
            )}

            {phase === 'queue' && (
              <div className="flex flex-wrap gap-2 pt-1">
                <ActionChip
                  onClick={() => {
                    setForm((f) => ({ ...f, allowQueue: true }));
                    pushUser(t('salon.create.setupChatQueueYes'));
                    if (editReturn) {
                      finishAfterEdit({ allowQueue: true });
                      return;
                    }
                    goToPlaylistOrConfirm();
                  }}
                >
                  {t('salon.create.setupChatQueueYes')}
                </ActionChip>
                <ActionChip
                  onClick={() => {
                    setForm((f) => ({ ...f, allowQueue: false }));
                    pushUser(t('salon.create.setupChatQueueNo'));
                    if (editReturn) {
                      finishAfterEdit({ allowQueue: false });
                      return;
                    }
                    goToPlaylistOrConfirm();
                  }}
                >
                  {t('salon.create.setupChatQueueNo')}
                </ActionChip>
              </div>
            )}

            {phase === 'playlist' && (
              <div className="pt-0.5 space-y-2">
                <ActionChip
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setForm((f) => ({ ...f, youtubePlaylist: null }));
                    pushUser(t('salon.create.setupChatPlaylistSkip'));
                    if (editReturn) {
                      finishAfterEdit({ playlistTitle: null });
                      return;
                    }
                    setPhase('confirm');
                  }}
                >
                  {t('salon.create.setupChatPlaylistSkip')}
                </ActionChip>
                <CreateSalonPlaylistPicker
                  token={token}
                  compact
                  value={form.youtubePlaylist}
                  onChange={(youtubePlaylist) =>
                    setForm((f) => ({ ...f, youtubePlaylist }))
                  }
                />
              </div>
            )}

            {phase === 'confirm' && (
              <p className="text-[11px] text-gray-400 leading-snug px-1 pt-0.5">{summary}</p>
            )}
          </div>

          {showStepFooter && (
            <div className="shrink-0 px-3 py-2 border-t border-[#1e1e2f]/60 bg-[#12121a]">
              {submitBlockedReason && phase === 'confirm' && (
                <p className="text-[10px] text-red-400/90 text-center mb-2 leading-snug">
                  {submitBlockedReason}
                </p>
              )}
              {renderStepPrimaryAction()}
            </div>
          )}
        </div>

        <div className="shrink-0 px-3 py-2 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300"
          >
            {t('salon.create.setupChatBtnCancel')}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] max-w-[min(90vw,22rem)] px-4 py-2.5 rounded-xl bg-[#1a1a28] border border-purple-500/40 text-sm text-white text-center"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>,
    document.body
  );
}
