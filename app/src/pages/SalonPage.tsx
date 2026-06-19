import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SOUNDY_BASE_URL = 'https://getsoundy.com';

import { useAuth } from '../context/AuthContext';
import { isPlatformConnected } from '../lib/platformConnect';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';

import { api, ApiRequestError } from '../lib/api';
import { openSpotifyApp } from '../lib/spotifyDeepLink';

import { getSocket } from '../lib/socket';

import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { UsernameDisplay } from '../components/UsernameDisplay';

import { HostRatingBlock } from '../components/HostRatingBlock';

import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { SalonPlaybackPanel } from '../components/SalonPlaybackPanel';
import { SalonYouTubeHostPanel } from '../components/SalonYouTubeHostPanel';
import { SalonYouTubeSearch } from '../components/SalonYouTubeSearch';
import { SalonSpotifySearch } from '../components/SalonSpotifySearch';
import { SalonSpotifyPlaylist } from '../components/SalonSpotifyPlaylist';
import { SalonQueueSection } from '../components/SalonQueueSection';
import { SalonProposalsSection } from '../components/SalonProposalsSection';
import { SalonAccessModeToggle } from '../components/SalonAccessModeToggle';
import { SalonInviteLinkCopy } from '../components/SalonInviteLinkCopy';
import { SalonInviteSheet } from '../components/SalonInviteSheet';
import { SalonInviteUserSearch } from '../components/SalonInviteUserSearch';
import { SalonParticipantsPopover } from '../components/SalonParticipantsPopover';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';
import { emitOnSocket } from '../lib/socket';
import { ConfirmModal } from '../components/ConfirmModal';

import { formatSalonAudienceLabel } from '../lib/salonAudience';
import type { DmContact, PlaybackState, Salon } from '../types';

const SALON_MAX_DURATION_MS = 2 * 60 * 60 * 1000;
const SALON_CHAT_HIDDEN_KEY = 'soundly_salon_chat_hidden';
const SALON_CHAT_MINIMIZED_KEY = 'soundly_salon_chat_minimized';

function readSalonChatHidden(): boolean {
  if (window.innerWidth < 640) return true;
  try {
    return localStorage.getItem(SALON_CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function readSalonChatMinimized(): boolean {
  try {
    return localStorage.getItem(SALON_CHAT_MINIMIZED_KEY) === '1';
  } catch {
    return false;
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m} min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}



export function SalonPage({
  salonId,
  onBack,
  onLeaveSalon,
  onMinimizeToMap,
  onSalonLoaded,
}: {
  salonId: string;
  onBack: () => void;
  /** Quitter définitivement le salon (session effacée). */
  onLeaveSalon?: () => void;
  /** Quitte le grand salon et rouvre la fiche carte (petit salon). */
  onMinimizeToMap?: (salonTitle?: string) => void;
  /** Titre chargé (barre retour header). */
  onSalonLoaded?: (salonTitle?: string) => void;
}) {

  const { user, token, setUserFromProfile } = useAuth();
  const { t } = useTranslation();

  const [salon, setSalon] = useState<Salon | null>(null);

  const [contacts, setContacts] = useState<DmContact[]>([]);

  const [endingSalon, setEndingSalon] = useState(false);
  const [showEndSalonConfirm, setShowEndSalonConfirm] = useState(false);

  const [accessSaving, setAccessSaving] = useState(false);
  const [validatingGuests, setValidatingGuests] = useState(false);
  const [pendingGuestIds, setPendingGuestIds] = useState<Set<string>>(new Set());
  const [skipping, setSkipping] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [chatHidden, setChatHidden] = useState(readSalonChatHidden);
  const [chatMinimized, setChatMinimized] = useState(readSalonChatMinimized);
  const [shareCopied, setShareCopied] = useState(false);

  const [sessionEnded, setSessionEnded] = useState(false);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const spotifyQueueLaunchRef = useRef(false);
  const spotifyQueueRetryRef = useRef<number | null>(null);

  const loadSalon = useCallback(() => {
    if (!token) return;
    setLoadError(null);
    api
      .getSalon(token, salonId)
      .then((r) => {
        setSalon(r.salon);
        setLoadError(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : t('salon.inaccessible');
        setLoadError(msg);
        setToastMsg(msg);
      });
  }, [token, salonId, t]);



  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  useEffect(() => {
    loadSalon();
    if (token) api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [loadSalon, token]);

  useEffect(() => {
    if (!salon?.allowedUserIds) return;
    setPendingGuestIds(new Set(salon.allowedUserIds.filter((id) => id !== salon.hostId)));
  }, [salon?.id, salon?.hostId, salon?.allowedUserIds]);

  useEffect(() => {
    if (salon?.title) onSalonLoaded?.(salon.title);
  }, [salon?.title, onSalonLoaded]);



  useEffect(() => {
    if (!salon?.createdAt) return;
    const update = () => {
      const ms = salon.createdAt! + SALON_MAX_DURATION_MS - Date.now();
      setRemainingMs(Math.max(0, ms));
    };
    update();
    const id = window.setInterval(update, 60000);
    return () => window.clearInterval(id);
  }, [salon?.createdAt]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onEnded = (payload: { salonId: string; reason: string }) => {
      if (payload.salonId !== salonId) return;
      if (payload.reason === 'duration_limit') {
        setSessionEnded(true);
        setDurationWarning(false);
      }
    };
    const onWarning = (payload: { type: string; id: string }) => {
      if (payload.type === 'salon' && payload.id === salonId) {
        setDurationWarning(true);
        if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = window.setTimeout(() => {
          warningTimerRef.current = null;
          setDurationWarning(false);
        }, 10000);
      }
    };
    socket.on('salon_ended', onEnded);
    socket.on('session_warning', onWarning);
    return () => {
      socket.off('salon_ended', onEnded);
      socket.off('session_warning', onWarning);
      if (warningTimerRef.current !== null) {
        window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [salonId]);



  useEffect(() => {

    if (!salon || !user || salon.canJoin === false) return;

    const socket = getSocket();
    if (!socket) return;

    const onUpdated = (updated: Salon) => {
      if (updated.id !== salon.id) return;
      setSalon((prev) => {
        if (!prev) return prev;
        const {
          playbackState: incomingPs,
          queue: incomingQueue,
          vipModeratorIds: incomingVips,
          ...rest
        } = updated;
        return {
          ...prev,
          ...rest,
          ...(incomingVips !== undefined ? { vipModeratorIds: incomingVips } : {}),
          playbackState: incomingPs
            ? mergeRemotePlaybackState(prev.playbackState, incomingPs)
            : prev.playbackState,
          queue: incomingQueue ?? prev.queue,
        };
      });
    };

    socket.on('salon_updated', onUpdated);

    return () => {
      socket.off('salon_updated', onUpdated);
    };

  }, [salon?.id, user?.id, salon?.canJoin]);



  const setAccessMode = async (mode: 'public' | 'invite') => {

    if (!token || !salon) return;

    setAccessSaving(true);

    try {

      const { salon: updated } = await api.updateSalonSettings(token, salon.id, { accessMode: mode });

      setSalon(updated);

    } catch (e) {

      setToastMsg(e instanceof Error ? e.message : 'Erreur');

    } finally {

      setAccessSaving(false);

    }

  };



  const togglePendingGuest = (userId: string, checked: boolean) => {
    setPendingGuestIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const validateGuests = async () => {
    if (!token || !salon || salon.accessMode !== 'invite') return;
    setValidatingGuests(true);
    try {
      const { salon: updated, invitedCount } = await api.validateSalonGuests(
        token,
        salon.id,
        [...pendingGuestIds]
      );
      setSalon(updated);
      setPendingGuestIds(new Set(updated.allowedUserIds?.filter((id) => id !== salon.hostId) ?? []));
      if (invitedCount > 0) {
        setToastMsg(
          t('salon.accessInvitesSent', {
            count: invitedCount,
            defaultValue: `Invitations envoyées à ${invitedCount} personne(s)`,
          })
        );
      } else {
        setToastMsg(t('salon.accessValidated', { defaultValue: 'Accès mis à jour' }));
      }
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setValidatingGuests(false);
    }
  };

  const isHost = Boolean(salon && (salon.isHost ?? salon.hostId === user?.id));
  const isDevModerator = Boolean(user?.isAdmin);
  const isVipModerator = Boolean(salon?.isVip);
  const canModerateSalonChat = isHost || isVipModerator || isDevModerator;
  const hostCanControl = Boolean(
    isHost && salon && isPlatformConnected(user?.connectedPlatforms, salon.platform)
  );
  const canControlPlayback = hostCanControl || isVipModerator || isDevModerator;

  const {
    queue,
    proposals,
    loadingProposals,
    skipNext,
    playQueueItem,
    acceptProposal,
    rejectProposal,
    reorderQueue,
    applyQueue,
  } = useSalonQueueSync(salon?.id ?? salonId, token, isHost || isDevModerator, salon?.queue);

  const applyPlayback = useCallback((state: PlaybackState) => {
    setSalon((prev) =>
      prev ? { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) } : prev
    );
  }, []);

  const handleMinimizeSalon = useCallback(() => {
    if (onMinimizeToMap) {
      onMinimizeToMap(salon?.title);
    } else {
      onBack();
    }
  }, [onMinimizeToMap, onBack, salon?.title]);

  const handleShareSalon = useCallback(async () => {
    const url = `${SOUNDY_BASE_URL}/salon/${salonId}`;
    const title = salon?.title ?? 'Salon Soundy';
    const text = `Rejoins ce salon d'écoute musicale sur Soundy !`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      /* share cancelled or not supported */
    }
  }, [salonId, salon?.title]);

  const handleEndSalon = useCallback(async () => {
    if (!token || !salon || !onLeaveSalon) return;

    setEndingSalon(true);
    try {
      if (salon.platform === 'spotify' && salon.playbackState.isPlaying) {
        await api.spotifySalonPlaybackControl(token, salon.id, 'pause').catch(() => {});
      }
      await api.deleteSalon(token, salon.id);
      setShowEndSalonConfirm(false);
      onLeaveSalon();
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : t('common.error', { defaultValue: 'Erreur' }));
    } finally {
      setEndingSalon(false);
    }
  }, [token, salon, onLeaveSalon, t]);

  const banSalonUser = useCallback(
    (targetUserId: string, opts: { permanent: boolean; durationMs?: number }) => {
      if (!salon) return;
      emitOnSocket('salon_ban', {
        salonId: salon.id,
        userId: targetUserId,
        permanent: opts.permanent,
        durationMs: opts.durationMs,
      });
    },
    [salon?.id]
  );

  const minimizeSalonButton = (
    <button
      type="button"
      onClick={handleMinimizeSalon}
      className="salon-header-icon-btn shrink-0"
      aria-label="Réduire le salon"
      title="Réduire le salon"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <polyline
          points="6,9 12,15 18,9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  if (!salon) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-[#0b0b0f] overflow-hidden">
        <header className="relative z-30 shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2f]">
          {minimizeSalonButton}
          <p className="flex-1 min-w-0 text-sm text-gray-400 truncate">
            {loadError
              ? t('salon.inaccessible', { defaultValue: 'Salon inaccessible' })
              : t('common.loading', { defaultValue: 'Chargement…' })}
          </p>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {loadError ? (
            <>
              <p className="text-red-300 text-sm max-w-sm">{loadError}</p>
              <button
                type="button"
                onClick={loadSalon}
                className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500"
              >
                {t('common.retry', { defaultValue: 'Réessayer' })}
              </button>
            </>
          ) : (
            <p className="text-gray-400">{t('common.loading', { defaultValue: 'Chargement…' })}</p>
          )}
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-4xl">⏱</p>
        <p className="text-white font-bold text-lg">Session terminée</p>
        <p className="text-gray-400 text-sm max-w-sm">
          La durée maximale de 2 heures a été atteinte. Le salon a été automatiquement fermé.
        </p>
        <button
          type="button"
          onClick={onLeaveSalon ?? handleMinimizeSalon}
          className="px-5 py-2.5 rounded-full bg-purple-600 text-white font-bold text-sm hover:bg-purple-500"
        >
          Retour
        </button>
      </div>
    );
  }

  const playback = salon.playbackState;

  const handleSkip = async () => {
    if (!canControlPlayback || !token || !salon) return;
    setSkipping(true);
    try {
      const state = await skipNext();
      if (state) applyPlayback(state);
      else setToastMsg('File vide');
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'no_active_device') {
        if (e.playbackState) applyPlayback(e.playbackState);
        if (e.queue) applyQueue(e.queue);
        if (salon.platform === 'spotify' && e.playbackState?.trackId) {
          if (!spotifyQueueLaunchRef.current) {
            spotifyQueueLaunchRef.current = true;
            openSpotifyApp(e.playbackState.trackId);
            window.setTimeout(() => {
              spotifyQueueLaunchRef.current = false;
            }, 5000);
          }
          if (spotifyQueueRetryRef.current !== null) {
            window.clearTimeout(spotifyQueueRetryRef.current);
          }
          spotifyQueueRetryRef.current = window.setTimeout(() => {
            spotifyQueueRetryRef.current = null;
            void api
              .salonChangeTrack(token, salon.id, {
                trackId: e.playbackState!.trackId,
                title: e.playbackState!.title,
                artist: e.playbackState!.artist,
                albumArtUrl: e.playbackState!.albumArtUrl,
              })
              .catch(() => {});
          }, 3500);
        }
        setToastMsg(t('salon.playbackMode.spotifyLaunchingApp'));
        return;
      }
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSkipping(false);
    }
  };

  const handlePlayQueue = async (queueItemId: string) => {
    if (!canControlPlayback || !token || !salon) return;
    try {
      const state = await playQueueItem(queueItemId);
      if (state) applyPlayback(state);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'no_active_device') {
        if (e.playbackState) applyPlayback(e.playbackState);
        if (e.queue) applyQueue(e.queue);
        if (salon.platform === 'spotify' && e.playbackState?.trackId) {
          if (!spotifyQueueLaunchRef.current) {
            spotifyQueueLaunchRef.current = true;
            openSpotifyApp(e.playbackState.trackId);
            window.setTimeout(() => {
              spotifyQueueLaunchRef.current = false;
            }, 5000);
          }
          if (spotifyQueueRetryRef.current !== null) {
            window.clearTimeout(spotifyQueueRetryRef.current);
          }
          spotifyQueueRetryRef.current = window.setTimeout(() => {
            spotifyQueueRetryRef.current = null;
            void api
              .salonChangeTrack(token, salon.id, {
                trackId: e.playbackState!.trackId,
                title: e.playbackState!.title,
                artist: e.playbackState!.artist,
                albumArtUrl: e.playbackState!.albumArtUrl,
              })
              .catch(() => {});
          }, 3500);
        }
        setToastMsg(t('salon.playbackMode.spotifyLaunchingApp'));
        return;
      }
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleReorderQueue = async (orderedIds: string[]) => {
    if (!hostCanControl) return;
    setReordering(true);
    try {
      await reorderQueue(orderedIds);
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setReordering(false);
    }
  };

  const handleAccept = async (proposalId: string, playNow: boolean) => {
    try {
      const state = await acceptProposal(proposalId, playNow);
      if (state) applyPlayback(state);
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };



  const isSpotifyParticipantOnly = salon.platform === 'spotify' && !isHost && !isVipModerator && !isDevModerator;

  const participantProposeSearch =
    !canControlPlayback && salon.allowQueue && token ? (
      salon.platform === 'spotify' ? (
        <SalonSpotifySearch
          salonId={salon.id}
          token={token}
          currentTitle={playback.title}
          currentArtist={playback.artist}
          showCurrentTrack={false}
          submitMode="propose"
        />
      ) : (
        <SalonYouTubeSearch
          salonId={salon.id}
          token={token}
          currentTitle={playback.title}
          currentArtist={playback.artist}
          submitMode="propose"
        />
      )
    ) : null;

  const youtubeHostSettings =
    isHost && salon.accessMode === 'invite' ? (
      <div className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            {t('salon.youtubeHost.inviteLink', { defaultValue: "Lien d'invitation" })}
          </h3>
          <SalonInviteLinkCopy salonId={salon.id} />
        </section>
        {hostCanControl && token ? (
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              {t('salon.youtubeHost.manageAccess', { defaultValue: "Gérer l'accès" })}
            </h3>
            <SalonInviteUserSearch
              token={token}
              contacts={contacts}
              allowedUserIds={pendingGuestIds}
              onToggle={togglePendingGuest}
            />
            <button
              type="button"
              disabled={validatingGuests || accessSaving}
              onClick={() => void validateGuests()}
              className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#42426a] text-white hover:bg-[#52527a] disabled:opacity-50 transition"
            >
              {validatingGuests
                ? 'Envoi…'
                : t('salon.youtubeHost.sendInvites', { defaultValue: 'Envoyer les invitations' })}
            </button>
          </section>
        ) : null}
      </div>
    ) : undefined;

  const stageFooter = isSpotifyParticipantOnly ? (
    participantProposeSearch ? <div className="p-3">{participantProposeSearch}</div> : null
  ) : (
    <>
      {isHost && hostCanControl && salon.platform === 'youtube' && token && (
        <SalonYouTubeHostPanel
          salon={salon}
          token={token}
          playback={playback}
          queue={queue}
          proposals={proposals}
          loadingProposals={loadingProposals}
          hostCanControl={hostCanControl}
          skipping={skipping}
          reordering={reordering}
          pendingGuestIds={pendingGuestIds}
          contacts={contacts}
          onQueueChanged={applyQueue}
          onTrackChanged={applyPlayback}
          onSkip={handleSkip}
          onPlayItem={handlePlayQueue}
          onReorder={handleReorderQueue}
          onAccept={handleAccept}
          onReject={rejectProposal}
          settingsContent={youtubeHostSettings}
        />
      )}

      {(isVipModerator || isDevModerator) && !isHost && salon.platform === 'youtube' && token && (
        <SalonYouTubeHostPanel
          salon={salon}
          token={token}
          playback={playback}
          queue={queue}
          proposals={proposals}
          loadingProposals={loadingProposals}
          hostCanControl={canControlPlayback}
          skipping={skipping}
          reordering={reordering}
          pendingGuestIds={pendingGuestIds}
          contacts={contacts}
          onQueueChanged={applyQueue}
          onTrackChanged={applyPlayback}
          onSkip={handleSkip}
          onPlayItem={handlePlayQueue}
          onReorder={handleReorderQueue}
          onAccept={handleAccept}
          onReject={rejectProposal}
          vipOnly
        />
      )}

      {isHost && hostCanControl && salon.platform === 'spotify' && token && (
        <div className="p-3 space-y-3">
          <SalonSpotifySearch
            salonId={salon.id}
            token={token}
            currentTitle={playback.title}
            currentArtist={playback.artist}
            onQueueChanged={applyQueue}
            showCurrentTrack={false}
          />
          <SalonSpotifyPlaylist
            salonId={salon.id}
            token={token}
            onTrackChanged={applyPlayback}
          />
          <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
            <SalonQueueSection
              queue={queue}
              isHost={hostCanControl}
              allowQueue={salon.allowQueue}
              salonId={salon.id}
              onSkip={hostCanControl ? handleSkip : undefined}
              onPlayItem={hostCanControl ? handlePlayQueue : undefined}
              onReorder={hostCanControl ? handleReorderQueue : undefined}
              skipping={skipping}
              reordering={reordering}
            />
            <SalonProposalsSection
              isHost={hostCanControl}
              allowQueue={salon.allowQueue}
              proposals={proposals}
              loadingProposals={loadingProposals}
              onAccept={hostCanControl ? handleAccept : undefined}
              onReject={hostCanControl ? rejectProposal : undefined}
            />
          </section>
        </div>
      )}

      {(isVipModerator || isDevModerator) && !isHost && salon.platform === 'spotify' && token && (
        <div className="p-3">
          <SalonSpotifySearch
            salonId={salon.id}
            token={token}
            currentTitle={playback.title}
            currentArtist={playback.artist}
            onQueueChanged={applyQueue}
            showCurrentTrack={false}
          />
        </div>
      )}

      {isHost && !hostCanControl && salon.platform === 'youtube' && token && (
        <div className="p-3">
          <p className="text-xs text-amber-400/90 text-center mb-3">
            Connectez YouTube pour contrôler la lecture de ce salon.
          </p>
          {youtubeHostSettings}
        </div>
      )}

      {!canControlPlayback && participantProposeSearch ? (
        <div className="p-3">{participantProposeSearch}</div>
      ) : null}
    </>
  );

  if (!user) return null;

  const chatProps = {
    roomId: salon.id,
    roomType: 'salon' as const,
    userId: user.id,
    userName: user.username,
    token: token ?? undefined,
    isHost,
    canModerateChat: canModerateSalonChat,
    isDevModerator,
    hostId: salon.hostId,
    vipModeratorIds: salon.vipModeratorIds ?? [],
    allowAttachments: false,
    onBanUser:
      canModerateSalonChat
        ? (targetUserId: string, opts: { permanent: boolean; durationMs?: number; scope: 'chat' | 'live' }) =>
            banSalonUser(targetUserId, opts)
        : undefined,
  };

  const chatHeaderExtra =
    (isHost || isDevModerator) && token ? (
      <SalonParticipantsPopover
        salonId={salon.id}
        token={token}
        vipModeratorIds={salon.vipModeratorIds ?? []}
        onVipChange={async (userId, isVip) => {
          const { salon: updated } = await api.setSalonParticipantVip(token, salon.id, userId, isVip);
          setSalon(updated);
        }}
        onActionDone={setToastMsg}
      />
    ) : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
      {durationWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          ⚠ Session se terminera dans 15 min
        </div>
      )}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[90vw]">
          <div className="px-4 py-2.5 rounded-full bg-[#1a1a26]/95 border border-white/15 text-sm text-white shadow-lg backdrop-blur-md text-center">
            {toastMsg}
          </div>
        </div>
      )}
      <header className="relative z-30 shrink-0 flex items-center gap-2 sm:gap-3 px-3 py-2.5 border-b border-[#1e1e2f] min-w-0">
        {minimizeSalonButton}
        <img
          src={salon.hostAvatarUrl ?? ''}
          alt={salon.hostName}
          className="w-9 h-9 rounded-lg object-cover shrink-0 bg-[#1a1a26]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          {salon.platform === 'spotify' ? (
            <p className="text-[11px] text-gray-400 truncate flex items-center gap-2 min-w-0">
              <span className="truncate inline-flex items-center gap-1 min-w-0">
                <UsernameDisplay
                  username={salon.hostName}
                  usernameColor={salon.hostUsernameColor}
                  usernameWaveFrom={salon.hostUsernameWaveFrom}
                  usernameWaveTo={salon.hostUsernameWaveTo}
                  className="truncate"
                />
                <span className="shrink-0 text-[#6b6b8a]">· 🎧 Spotify</span>
              </span>
              <HostRatingBlock
                hostId={salon.hostId}
                hostName={salon.hostName}
                isBot={salon.isBot}
                salonId={salon.id}
                inline
                hideLabel
                compact
              />
            </p>
          ) : (
            <>
              <h1 className="font-bold text-white truncate text-sm">{salon.title}</h1>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-2 min-w-0">
                <span className="truncate inline-flex items-center gap-1 min-w-0">
                  <UsernameDisplay
                    username={salon.hostName}
                    usernameColor={salon.hostUsernameColor}
                    usernameWaveFrom={salon.hostUsernameWaveFrom}
                    usernameWaveTo={salon.hostUsernameWaveTo}
                    className="truncate"
                  />
                  <span className="shrink-0 text-[#6b6b8a]">· ▶️ YouTube</span>
                </span>
                <HostRatingBlock
                  hostId={salon.hostId}
                  hostName={salon.hostName}
                  isBot={salon.isBot}
                  salonId={salon.id}
                  inline
                  hideLabel
                  compact
                />
              </p>
            </>
          )}
          <p className="text-[10px] mt-0.5 text-[#6b6b8a] tabular-nums">
            {formatSalonAudienceLabel(salon.listenersCount, t)}
          </p>
          {remainingMs !== null && remainingMs > 0 && (
            <p className={`text-[10px] mt-0.5 ${remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#5a5a7a]'}`}>
              ⏱ {formatRemaining(remainingMs)} restantes
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isHost && hostCanControl && (
            <SalonAccessModeToggle
              accessMode={salon.accessMode ?? 'public'}
              disabled={accessSaving}
              onChange={(mode) => void setAccessMode(mode)}
            />
          )}
          {isHost && salon.accessMode === 'invite' && token && (
            <SalonInviteSheet
              salonId={salon.id}
              salonTitle={salon.title}
              hostName={salon.hostName}
              token={token}
              contacts={contacts}
              pendingGuestIds={pendingGuestIds}
              validating={validatingGuests}
              onToggleGuest={togglePendingGuest}
              onValidate={validateGuests}
            />
          )}
          {onLeaveSalon && isHost && (
            <button
              type="button"
              onClick={() => setShowEndSalonConfirm(true)}
              disabled={endingSalon}
              className="shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-red-300 border border-red-500/50 hover:text-white hover:bg-red-600/25 hover:border-red-400 transition disabled:opacity-50"
            >
              {endingSalon
                ? t('common.loading', { defaultValue: 'Chargement…' })
                : t('salon.endSalon', { defaultValue: 'Arrêter le salon' })}
            </button>
          )}
          {onLeaveSalon && !isHost && (
            <button
              type="button"
              onClick={onLeaveSalon}
              className="shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-gray-400 border border-[#2a2a3a] hover:text-white hover:border-gray-500 transition"
            >
              {t('salon.leaveSalon')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleShareSalon()}
            title={shareCopied ? 'Lien copié !' : 'Partager ce salon'}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition"
            aria-label="Partager le salon"
          >
            {shareCopied ? (
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <ChatRoomProvider {...chatProps}>
        <RoomTheaterLayout
          variant={salon.platform === 'spotify' ? 'queue-chat' : 'theater'}
          chatDock={salon.platform === 'youtube' ? 'left' : 'right'}
          stageFooterMode={salon.platform === 'youtube' ? 'drawer' : 'scroll'}
          allowFloatingChat={salon.platform !== 'youtube'}
          sideDockMatchHero={salon.platform === 'youtube'}
          chatHidden={chatHidden}
          onToggleChat={() => {
            setChatHidden((h) => {
              const next = !h;
              try {
                if (window.innerWidth >= 640) {
                  localStorage.setItem(SALON_CHAT_HIDDEN_KEY, next ? '1' : '0');
                }
              } catch {
                /* ignore */
              }
              return next;
            });
          }}
          chatTitle={t('salon.chatTitle', { defaultValue: 'Chat du salon' })}
          chatHeaderExtra={chatHeaderExtra}
          chatMinimized={chatMinimized}
          onToggleMinimize={() => {
            setChatMinimized((m) => {
              const next = !m;
              try {
                localStorage.setItem(SALON_CHAT_MINIMIZED_KEY, next ? '1' : '0');
              } catch {
                /* ignore */
              }
              return next;
            });
          }}
          stage={
            <SalonPlaybackPanel
              salon={salon}
              token={token}
              isHost={isHost}
              isVipModerator={isVipModerator || isDevModerator}
              userPlatforms={user?.connectedPlatforms}
              onUserUpdated={setUserFromProfile}
              onPlaybackStateChange={applyPlayback}
              theaterMode={salon.platform !== 'spotify'}
              theaterSideDock={salon.platform === 'youtube'}
              salonQueueLayout={salon.platform === 'spotify'}
              hostCanControl={hostCanControl}
              queue={queue}
              skipping={skipping}
              onSkip={canControlPlayback ? handleSkip : undefined}
            />
          }
          stageFooter={stageFooter}
          chat={
            <div className="flex flex-col h-full min-h-0">
              <ChatMessagesView />
            </div>
          }
          chatInput={<ChatInputBar />}
        />
        <ChatModals />
      </ChatRoomProvider>

      <ConfirmModal
        open={showEndSalonConfirm}
        title="Supprimer ce salon ?"
        description={t('salon.endSalonConfirm', {
          defaultValue: 'Le salon sera arrêté pour tous les auditeurs. Cette action est définitive.',
        })}
        confirmLabel="Arrêter"
        loading={endingSalon}
        loadingLabel="Arrêt…"
        onCancel={() => setShowEndSalonConfirm(false)}
        onConfirm={() => void handleEndSalon()}
      />
    </div>
  );

}

