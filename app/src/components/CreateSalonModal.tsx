import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { getLivesGeo, isFixedMapGeoSource } from '../lib/livesGeo';
import { isPlatformConnected } from '../lib/platformConnect';
import { copyShareLink, getSalonShareUrl } from '../lib/shareLink';
import { PlatformConnectCard } from './PlatformConnectCard';
import { SpotifyJamLinkField } from './SpotifyJamLinkField';
import { CreateSalonYouTubePicker } from './CreateSalonYouTubePicker';
import {
  CreateSalonPlaylistPicker,
  type CreateSalonPlaylistSelection,
} from './CreateSalonPlaylistPicker';
import { SalonInviteLinkCopy } from './SalonInviteLinkCopy';
import { SalonInviteUserSearch } from './SalonInviteUserSearch';
import { normalizeSpotifyJamUrl } from '../lib/spotifyJam';
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
  allowQueue: boolean;
  spotifyJamUrl: string;
}

interface CreateSalonModalProps {
  token: string;
  username: string;
  connectedPlatforms?: User['connectedPlatforms'];
  open: boolean;
  fallbackLatitude: number;
  fallbackLongitude: number;
  onClose: () => void;
  onCreated: (salon: Salon, lat: number, lon: number) => void;
  onUserUpdated?: (user: User) => void;
}

export function CreateSalonModal({
  token,
  username,
  connectedPlatforms,
  open,
  fallbackLatitude,
  fallbackLongitude,
  onClose,
  onCreated,
  onUserUpdated,
}: CreateSalonModalProps) {
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [createdInviteSalonId, setCreatedInviteSalonId] = useState<string | null>(null);
  const openedAtRef = useRef(0);
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
    allowQueue: true,
    spotifyJamUrl: '',
  });

  useEffect(() => {
    if (!open || !token) return;
    openedAtRef.current = Date.now();
    setStep(1);
    setCreatedInviteSalonId(null);
    setForm({
      title: `Salon de ${username}`,
      platform: 'youtube',
      accessMode: 'public',
      allowedUserIds: [],
      musicSource: 'track',
      trackLink: '',
      trackTitle: 'Ma session Soundy',
      artist: username,
      youtubePlaylist: null,
      allowQueue: true,
      spotifyJamUrl: '',
    });
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [open, token, username]);

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

  const resolvePosition = async (): Promise<{ latitude: number; longitude: number }> => {
    const geo = getLivesGeo();
    // City or address mode: use the chosen reference point, never GPS
    if (isFixedMapGeoSource(geo.source)) {
      return { latitude: fallbackLatitude, longitude: fallbackLongitude };
    }
    // GPS mode: try to get real position, fall back to stored coords
    if (!navigator.geolocation) {
      return { latitude: fallbackLatitude, longitude: fallbackLongitude };
    }
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000 })
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return { latitude: fallbackLatitude, longitude: fallbackLongitude };
    }
  };

  const platformLinked = isPlatformConnected(connectedPlatforms, form.platform);

  const submit = async () => {
    if (!isPlatformConnected(connectedPlatforms, form.platform)) {
      alert(
        form.platform === 'spotify'
          ? 'Connectez Spotify avant de créer un salon Spotify.'
          : 'Connectez YouTube avant de créer un salon YouTube.'
      );
      return;
    }
    if (form.platform === 'spotify' && form.spotifyJamUrl.trim()) {
      if (!normalizeSpotifyJamUrl(form.spotifyJamUrl)) {
        alert('Le lien Jam Spotify n’est pas valide. Utilisez un lien open.spotify.com/socialsession/…');
        return;
      }
    }

    setSaving(true);
    try {
      const { latitude, longitude } = await resolvePosition();
      const jamNormalized =
        form.platform === 'spotify' && form.spotifyJamUrl.trim()
          ? normalizeSpotifyJamUrl(form.spotifyJamUrl.trim())
          : undefined;
      const usePlaylist = form.platform === 'youtube' && form.musicSource === 'playlist' && form.youtubePlaylist;
      const { salon } = await api.createSalon(token, {
        title: form.title.trim(),
        platform: form.platform,
        latitude,
        longitude,
        accessMode: form.accessMode,
        allowedUserIds: form.accessMode === 'invite' ? form.allowedUserIds : [],
        trackLink: usePlaylist ? undefined : form.trackLink.trim() || undefined,
        trackTitle: usePlaylist ? form.youtubePlaylist!.title : form.trackTitle.trim(),
        artist: form.artist.trim(),
        allowQueue: form.allowQueue,
        ...(jamNormalized ? { spotifyJamUrl: jamNormalized } : {}),
      });
      if (usePlaylist && form.youtubePlaylist) {
        const body = form.youtubePlaylist.playlistUrl
          ? { playlistUrl: form.youtubePlaylist.playlistUrl }
          : form.youtubePlaylist.playlistId
            ? { playlistId: form.youtubePlaylist.playlistId }
            : null;
        if (body) {
          await api.salonLoadYoutubePlaylist(token, salon.id, body);
        }
      }
      if (form.accessMode === 'invite') {
        setCreatedInviteSalonId(salon.id);
        const shareUrl = await getSalonShareUrl(salon.id);
        await copyShareLink(shareUrl);
      }
      onCreated(salon, latitude, longitude);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de créer le salon');
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
            <span>·</span>
            <span className={step >= 2 ? 'text-purple-400' : ''}>2. Accès</span>
            <span>·</span>
            <span className={step >= 3 ? 'text-purple-400' : ''}>3. Détails</span>
          </div>

          {step === 1 && (
            <>
              <p className="text-sm text-gray-400">Choisissez l&apos;application liée à votre salon</p>
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2.5 text-[11px] text-purple-100 leading-snug">
                <strong className="text-white">YouTube</strong> permet aux participants d&apos;écouter le même
                morceau <strong className="text-white">en même temps</strong> dans Soundly (lecteur synchronisé).
                Avec Spotify, ils suivent le chrono partagé dans leur app.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['youtube', 'spotify'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        platform: p,
                        ...(p === 'spotify' ? { musicSource: 'track' as const, youtubePlaylist: null } : {}),
                      }))
                    }
                    className={`p-4 rounded-2xl border text-left transition ${
                      form.platform === p
                        ? p === 'spotify'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                        : 'border-[#2d2d3d] bg-[#1a1a26]'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{p === 'spotify' ? '🎧' : '▶️'}</span>
                    <span className="font-bold text-white capitalize">{p}</span>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {p === 'spotify' ? 'Jam / écoute partagée' : 'Lecture vidéo YouTube'}
                    </p>
                  </button>
                ))}
              </div>
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
              {platformLinked && (
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
                <label className="block">
                  <span className="text-xs text-gray-400">Lien morceau Spotify (optionnel)</span>
                  <input
                    value={form.trackLink}
                    onChange={(e) => setForm((f) => ({ ...f, trackLink: e.target.value }))}
                    placeholder="https://open.spotify.com/track/..."
                    className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white"
                  />
                </label>
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
              {form.platform === 'spotify' && platformLinked && (
                <p className="text-[10px] text-gray-500 leading-snug">
                  Les playlists Spotify ne sont pas encore disponibles — choisissez YouTube ou un lien morceau.
                </p>
              )}
              {form.platform === 'spotify' && platformLinked && (
                <SpotifyJamLinkField
                  value={form.spotifyJamUrl}
                  onChange={(spotifyJamUrl) => setForm((f) => ({ ...f, spotifyJamUrl }))}
                  variant="create"
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
                  <SalonInviteLinkCopy salonId={createdInviteSalonId ?? undefined} />
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
              <div className="bg-[#1a1a26] rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p>
                  <span className="text-purple-400">
                    {form.platform === 'youtube' && form.musicSource === 'playlist' ? 'Playlist' : 'Morceau'} :
                  </span>{' '}
                  {form.platform === 'youtube' && form.musicSource === 'playlist' && form.youtubePlaylist
                    ? form.youtubePlaylist.title
                    : `${form.trackTitle} — ${form.artist}`}
                </p>
                <p>
                  <span className="text-purple-400">Plateforme :</span> {form.platform}
                </p>
                {form.platform === 'spotify' && form.spotifyJamUrl.trim() && (
                  <p>
                    <span className="text-purple-400">Jam :</span>{' '}
                    {normalizeSpotifyJamUrl(form.spotifyJamUrl) ? 'lien fourni' : 'lien invalide'}
                  </p>
                )}
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
              onClick={() => setStep((s) => s - 1)}
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
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !platformLinked}
              className="flex-1 py-3 rounded-xl bg-purple-600 font-bold text-white disabled:opacity-50"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !platformLinked}
              className="flex-1 py-3 rounded-xl bg-purple-600 font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Création...' : 'Créer le salon'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
