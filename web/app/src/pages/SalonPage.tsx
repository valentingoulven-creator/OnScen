import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SOUNDY_BASE_URL = 'https://getsoundy.com';

import { useAuth } from '../context/AuthContext';
import { canJoinSalonAsParticipant, isMusicPlatformLinkedForSalon } from '../lib/platformConnect';
import { SalonPlatformAccessGate } from '../components/SalonPlatformAccessGate';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';

import { api, ApiRequestError } from '../lib/api';
import { getSocket } from '../lib/socket';

import { ChatRoomProvider, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { SalonChatDockBody, type SalonChatDockTab } from '../components/SalonChatDockBody';
import { UsernameDisplay } from '../components/UsernameDisplay';

import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { SalonPlaybackPanel } from '../components/SalonPlaybackPanel';
import { SalonAccessModeToggle } from '../components/SalonAccessModeToggle';
import { SalonInviteSheet } from '../components/SalonInviteSheet';
import { SalonParticipantsPopover } from '../components/SalonParticipantsPopover';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';
import { useCompactMapViewport } from '../hooks/usePhoneWebViewport';
import { emitOnSocket } from '../lib/socket';
import { ConfirmModal } from '../components/ConfirmModal';
import { ShareLinkMenu } from '../components/ShareLinkMenu';
import { ShareToUserSheet } from '../components/ShareToUserSheet';

import { formatSalonAudienceLabel } from '../lib/salonAudience';
import { getSalonShareUrl } from '../lib/shareLink';
import type { DmContact, PlaybackState, Salon } from '../types';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';

const SALON_MAX_DURATION_MS = 2 * 60 * 60 * 1000;
const SALON_CHAT_HIDDEN_KEY = STORAGE_KEYS.salonChatHidden;
const SALON_CHAT_MINIMIZED_KEY = STORAGE_KEYS.salonChatMinimized;

function readSalonChatHidden(): boolean {
  if (window.innerWidth < 640) return false;
  try {
    return getStorageItem(SALON_CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function readSalonChatMinimized(): boolean {
  try {
    return getStorageItem(SALON_CHAT_MINIMIZED_KEY) === '1';
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
  onRestoreFullScreen,
  onOpenProfile,
  salonFullScreen = true,
}: {
  salonId: string;
  onBack: () => void;
  /** Quitter définitivement le salon (session effacée). */
  onLeaveSalon?: () => void;
  /** Quitte le grand salon et rouvre la fiche carte (petit salon). */
  onMinimizeToMap?: (salonTitle?: string) => void;
  /** Titre chargé (barre retour header). */
  onSalonLoaded?: (salonTitle?: string) => void;
  /** Ancrage du PiP vidéo → restaurer le salon plein écran. */
  onRestoreFullScreen?: () => void;
  /** Ouvre le profil complet d'un utilisateur (remonte depuis App). */
  onOpenProfile?: (userId: string) => void;
  /** Overlay plein écran actif (false = salon minimisé, PiP vidéo). */
  salonFullScreen?: boolean;
}) {

  const { user, token, setUserFromProfile, refreshUser } = useAuth();
  const { t } = useTranslation();
  const mobileRoom = useCompactMapViewport();

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
  const [chatDockTab, setChatDockTab] = useState<SalonChatDockTab>('chat');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [shareMenuUrl, setShareMenuUrl] = useState('');

  const [sessionEnded, setSessionEnded] = useState(false);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const onLeaveSalonRef = useRef(onLeaveSalon);
  onLeaveSalonRef.current = onLeaveSalon;

  const loadSalon = useCallback(() => {
    if (!token) {
      setSalon(null);
      setLoadError(t('salon.inaccessible', { defaultValue: 'Salon inaccessible' }));
      return;
    }
    setLoadError(null);
    void api
      .getSalon(token, salonId)
      .then((r) => {
        setSalon(r.salon);
        setLoadError(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : t('salon.inaccessible');
        setLoadError(msg);
        setToastMsg(msg);
        const status = e instanceof ApiRequestError ? e.status : undefined;
        if (status === 404 || status === 403) {
          onLeaveSalonRef.current?.();
        }
      });
  }, [token, salonId, t]);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  useEffect(() => {
    setSalon(null);
    setSessionEnded(false);
    setLoadError(null);

    if (!token) {
      setLoadError(t('salon.inaccessible', { defaultValue: 'Salon inaccessible' }));
      return;
    }

    let cancelled = false;
    void api
      .getSalon(token, salonId)
      .then((r) => {
        if (cancelled) return;
        setSalon(r.salon);
        setLoadError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t('salon.inaccessible');
        setLoadError(msg);
        setToastMsg(msg);
        const status = e instanceof ApiRequestError ? e.status : undefined;
        if (status === 404 || status === 403) {
          onLeaveSalonRef.current?.();
        }
      });

    void api.getDmContacts(token).then((r) => {
      if (!cancelled) setContacts(r.contacts);
    });

    return () => {
      cancelled = true;
    };
  }, [token, salonId, t]);

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
        return;
      }
      onLeaveSalonRef.current?.();
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

  }, [salon, user]);

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
    isHost && salon && isMusicPlatformLinkedForSalon(salon.platform, user?.connectedPlatforms, user?.platformLinks)
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
    upvoteProposal,
    reorderQueue,
    applyQueue,
  } = useSalonQueueSync(salon?.id ?? salonId, token, isHost || isDevModerator, salon?.queue);

  const applyPlayback = useCallback((state: PlaybackState) => {
    setSalon((prev) =>
      prev ? { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) } : prev
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getSalonShareUrl(salonId).then((url) => {
      if (!cancelled) setShareMenuUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [salonId]);

  const handleMinimizeSalon = useCallback(() => {
    if (onMinimizeToMap) {
      onMinimizeToMap(salon?.title);
    } else {
      onBack();
    }
  }, [onMinimizeToMap, onBack, salon?.title]);

  const handleShareSalon = useCallback(() => {
    setShowShareMenu(true);
  }, []);

  const handleEndSalon = useCallback(async () => {
    if (!token || !salon || !onLeaveSalon) return;

    setEndingSalon(true);
    try {
      await api.deleteSalon(token, salon.id);
      if (user) {
        setUserFromProfile({
          ...user,
          salonId: undefined,
          salonTitle: undefined,
          salonListening: undefined,
          currentListening: user.isLive ? (user.liveListening ?? user.currentListening) : undefined,
        });
      }
      await refreshUser().catch(() => {});
      setShowEndSalonConfirm(false);
      onLeaveSalon();
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : t('common.error', { defaultValue: 'Erreur' }));
    } finally {
      setEndingSalon(false);
    }
  }, [token, salon, onLeaveSalon, t, user, setUserFromProfile, refreshUser]);

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
    [salon]
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
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={loadSalon}
                  className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500"
                >
                  {t('common.retry', { defaultValue: 'Réessayer' })}
                </button>
                <button
                  type="button"
                  onClick={() => (onLeaveSalon ? onLeaveSalon() : onBack())}
                  className="px-4 py-2 rounded-full border border-[#3a3a52] text-gray-200 text-sm font-semibold hover:bg-[#1a1a28]"
                >
                  {t('common.back', { defaultValue: 'Retour' })}
                </button>
              </div>
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

  const handleUpvote = async (proposalId: string) => {
    try {
      await upvoteProposal(proposalId);
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };



  const queueYoutubeSearch =
    salon.allowQueue && token && salon.platform === 'youtube'
      ? {
          token,
          submitMode: (canControlPlayback ? 'queue' : 'propose') as 'queue' | 'propose',
          currentTitle: playback.title,
          currentArtist: playback.artist,
          onTrackChanged: canControlPlayback ? applyPlayback : undefined,
          onQueueChanged: canControlPlayback ? applyQueue : undefined,
        }
      : undefined;

  const chatDockPlaylist =
    canControlPlayback && token && user && salon.platform === 'youtube'
      ? {
          token,
          userId: user.id,
          platform: 'youtube' as const,
          onTrackChanged: applyPlayback,
          onQueueChanged: applyQueue,
        }
      : undefined;


  if (!user) return null;

  const participantSalonBlocked =
    !isHost &&
    !canJoinSalonAsParticipant(salon.platform, user.connectedPlatforms, isHost);

  if (participantSalonBlocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
        <header className="relative z-30 shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2f]">
          {minimizeSalonButton}
          <p className="flex-1 min-w-0 text-sm text-gray-400 truncate">{salon.title}</p>
        </header>
        <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto">
          <SalonPlatformAccessGate
            salonPlatform={salon.platform}
            connectedPlatforms={user.connectedPlatforms}
            platformLinks={user.platformLinks}
            token={token}
            onUserUpdated={setUserFromProfile}
            isHost={isHost}
          >
            <></>
          </SalonPlatformAccessGate>
        </div>
      </div>
    );
  }

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

  const chatTitle =
    chatDockTab === 'queue'
      ? t('salon.chatDock.titleQueue', { defaultValue: "File d'attente" })
      : t('salon.chatTitle', { defaultValue: 'Chat du salon' });
  const salonTopBarStart = (
    <>
      {minimizeSalonButton}
      {onOpenProfile ? (
        <button
          type="button"
          onClick={() => onOpenProfile(salon.hostId)}
          className="rounded-lg shrink-0 cursor-pointer hover:ring-2 hover:ring-white/30 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <img
            src={salon.hostAvatarUrl ?? ''}
            alt={salon.hostName}
            className="w-8 h-8 rounded-lg object-cover bg-[#1a1a26] block"
            onError={(e) => { (e.currentTarget.parentElement ?? e.currentTarget).style.display = 'none'; }}
          />
        </button>
      ) : (
        <img
          src={salon.hostAvatarUrl ?? ''}
          alt={salon.hostName}
          className="w-8 h-8 rounded-lg object-cover shrink-0 bg-[#1a1a26]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="min-w-0 max-w-[10rem] sm:max-w-[14rem] md:max-w-none">
        <h1 className="font-bold text-white truncate text-sm leading-tight">{salon.title}</h1>
        <p className="hidden md:block text-[11px] text-gray-400 truncate">
          <UsernameDisplay
            username={salon.hostName}
            usernameColor={salon.hostUsernameColor}
            usernameWaveFrom={salon.hostUsernameWaveFrom}
            usernameWaveTo={salon.hostUsernameWaveTo}
            className="truncate"
          />
          <span className="text-[#6b6b8a]"> · ▶️ YouTube</span>
        </p>
      </div>
      <span className="hidden lg:inline text-[10px] text-[#6b6b8a] tabular-nums shrink-0">
        {formatSalonAudienceLabel(salon.listenersCount, t)}
      </span>
      {remainingMs !== null && remainingMs > 0 && (
        <span
          className={`hidden lg:inline text-[10px] tabular-nums shrink-0 ${
            remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#5a5a7a]'
          }`}
        >
          ⏱ {formatRemaining(remainingMs)}
        </span>
      )}
    </>
  );

  const salonTopBarEnd = (
    <>
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
          className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold text-red-300 border border-red-500/50 hover:text-white hover:bg-red-600/25 hover:border-red-400 transition disabled:opacity-50"
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
          className="shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold text-gray-400 border border-[#2a2a3a] hover:text-white hover:border-gray-500 transition"
        >
          {t('salon.leaveSalon')}
        </button>
      )}
      <button
        type="button"
        onClick={handleShareSalon}
        title="Partager ce salon"
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition"
        aria-label="Partager le salon"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
        </svg>
      </button>
    </>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
      {durationWarning && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          ⚠ Session se terminera dans 15 min
        </div>
      )}
      {toastMsg && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[90vw]">
          <div className="px-4 py-2.5 rounded-full bg-[#1a1a26]/95 border border-white/15 text-sm text-white shadow-lg backdrop-blur-md text-center">
            {toastMsg}
          </div>
        </div>
      )}
      <ChatRoomProvider {...chatProps}>
        <RoomTheaterLayout
          variant="theater"
          chatDock={mobileRoom ? 'bottom' : 'left'}
          stackBelowVideo={mobileRoom}
          allowFloatingChat={false}
          sideDockMatchHero={!mobileRoom}
          headerLayout="full-width"
          topBarStart={salonTopBarStart}
          topBarEnd={salonTopBarEnd}
          chatHidden={chatHidden}
          onToggleChat={() => {
            setChatHidden((h) => {
              const next = !h;
              try {
                if (window.innerWidth >= 640) {
                  setStorageItem(SALON_CHAT_HIDDEN_KEY, next ? '1' : '0');
                }
              } catch {
                /* ignore */
              }
              return next;
            });
          }}
          chatTitle={chatTitle}
          chatMinimized={chatMinimized}
          onToggleMinimize={() => {
            setChatMinimized((m) => {
              const next = !m;
              try {
                setStorageItem(SALON_CHAT_MINIMIZED_KEY, next ? '1' : '0');
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
              userPlatformLinks={user?.platformLinks}
              onUserUpdated={setUserFromProfile}
              onPlaybackStateChange={applyPlayback}
              theaterMode
              salonFullScreen={salonFullScreen}
              theaterSideDock={!mobileRoom}
              salonQueueLayout={false}
              hostCanControl={hostCanControl}
              queue={queue}
              skipping={skipping}
              onSkip={canControlPlayback ? handleSkip : undefined}
              onAnchorVideoFloat={onRestoreFullScreen}
              onLeaveSalon={onLeaveSalon}
              onRequestEndSalon={
                onLeaveSalon && isHost ? () => setShowEndSalonConfirm(true) : undefined
              }
              endingSalon={endingSalon}
            />
          }
          chat={
            <SalonChatDockBody
              activeTab={chatDockTab}
              onSelectTab={setChatDockTab}
              chatHeaderExtra={chatHeaderExtra}
              salon={salon}
              queue={queue}
              proposals={proposals}
              loadingProposals={loadingProposals}
              hostCanControl={canControlPlayback}
              participantMode={!canControlPlayback}
              skipping={skipping}
              reordering={reordering}
              onSkip={canControlPlayback ? handleSkip : undefined}
              onPlayItem={canControlPlayback ? handlePlayQueue : undefined}
              onReorder={canControlPlayback ? handleReorderQueue : undefined}
              onAccept={canControlPlayback ? handleAccept : undefined}
              onReject={canControlPlayback ? rejectProposal : undefined}
              currentUserId={user?.id}
              onUpvote={handleUpvote}
              youtubeSearch={queueYoutubeSearch}
              playlist={chatDockPlaylist}
              chatInput={<ChatInputBar />}
            />
          }
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
      <ShareLinkMenu
        open={showShareMenu && !shareToUserOpen}
        onClose={() => setShowShareMenu(false)}
        url={shareMenuUrl || `${SOUNDY_BASE_URL}/salon/${salonId}`}
        title={salon?.title ?? 'Salon Soundy'}
        text={`Rejoins le salon "${salon?.title ?? 'Soundy'}" sur Soundy`}
        onToast={setToastMsg}
        onSendToUser={token ? () => setShareToUserOpen(true) : undefined}
      />
      {showShareMenu && shareToUserOpen && token && (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setShowShareMenu(false);
          }}
          token={token}
          shareUrl={shareMenuUrl || `${SOUNDY_BASE_URL}/salon/${salonId}`}
          shareText={`Rejoins le salon "${salon?.title ?? 'Soundy'}" sur Soundy`}
          onToast={setToastMsg}
        />
      )}
    </div>
  );

}

