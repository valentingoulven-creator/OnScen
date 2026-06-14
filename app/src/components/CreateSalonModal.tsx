import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { toSpotifyPlaylistRef, translateSalonCreateError, translateSpotifySessionCode } from '../lib/spotifyPlaylistSession';
import { isPlatformConnected } from '../lib/platformConnect';
import { generateSalonId } from '../lib/salonDeepLink';
import { copyShareLink, getSalonShareUrl } from '../lib/shareLink';
import { PLATFORM_STATUS_REFRESH_EVENT } from '../lib/platformStatusEvents';
import {
  buildPlaylistLoadBody,
  deferSalonPlaylistLoad,
  resolveSalonCreatePosition,
  shouldVerifySpotifyPlaylistOnCreate,
} from '../lib/salonCreateFlow';
import { PlatformConnectCard } from './PlatformConnectCard';
import { CreateSalonYouTubePicker } from './CreateSalonYouTubePicker';
import { CreateSalonSpotifyPicker } from './CreateSalonSpotifyPicker';
import { CreateSalonSpotifyPlaylistPicker } from './CreateSalonSpotifyPlaylistPicker';
import {
  CreateSalonPlaylistPicker,
  type CreateSalonPlaylistSelection,
} from './CreateSalonPlaylistPicker';
import { SalonInviteLinkCopy } from './SalonInviteLinkCopy';
import { SalonInviteUserSearch } from './SalonInviteUserSearch';
import type { DmContact, Salon, User } from '../types';

export interface CreateSalonForm {
  title: string;
  platform: 'spotify' | 'youtube';
  accessMode: 'public' | 'invite';
  allowedUserIds: string[];
  musicSource: 'track' | 'playlist';
  trackLink: string;
  trackTitle: string;
  artist: string;
  youtubePlaylist: CreateSalonPlaylistSelection | null;
  spotifyPlaylist: CreateSalonPlaylistSelection | null;
  allowQueue: boolean;
}

/** Préremplissage (ex. salon privé depuis un fil DM). */
export type CreateSalonModalPreset = {
  platform?: 'spotify' | 'youtube';
  accessMode?: 'public' | 'invite';
  allowedUserIds?: string[];
  title?: string;
};

interface CreateSalonModalProps {
  token: string;
  username: string;
  connectedPlatforms?: User['connectedPlatforms'];
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
  const [spotifyPremium, setSpotifyPremium] = useState<boolean | undefined>();
  const [spotifySessionValid, setSpotifySessionValid] = useState<boolean | undefined>();
  const [spotifySessionCode, setSpotifySessionCode] = useState<string | undefined>();
  const [platformStatusLoading, setPlatformStatusLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const openedAtRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<CreateSalonForm>({
    title: `Salon de ${username}`,
    platform: 'youtube',
    accessMode: 'public',
    allowedUserIds: [],
    musicSource: 'track',
    trackLink: '',
    trackTitle: 'Ma session Soundy',
    artist: username,
    youtubePlaylist: null,
    spotifyPlaylist: null,
    allowQueue: true,
  });

  const skipAccessStep = preset?.accessMode === 'invite';
  const lockedPlatform = preset?.platform;

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
    setSpotifyPremium(undefined);
    setSpotifySessionValid(undefined);
    setSpotifySessionCode(undefined);
    setForm({
      title: preset?.title?.trim() || `Salon de ${username}`,
      platform: preset?.platform ?? 'youtube',
      accessMode: preset?.accessMode ?? 'public',
      allowedUserIds: preset?.allowedUserIds ?? [],
      musicSource: 'track',
      trackLink: '',
      trackTitle: 'Ma session Soundy',
      artist: username,
      youtubePlaylist: null,
      spotifyPlaylist: null,
      allowQueue: true,
    });
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [open, token, username, preset]);

  const refreshPlatformStatus = (fresh = false) => {
    if (!token) return;
    setPlatformStatusLoading(true);
    api
      .getPlatformStatus(token, fresh ? { fresh: true } : undefined)
      .then((s) => {
        setSpotifyPremium(s.spotifyPremium);
        setSpotifySessionValid(s.spotifySessionValid);
        setSpotifySessionCode(s.spotifySessionCode);
      })
      .catch(() => {
        setSpotifyPremium(undefined);
        setSpotifySessionValid(undefined);
        setSpotifySessionCode(undefined);
      })
      .finally(() => setPlatformStatusLoading(false));
  };

  useEffect(() => {
    if (!open || !token) return;
    refreshPlatformStatus();
  }, [open, token, connectedPlatforms]);

  useEffect(() => {
    if (!open) return;
    const onRefresh = () => refreshPlatformStatus(true);
    window.addEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
  }, [open, token]);

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

  const platformLinked = isPlatformConnected(connectedPlatforms, form.platform);
  const spotifyLinked = isPlatformConnected(connectedPlatforms, 'spotify');
  const spotifyHostBlocked =
    spotifyLinked &&
    (spotifySessionCode === 'spotify_premium_required' || spotifyPremium === false);
  const spotifySessionBlocked =
    spotifyLinked &&
    spotifySessionValid === false &&
    (spotifySessionCode === 'spotify_token_expired' ||
      spotifySessionCode === 'spotify_scope_missing' ||
      spotifySessionCode === 'spotify_not_connected');
  const platformHostReady =
    platformLinked && !(form.platform === 'spotify' && (spotifyHostBlocked || spotifySessionBlocked));
  /** Step 1 only — wait for Spotify status before advancing (MODIF 465/467). */
  const canAdvanceFromStep1 =
    platformHostReady &&
    !(form.platform === 'spotify' && spotifyLinked && platformStatusLoading);
  /** Step 3 — do not re-block on background Spotify refresh (fix MODIF 475). */
  const canSubmitSalon = platformHostReady;

  const submitBlockedReason = !canSubmitSalon
    ? !platformLinked
      ? form.platform === 'spotify'
        ? t('salon.create.errorPlatformNotLinkedSpotify')
        : t('salon.create.errorPlatformNotLinkedYoutube')
      : form.platform === 'spotify' && spotifyHostBlocked
        ? t('salon.create.spotifyPremiumRequired')
        : form.platform === 'spotify' && spotifySessionBlocked
          ? translateSpotifySessionCode(t, spotifySessionCode) ??
            t('salon.spotifySearch.errorTokenExpired')
          : null
    : null;

  const resolveCreateError = (e: unknown): string => translateSalonCreateError(t, e, form.platform);

  const submit = async () => {
    if (!canSubmitSalon) {
      showToast(submitBlockedReason ?? t('salon.create.errorFailed'));
      return;
    }
    setSaving(true);
    try {
      const useYoutubePlaylist =
        form.platform === 'youtube' && form.musicSource === 'playlist' && form.youtubePlaylist;
      const useSpotifyPlaylist =
        form.platform === 'spotify' && form.musicSource === 'playlist' && form.spotifyPlaylist;
      const usePlaylist = useYoutubePlaylist || useSpotifyPlaylist;
      const spotifyVerifyRef =
        useSpotifyPlaylist && form.spotifyPlaylist && shouldVerifySpotifyPlaylistOnCreate(form.spotifyPlaylist)
          ? toSpotifyPlaylistRef(form.spotifyPlaylist)
          : null;

      const [{ latitude, longitude }] = await Promise.all([
        resolvePosition(),
        spotifyVerifyRef
          ? api.verifySpotifyPlaylistAccess(token, spotifyVerifyRef)
          : Promise.resolve(),
      ]);

      const { salon } = await api.createSalon(token, {
        ...(form.accessMode === 'invite' ? { id: draftSalonId } : {}),
        title: form.title.trim(),
        platform: form.platform,
        latitude,
        longitude,
        accessMode: form.accessMode,
        allowedUserIds: form.accessMode === 'invite' ? form.allowedUserIds : [],
        trackLink: usePlaylist ? undefined : form.trackLink.trim() || undefined,
        trackTitle: useYoutubePlaylist
          ? form.youtubePlaylist!.title
          : useSpotifyPlaylist
            ? form.spotifyPlaylist!.title
            : form.trackTitle.trim(),
        artist: form.artist.trim(),
        allowQueue: form.allowQueue,
      });

      const playlistLoadBody = usePlaylist
        ? buildPlaylistLoadBody(form.platform, form.youtubePlaylist, form.spotifyPlaylist)
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
      showToast(resolveCreateError(e));
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
              <p className="text-sm text-gray-400">
                {lockedPlatform
                  ? `Salon ${lockedPlatform === 'spotify' ? 'Spotify' : 'YouTube'} privé`
                  : "Choisissez l'application liée à votre salon"}
              </p>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2.5 text-[11px] text-purple-100 leading-snug">
                <strong className="text-white">YouTube</strong> — {t('salon.playbackMode.youtubeSync')}{' '}
                <strong className="text-white">{t('salon.playbackMode.youtubeSyncEmphasis')}</strong>{' '}
                {t('salon.playbackMode.youtubeSyncSuffix')}
                <br />
                <strong className="text-white">Spotify</strong> — {t('salon.playbackMode.spotifyChrono')}
              </div>
              {lockedPlatform ? (
                <div
                  className={`p-4 rounded-2xl border text-left ${
                    lockedPlatform === 'spotify'
                      ? spotifyHostBlocked
                        ? 'border-gray-500/50 bg-gray-500/5 opacity-50 cursor-not-allowed'
                        : 'border-green-500 bg-green-500/10'
                      : 'border-red-500 bg-red-500/10'
                  }`}
                  title={
                    lockedPlatform === 'spotify' && spotifyHostBlocked
                      ? t('salon.create.spotifyPremiumRequired')
                      : undefined
                  }
                >
                  <span className="text-2xl block mb-2">{lockedPlatform === 'spotify' ? '🎧' : '▶️'}</span>
                  <span className="font-bold text-white capitalize">{lockedPlatform}</span>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {lockedPlatform === 'spotify' && spotifyHostBlocked
                      ? t('salon.create.spotifyPremiumRequired')
                      : lockedPlatform === 'spotify'
                        ? t('salon.playbackMode.spotifyChrono')
                        : 'Lecture vidéo YouTube'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(['youtube', 'spotify'] as const).map((p) => {
                    const isSpotifyBlocked = p === 'spotify' && spotifyHostBlocked;
                    return (
                    <button
                      key={p}
                      type="button"
                      disabled={isSpotifyBlocked}
                      title={isSpotifyBlocked ? t('salon.create.spotifyPremiumRequired') : undefined}
                      onClick={() => {
                        if (isSpotifyBlocked) return;
                        setForm((f) => ({
                          ...f,
                          platform: p,
                          ...(p === 'spotify'
                            ? { musicSource: 'track' as const, youtubePlaylist: null, spotifyPlaylist: null }
                            : { spotifyPlaylist: null }),
                        }));
                      }}
                      className={`p-4 rounded-2xl border text-left transition ${
                        isSpotifyBlocked
                          ? 'border-gray-500/50 bg-gray-500/5 opacity-50 cursor-not-allowed'
                          : form.platform === p
                          ? p === 'spotify'
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-red-500 bg-red-500/10'
                          : 'border-[#2d2d3d] bg-[#1a1a26]'
                      }`}
                    >
                      <span className="text-2xl block mb-2">{p === 'spotify' ? '🎧' : '▶️'}</span>
                      <span className="font-bold text-white capitalize">{p}</span>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {isSpotifyBlocked
                          ? t('salon.create.spotifyPremiumRequired')
                          : p === 'spotify'
                            ? t('salon.playbackMode.spotifyChrono')
                            : 'Lecture vidéo YouTube'}
                      </p>
                    </button>
                    );
                  })}
                </div>
              )}
              {!platformLinked && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400/90">
                    Liez votre compte {form.platform === 'spotify' ? 'Spotify' : 'YouTube'} pour héberger ce salon.
                  </p>
                  <PlatformConnectCard
                    token={token}
                    platform={form.platform}
                    connectedPlatforms={connectedPlatforms}
                    onUserUpdated={onUserUpdated}
                  />
                </div>
              )}
              {platformLinked && form.platform === 'spotify' && spotifyHostBlocked && (
                <p className="text-[10px] text-red-400/90 leading-snug">
                  {t('salon.create.spotifyPremiumRequired')}
                </p>
              )}
              {platformLinked && !(form.platform === 'spotify' && spotifyHostBlocked) && (
                <p className="text-[10px] text-green-400/80">
                  ✓ Compte {form.platform} connecté — vous pouvez héberger ce salon.
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
              {form.platform === 'spotify' ? (
                platformLinked ? (
                  <div className="space-y-3">
                    <div className="flex gap-1 rounded-xl bg-[#1a1a26] p-1 border border-[#2d2d3d]">
                      {(
                        [
                          { id: 'track' as const, label: 'Morceau' },
                          { id: 'playlist' as const, label: 'Playlist' },
                        ] as const
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              musicSource: id,
                              ...(id === 'track' ? { spotifyPlaylist: null } : { trackLink: '' }),
                            }))
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                            form.musicSource === id
                              ? 'bg-green-600 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.musicSource === 'track' ? (
                      <CreateSalonSpotifyPicker
                        token={token}
                        value={
                          form.trackLink.trim()
                            ? {
                                trackLink: form.trackLink,
                                trackTitle: form.trackTitle,
                                artist: form.artist,
                              }
                            : null
                        }
                        onChange={(selection) => {
                          if (!selection) {
                            setForm((f) => ({ ...f, trackLink: '' }));
                            return;
                          }
                          setForm((f) => ({
                            ...f,
                            trackLink: selection.trackLink,
                            trackTitle: selection.trackTitle,
                            artist: selection.artist,
                          }));
                        }}
                      />
                    ) : (
                      <CreateSalonSpotifyPlaylistPicker
                        token={token}
                        value={form.spotifyPlaylist}
                        onChange={(spotifyPlaylist) => setForm((f) => ({ ...f, spotifyPlaylist }))}
                      />
                    )}
                  </div>
                ) : null
              ) : (
                platformLinked && (
                  <div className="space-y-3">
                    <div className="flex gap-1 rounded-xl bg-[#1a1a26] p-1 border border-[#2d2d3d]">
                      {(
                        [
                          { id: 'track' as const, label: 'Morceau' },
                          { id: 'playlist' as const, label: 'Playlist' },
                        ] as const
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              musicSource: id,
                              ...(id === 'track' ? { youtubePlaylist: null } : { trackLink: '' }),
                            }))
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                            form.musicSource === id
                              ? 'bg-purple-600 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.musicSource === 'track' ? (
                      <CreateSalonYouTubePicker
                        token={token}
                        value={
                          form.trackLink.trim()
                            ? {
                                trackLink: form.trackLink,
                                trackTitle: form.trackTitle,
                                artist: form.artist,
                              }
                            : null
                        }
                        onChange={(selection) => {
                          if (!selection) {
                            setForm((f) => ({ ...f, trackLink: '' }));
                            return;
                          }
                          setForm((f) => ({
                            ...f,
                            trackLink: selection.trackLink,
                            trackTitle: selection.trackTitle,
                            artist: selection.artist,
                          }));
                        }}
                      />
                    ) : (
                      <CreateSalonPlaylistPicker
                        token={token}
                        value={form.youtubePlaylist}
                        onChange={(youtubePlaylist) => setForm((f) => ({ ...f, youtubePlaylist }))}
                      />
                    )}
                  </div>
                )
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
                  <span className="text-purple-400">
                    {form.platform === 'youtube' && form.musicSource === 'playlist'
                      ? 'Playlist'
                      : form.platform === 'spotify' && form.musicSource === 'playlist'
                        ? 'Playlist'
                        : 'Morceau'}{' '}
                    :
                  </span>{' '}
                  {form.platform === 'youtube' && form.musicSource === 'playlist' && form.youtubePlaylist
                    ? form.youtubePlaylist.title
                    : form.platform === 'spotify' && form.musicSource === 'playlist' && form.spotifyPlaylist
                      ? form.spotifyPlaylist.title
                      : `${form.trackTitle} — ${form.artist}`}
                </p>
                <p>
                  <span className="text-purple-400">Plateforme :</span> {form.platform}
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
