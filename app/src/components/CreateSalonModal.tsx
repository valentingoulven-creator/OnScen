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
  resolveSalonCreatePosition,
} from '../lib/salonCreateFlow';
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
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftSalonId, setDraftSalonId] = useState(() => generateSalonId());
  const [toast, setToast] = useState<string | null>(null);
  const openedAtRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<CreateSalonForm>({
    title: `Salon de ${username}`,
    platform: 'youtube',
    accessMode: 'public',
    allowedUserIds: [],
    trackTitle: 'Ma session Soundy',
    artist: username,
    youtubePlaylist: null,
    allowQueue: true,
  });

  const skipAccessStep = preset?.accessMode === 'invite';

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!open || !token) return;
    openedAtRef.current = Date.now();
    setStep(1);
    setToast(null);
    setDraftSalonId(generateSalonId());
    setForm({
      title: preset?.title?.trim() || `Salon de ${username}`,
      platform: 'youtube',
      accessMode: preset?.accessMode ?? 'public',
      allowedUserIds: preset?.allowedUserIds ?? [],
      trackTitle: 'Ma session Soundy',
      artist: username,
      youtubePlaylist: null,
      allowQueue: true,
    });
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [open, token, username, preset]);

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

  const resolvePosition = () => resolveSalonCreatePosition(fallbackLatitude, fallbackLongitude);

  const platformLinked = isMusicPlatformLinkedForSalon('youtube', connectedPlatforms, platformLinks);
  const canAdvanceFromStep1 = platformLinked;
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-salon-title"
      onClick={handleBackdropClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-[#12121a] rounded-t-2xl sm:rounded-2xl border border-[#2d2d3d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#12121a] border-b border-[#1e1e2f] px-4 py-3 flex items-center justify-between">
          <h2 id="create-salon-title" className="font-bold text-white">
            Créer un salon
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-1 text-[10px] text-gray-500">
            <span className={step >= 1 ? 'text-purple-400' : ''}>1. Musique</span>
            {!skipAccessStep && (
              <>
                <span>·</span>
                <span className={step >= 2 ? 'text-purple-400' : ''}>2. Accès</span>
              </>
            )}
            <span>·</span>
            <span className={step >= 3 ? 'text-purple-400' : ''}>
              {skipAccessStep ? '2. Détails' : '3. Détails'}
            </span>
          </div>

          {step === 1 && (
            <>
              <p className="text-sm text-gray-400">Salon YouTube — lecture synchronisée dans Soundy</p>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2.5 text-[11px] text-purple-100 leading-snug">
                <strong className="text-white">YouTube</strong> — {t('salon.playbackMode.youtubeSync')}{' '}
                <strong className="text-white">{t('salon.playbackMode.youtubeSyncEmphasis')}</strong>{' '}
                {t('salon.playbackMode.youtubeSyncSuffix')}
              </div>
              <div className="p-4 rounded-2xl border border-red-500 bg-red-500/10 text-left">
                <span className="text-2xl block mb-2">▶️</span>
                <span className="font-bold text-white">YouTube</span>
                <p className="text-[10px] text-gray-500 mt-1">Lecture vidéo YouTube synchronisée</p>
              </div>
              {!platformLinked && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400/90">
                    Liez votre compte YouTube pour héberger ce salon.
                  </p>
                  <PlatformConnectCard
                    token={token}
                    platform="youtube"
                    connectedPlatforms={connectedPlatforms}
                    platformLinks={platformLinks}
                    onUserUpdated={onUserUpdated}
                  />
                </div>
              )}
              {platformLinked && (
                <p className="text-[10px] text-green-400/80">
                  ✓ Compte YouTube connecté — vous pouvez héberger ce salon.
                </p>
              )}
              <label className="block">
                <span className="text-xs text-gray-400">Artiste</span>
                <input
                  value={form.artist}
                  onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
                  placeholder="Nom de l'artiste"
                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-400">Titre du salon</span>
                <input
                  value={form.trackTitle}
                  onChange={(e) => setForm((f) => ({ ...f, trackTitle: e.target.value }))}
                  placeholder="Ex. Midnight City"
                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                />
              </label>
              {platformLinked && (
                <CreateSalonPlaylistPicker
                  token={token}
                  value={form.youtubePlaylist}
                  onChange={(youtubePlaylist) => setForm((f) => ({ ...f, youtubePlaylist }))}
                />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-400">Qui peut rejoindre votre salon ?</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, accessMode: 'public' }))}
                  className={`w-full p-4 rounded-xl border text-left ${
                    form.accessMode === 'public'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[#2d2d3d] bg-[#1a1a26]'
                  }`}
                >
                  <p className="font-bold text-white">🌍 Public</p>
                  <p className="text-xs text-gray-500 mt-1">Visible sur la carte, tout le monde peut rejoindre</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, accessMode: 'invite' }))}
                  className={`w-full p-4 rounded-xl border text-left ${
                    form.accessMode === 'invite'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[#2d2d3d] bg-[#1a1a26]'
                  }`}
                >
                  <p className="font-bold text-white">🔒 Sur invitation</p>
                  <p className="text-xs text-gray-500 mt-1">Seules les personnes autorisées peuvent entrer</p>
                </button>
              </div>

              {form.accessMode === 'invite' && (
                <div className="space-y-3 border border-[#2d2d3d] rounded-xl p-3">
                  <SalonInviteLinkCopy salonId={draftSalonId} />
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Inviter des utilisateurs :</p>
                    <SalonInviteUserSearch
                      token={token}
                      contacts={contacts}
                      allowedUserIds={allowedUserIdsSet}
                      onToggle={toggleGuest}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <label className="block">
                <span className="text-xs text-gray-400">Titre du salon</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowQueue}
                  onChange={(e) => setForm((f) => ({ ...f, allowQueue: e.target.checked }))}
                />
                <span className="text-sm text-gray-300">Autoriser les suggestions de morceaux</span>
              </label>
              {skipAccessStep && form.accessMode === 'invite' && (
                <div className="space-y-3 border border-[#2d2d3d] rounded-xl p-3">
                  <SalonInviteLinkCopy salonId={draftSalonId} />
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Inviter des utilisateurs :</p>
                    <SalonInviteUserSearch
                      token={token}
                      contacts={contacts}
                      allowedUserIds={allowedUserIdsSet}
                      onToggle={toggleGuest}
                    />
                  </div>
                </div>
              )}
              <div className="bg-[#1a1a26] rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p>
                  <span className="text-purple-400">Playlist :</span>{' '}
                  {form.youtubePlaylist ? form.youtubePlaylist.title : 'Aucune (optionnel)'}
                </p>
                <p>
                  <span className="text-purple-400">Session :</span> {form.trackTitle} — {form.artist}
                </p>
                <p>
                  <span className="text-purple-400">Plateforme :</span> YouTube
                </p>
                <p>
                  <span className="text-purple-400">Accès :</span>{' '}
                  {form.accessMode === 'public' ? 'Public' : `Invitation (${form.allowedUserIds.length} invité(s))`}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#12121a] border-t border-[#1e1e2f] p-4 flex gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 && skipAccessStep ? 1 : s - 1))}
              className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300"
            >
              Retour
            </button>
          ) : (
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300">
              Annuler
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 && skipAccessStep ? 3 : s + 1))}
              disabled={step === 1 && !canAdvanceFromStep1}
              className="flex-1 py-3 rounded-xl bg-purple-600 font-bold text-white disabled:opacity-50"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !canSubmitSalon}
              className="flex-1 py-3 rounded-xl bg-purple-600 font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Création...' : 'Créer le salon'}
            </button>
          )}
        </div>
        {step === 3 && submitBlockedReason && (
          <p className="px-4 pb-3 text-[11px] text-red-400/90 leading-snug">{submitBlockedReason}</p>
        )}
        {toast && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] max-w-[min(90vw,22rem)] px-4 py-2.5 rounded-xl bg-[#1a1a28] border border-purple-500/40 text-sm text-white shadow-lg text-center"
            role="status"
          >
            {toast}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
