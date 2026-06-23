import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { translateSalonCreateError } from '../lib/spotifyPlaylistSession';
import { isMusicPlatformLinkedForSalon } from '../lib/platformConnect';
import { generateSalonId } from '../lib/salonDeepLink';
import { copyShareLink, getSalonShareUrl } from '../lib/shareLink';
import {
  buildPlaylistLoadBody,
  deferSalonPlaylistLoad,
  initialSalonCreateLocation,
} from '../lib/salonCreateFlow';
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

// ── Inline SVG icon helpers ────────────────────────────────────────────────────

function IcoX() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IcoCheck({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={sm ? 'w-3 h-3' : 'w-3.5 h-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IcoYouTube({ sm }: { sm?: boolean }) {
  return (
    <svg className={sm ? 'w-4 h-4' : 'w-6 h-6'} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  );
}

function IcoGlobe({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={sm ? 'w-4 h-4' : 'w-5 h-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IcoLock({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={sm ? 'w-4 h-4' : 'w-5 h-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Shared style constants ─────────────────────────────────────────────────────

const inputCls =
  'mt-0.5 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-1.5 text-sm text-white ' +
  'placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 ' +
  'focus:ring-1 focus:ring-purple-500/30 transition-colors';

const labelCls = 'block text-[10px] font-medium text-gray-400';

// ── Types & exports ────────────────────────────────────────────────────────────

export interface CreateSalonForm {
  title: string;
  platform: 'youtube';
  accessMode: 'public' | 'invite';
  allowedUserIds: string[];
  trackTitle: string;
  artist: string;
  youtubePlaylist: CreateSalonPlaylistSelection | null;
  allowQueue: boolean;
}

/** Préremplissage (ex. salon privé depuis un fil DM). */
export type CreateSalonModalPreset = {
  platform?: 'youtube';
  accessMode?: 'public' | 'invite';
  allowedUserIds?: string[];
  title?: string;
};

interface CreateSalonModalProps {
  token: string;
  username: string;
  connectedPlatforms?: User['connectedPlatforms'];
  platformLinks?: User['platformLinks'];
  open: boolean;
  fallbackLatitude: number;
  fallbackLongitude: number;
  preset?: CreateSalonModalPreset | null;
  onClose: () => void;
  onCreated: (salon: Salon, lat: number, lon: number) => void;
  onUserUpdated?: (user: User) => void;
  /** Erreur chargement playlist différé (modal déjà fermé). */
  onDeferredError?: (message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateSalonModal({
  token,
  username,
  connectedPlatforms,
  platformLinks,
  open,
  fallbackLatitude,
  fallbackLongitude,
  preset = null,
  onClose,
  onCreated,
  onUserUpdated,
  onDeferredError,
}: CreateSalonModalProps) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftSalonId, setDraftSalonId] = useState(() => generateSalonId());
  const [toast, setToast] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
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
  });

  const skipAccessSection = preset?.accessMode === 'invite';

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!open || !token) return;
    openedAtRef.current = Date.now();
    setToast(null);
    setShowOptions(false);
    setSalonLocation(initialSalonCreateLocation(fallbackLatitude, fallbackLongitude));
    setDraftSalonId(generateSalonId());
    setForm({
      title: preset?.title?.trim() || t('salon.create.defaultSalonTitle', { username }),
      platform: 'youtube',
      accessMode: preset?.accessMode ?? 'public',
      allowedUserIds: preset?.allowedUserIds ?? [],
      trackTitle: t('salon.create.defaultSessionTitle'),
      artist: username,
      youtubePlaylist: null,
      allowQueue: true,
    });
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [open, token, username, preset, t, fallbackLatitude, fallbackLongitude]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  if (!open) return null;

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

  const platformLinked = isMusicPlatformLinkedForSalon('youtube', connectedPlatforms, platformLinks);
  const canSubmitSalon = platformLinked;

  const submitBlockedReason = !canSubmitSalon
    ? t('salon.create.errorPlatformNotLinkedYoutube')
    : null;

  const resolveCreateError = (e: unknown): string => translateSalonCreateError(t, e, 'youtube');

  const submit = async () => {
    if (!canSubmitSalon) {
      showToast(submitBlockedReason ?? t('salon.create.errorFailed'));
      return;
    }
    setSaving(true);
    try {
      const useYoutubePlaylist = Boolean(form.youtubePlaylist);

      const { latitude, longitude } = await resolvePosition();

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
      });

      const playlistLoadBody = useYoutubePlaylist
        ? buildPlaylistLoadBody('youtube', form.youtubePlaylist, null)
        : null;

      if (form.accessMode === 'invite') {
        void getSalonShareUrl(salon.id)
          .then((shareUrl) => copyShareLink(shareUrl))
          .catch(() => {});
      }

      onCreated(salon, latitude, longitude);
      onClose();

      if (playlistLoadBody) {
        deferSalonPlaylistLoad(token, salon.id, playlistLoadBody, (error) => {
          onDeferredError?.(resolveCreateError(error));
        });
      }
    } catch (e) {
      const message = resolveCreateError(e);
      if (e instanceof ApiRequestError && e.code === 'SALON_ALREADY_ACTIVE') {
        if (onDeferredError) {
          onDeferredError(message);
          onClose();
        } else {
          showToast(message);
        }
      } else {
        showToast(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClose = () => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  const youtubeSyncTooltip = `${t('salon.playbackMode.youtubeSync')} ${t('salon.playbackMode.youtubeSyncEmphasis')} ${t('salon.playbackMode.youtubeSyncSuffix')}`;

  const inviteSection = (
    <div className="space-y-2 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg p-2.5">
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
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-salon-title"
      onClick={handleBackdropClose}
    >
      <div
        className="w-full max-w-md flex flex-col bg-[#12121a] rounded-2xl border border-[#2d2d3d] overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-[#1e1e2f]">
          <h2
            id="create-salon-title"
            className="text-sm font-bold text-white tracking-tight"
          >
            {t('salon.create.modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('salon.create.close')}
            className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1a26] transition-colors"
          >
            <IcoX />
          </button>
        </div>

        {/* ── Single-page form (no internal scroll) ───────────────────────── */}
        <div className="px-4 py-3 space-y-2.5 overflow-y-auto max-h-[min(58dvh,28rem)]">

          {/* Platform — single inline row */}
          <div>
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d]"
              title={youtubeSyncTooltip}
            >
              <div className="w-7 h-7 rounded-md bg-red-600/15 flex items-center justify-center text-red-500 flex-shrink-0">
                <IcoYouTube sm />
              </div>
              <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">
                YouTube
              </span>
              {platformLinked ? (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 flex-shrink-0"
                  title={t('salon.create.youtubeConnected')}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-green-300">
                    {t('salon.create.youtubeConnectedShort')}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-semibold text-amber-400/90 flex-shrink-0 max-w-[8rem] truncate">
                  {t('salon.create.youtubeConnectHint')}
                </span>
              )}
            </div>

            {!platformLinked && (
              <div className="mt-1.5">
                <PlatformConnectCard
                  token={token}
                  platform="youtube"
                  connectedPlatforms={connectedPlatforms}
                  platformLinks={platformLinks}
                  onUserUpdated={onUserUpdated}
                />
              </div>
            )}
          </div>

          {/* Access — two compact pill buttons */}
          {!skipAccessSection && (
            <div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  title={t('salon.create.accessPublicHint')}
                  onClick={() => setForm((f) => ({ ...f, accessMode: 'public' }))}
                  className={`flex-1 min-h-[40px] px-2 py-1.5 rounded-lg border text-center flex items-center justify-center gap-1.5 transition-colors ${
                    form.accessMode === 'public'
                      ? 'border-purple-500/60 bg-purple-500/10 text-white'
                      : 'border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:border-[#3d3d4d]'
                  }`}
                >
                  <IcoGlobe sm />
                  <span className="text-xs font-semibold truncate">{t('salon.public')}</span>
                  {form.accessMode === 'public' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0">
                      <IcoCheck sm />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  title={t('salon.create.accessInviteHint')}
                  onClick={() => setForm((f) => ({ ...f, accessMode: 'invite' }))}
                  className={`flex-1 min-h-[40px] px-2 py-1.5 rounded-lg border text-center flex items-center justify-center gap-1.5 transition-colors ${
                    form.accessMode === 'invite'
                      ? 'border-purple-500/60 bg-purple-500/10 text-white'
                      : 'border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:border-[#3d3d4d]'
                  }`}
                >
                  <IcoLock sm />
                  <span className="text-xs font-semibold truncate">{t('salon.inviteOnly')}</span>
                  {form.accessMode === 'invite' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0">
                      <IcoCheck sm />
                    </span>
                  )}
                </button>
              </div>

              {form.accessMode === 'invite' && <div className="mt-1.5">{inviteSection}</div>}
              {form.accessMode === 'invite' && (
                <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
                  {t('salon.create.accessInviteDetail')}
                </p>
              )}
            </div>
          )}

          {skipAccessSection && form.accessMode === 'invite' && inviteSection}

          {form.accessMode === 'public' && (
            <SessionLocationPicker
              value={salonLocation}
              onChange={setSalonLocation}
              variant="salon"
            />
          )}

          {/* Details — name full-width, artist + session 2-col */}
          <div className="space-y-1.5">
            <label className="block">
              <span className={labelCls}>{t('salon.create.fieldSalonName')}</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t('salon.create.fieldSalonNamePlaceholder')}
                className={inputCls}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <label className="block">
                <span className={labelCls}>{t('salon.create.fieldArtist')}</span>
                <input
                  value={form.artist}
                  onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
                  placeholder={t('salon.create.fieldArtistPlaceholder')}
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>{t('salon.create.fieldSessionTitle')}</span>
                <input
                  value={form.trackTitle}
                  onChange={(e) => setForm((f) => ({ ...f, trackTitle: e.target.value }))}
                  placeholder={t('salon.create.fieldSessionTitlePlaceholder')}
                  className={inputCls}
                />
              </label>
            </div>

            {/* ▶ Options collapsible (playlist) — closed by default */}
            {platformLinked && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowOptions((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-200 transition-colors min-h-[28px]"
                  aria-expanded={showOptions}
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {t('salon.create.optionsToggle')}
                  {form.youtubePlaylist && !showOptions && (
                    <span className="text-[10px] text-purple-400 truncate max-w-[10rem]">
                      · {form.youtubePlaylist.title}
                    </span>
                  )}
                </button>

                {showOptions && (
                  <div className="mt-0.5">
                    <CreateSalonPlaylistPicker
                      token={token}
                      compact
                      value={form.youtubePlaylist}
                      onChange={(youtubePlaylist) => setForm((f) => ({ ...f, youtubePlaylist }))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Suggestions toggle */}
            <div
              className="flex items-center justify-between gap-3 min-h-[32px]"
              title={t('salon.create.allowQueueHint')}
            >
              <p className="text-xs font-medium text-white truncate">
                {t('salon.create.allowQueueTitle')}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={form.allowQueue}
                aria-label={t('salon.create.allowQueueTitle')}
                onClick={() => setForm((f) => ({ ...f, allowQueue: !f.allowQueue }))}
                className={`relative inline-flex w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
                  form.allowQueue ? 'bg-purple-600' : 'bg-[#2d2d3d]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    form.allowQueue ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-[#1e1e2f] px-4 py-2.5 space-y-1.5">
          {submitBlockedReason && (
            <p className="text-[10px] text-red-400/90 text-center leading-snug">
              {submitBlockedReason}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving || !canSubmitSalon}
            className="w-full min-h-[44px] rounded-xl bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('salon.create.submitting') : t('salon.create.submit')}
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
