import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCamera } from '../hooks/useLiveCamera';
import { usePauseMediaOnPageHidden, pauseMediaElements } from '../hooks/usePauseMediaOnPageHidden';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import { releaseAppMediaFocus, requestAppMediaFocus } from '../lib/appMediaFocus';
import { api } from '../lib/api';
import { LIVE_CAMERA_VIEWER_FILE_NOTE, LIVE_CAMERA_VIEWER_NOTE } from '../lib/liveCameraMessages';
import { useLiveVideoRelay } from '../hooks/useLiveVideoRelay';
import { getLiveCameraContextHints } from '../lib/liveCameraSupport';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';
import { setActiveHostLiveId } from '../lib/liveHostContext';
import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { LivePrivateSheet } from '../components/LivePrivateSheet';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { FollowUserButton } from '../components/FollowUserButton';
import { LiveDonationSheet } from '../components/LiveDonationSheet';
import { LiveGiftOverlay } from '../components/LiveGiftOverlay';
import type { ChatMessage, DmContact, Live, AppNotification, PlaybackState } from '../types';

const LIVE_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m} min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

const LIVE_CHAT_HIDDEN_KEY = 'melosong_live_chat_hidden';
function readLiveChatHidden(): boolean {
  try {
    return localStorage.getItem(LIVE_CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
    null
  );
}

async function requestElementFullscreen(el: HTMLElement): Promise<void> {
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  const webkit = (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
  if (webkit) await webkit.call(el);
}

async function exitDocumentFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  const webkit = (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen;
  if (webkit) await webkit.call(document);
}

const FULLSCREEN_SUPPORTED =
  typeof document !== 'undefined' &&
  (document.documentElement.requestFullscreen != null ||
    (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void })
      .webkitRequestFullscreen != null);

function isLandscapeOrientation(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  const orientation = screen.orientation;
  if (orientation?.type?.startsWith('landscape')) return true;
  if (orientation?.angle != null) return orientation.angle === 90 || orientation.angle === 270;
  return window.innerWidth > window.innerHeight;
}

function isMobileNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 896px)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

function shouldAutoLandscapeVideo(): boolean {
  return isLandscapeOrientation() && isMobileNarrowViewport();
}

function LiveVideoExpandIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function LiveVideoShrinkIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

export function LivePage({
  liveId,
  onBack,
  onOpenProfile,
  initialTheater = false,
}: {
  liveId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  /** Ouvre directement en mode plein écran CSS (theater) dès le premier rendu. */
  initialTheater?: boolean;
}) {
  const { user, token } = useAuth();
  const [live, setLive] = useState<Live | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [chatHidden, setChatHidden] = useState(readLiveChatHidden);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [privateTarget, setPrivateTarget] = useState<DmContact | null>(null);
  const [showDonSheet, setShowDonSheet] = useState(false);
  const [donInitialAmount, setDonInitialAmount] = useState<number | undefined>();
  const [donToast, setDonToast] = useState<string | null>(null);
  const [hostDonToast, setHostDonToast] = useState<string | null>(null);
  const [cameraToast, setCameraToast] = useState<string | null>(null);
  const [cameraToggling, setCameraToggling] = useState(false);
  const [showVipPanel, setShowVipPanel] = useState(false);
  const [hostFollowing, setHostFollowing] = useState(false);
  const [chatBanned, setChatBanned] = useState(false);
  const [chatBanMessage, setChatBanMessage] = useState<string | null>(null);
  const [chatBanUntil, setChatBanUntil] = useState<number | null>(null);
  const [liveViewBanned, setLiveViewBanned] = useState(false);
  const [liveViewBanMessage, setLiveViewBanMessage] = useState<string | null>(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const {
    videoRef,
    active: cameraLocalActive,
    mode: cameraMode,
    error: cameraError,
    setError: setCameraError,
    start: startCamera,
    startFromFile: startCameraFromFile,
    stop: stopCamera,
    getStream: getCameraStream,
  } = useLiveCamera();
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoFileLoading, setVideoFileLoading] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const liveCameraHints = useMemo(() => getLiveCameraContextHints(), []);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(initialTheater);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const chatHiddenBeforeLandscapeRef = useRef<boolean | null>(null);
  const chatHiddenRef = useRef(chatHidden);
  chatHiddenRef.current = chatHidden;

  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;

  const emitCameraState = useCallback(
    (active: boolean, mode?: 'camera' | 'file') => {
      emitOnSocket('live_camera_toggle', { liveId, active, mode: active ? mode : undefined });
    },
    [liveId]
  );

  const hostCameraBroadcastRef = useRef(false);
  useEffect(() => {
    hostCameraBroadcastRef.current = !!(live?.hostId === user?.id && cameraLocalActive);
  }, [live?.hostId, user?.id, cameraLocalActive]);

  useEffect(() => {
    if (!token) return;
    api
      .getLive(token, liveId)
      .then((r) => {
        setLive(r.live);
        setViewers(r.live.viewersCount);
        if (r.live.hostId !== user?.id) {
          api
            .getUserProfile(token, r.live.hostId)
            .then((p) => setHostFollowing(!!p.user.isFollowing))
            .catch(() => setHostFollowing(false));
        }
      })
      .catch((e: Error & { liveBanned?: boolean }) => {
        if (e.liveBanned) {
          setLiveViewBanned(true);
          setLiveViewBanMessage(e.message);
        }
      });
    api.liveChat(token, liveId).then((r) => setChatMessages(r.messages));
  }, [liveId, token, user?.id]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const joinLive = () => {
      socket.emit('join_live', { liveId });
    };
    joinLive();
    const offReconnect = onSocketConnect(joinLive);
    const onUpdate = (l: Live) => {
      if (l.id === liveId) {
        setLive((prev) => ({
          ...l,
          hostMonetizationEligible:
            l.hostMonetizationEligible ?? prev?.hostMonetizationEligible,
        }));
        setViewers(l.viewersCount);
      }
    };
    const onPlayback = (state: PlaybackState) => {
      setLive((prev) => {
        if (!prev || prev.id !== liveId) return prev;
        return { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) };
      });
    };
    socket.on('live_updated', onUpdate);
    socket.on('playback_sync', onPlayback);
    socket.on('salon_playback', onPlayback);
    return () => {
      offReconnect();
      socket.emit('leave_live', { liveId });
      socket.off('live_updated', onUpdate);
      socket.off('playback_sync', onPlayback);
      socket.off('salon_playback', onPlayback);
    };
  }, [liveId, user?.id]);

  useEffect(() => {
    setChatBanned(false);
    setChatBanMessage(null);
    setChatBanUntil(null);
    setLiveViewBanned(false);
    setLiveViewBanMessage(null);
  }, [liveId]);

  useEffect(() => {
    if (!live?.startedAt) return;
    const update = () => {
      const ms = live.startedAt! + LIVE_MAX_DURATION_MS - Date.now();
      setRemainingMs(Math.max(0, ms));
    };
    update();
    const id = window.setInterval(update, 60000);
    return () => window.clearInterval(id);
  }, [live?.startedAt]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onEnded = (payload: { liveId: string; reason: string }) => {
      if (payload.liveId !== liveId) return;
      if (payload.reason === 'duration_limit') {
        setLiveEnded(true);
        setDurationWarning(false);
      }
    };
    const onWarning = (payload: { type: string; id: string }) => {
      if (payload.type === 'live' && payload.id === liveId) {
        setDurationWarning(true);
        window.setTimeout(() => setDurationWarning(false), 10000);
      }
    };
    socket.on('live_ended', onEnded);
    socket.on('session_warning', onWarning);
    return () => {
      socket.off('live_ended', onEnded);
      socket.off('session_warning', onWarning);
    };
  }, [liveId]);

  useEffect(() => {
    if (!chatBanned || chatBanUntil == null) return;
    const remaining = chatBanUntil - Date.now();
    if (remaining <= 0) {
      setChatBanned(false);
      setChatBanMessage(null);
      setChatBanUntil(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setChatBanned(false);
      setChatBanMessage(null);
      setChatBanUntil(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [chatBanned, chatBanUntil]);

  useEffect(() => {
    pauseMediaElements();
    requestAppMediaFocus('live');
    return () => releaseAppMediaFocus('live');
  }, [liveId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMsg = (msg: ChatMessage) => {
      if (msg.roomId !== liveId) return;
      setChatMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
    };
    const onDeleted = (payload: { roomId: string; messageId: string }) => {
      if (payload.roomId !== liveId) return;
      setChatMessages((m) => m.filter((x) => x.id !== payload.messageId));
    };
    const onBanned = (payload: {
      liveId: string;
      message: string;
      scope?: 'chat' | 'live';
      permanent?: boolean;
      until?: number;
    }) => {
      if (payload.liveId !== liveId) return;
      const scope = payload.scope ?? 'live';
      if (scope === 'live') {
        setLiveViewBanned(true);
        setLiveViewBanMessage(payload.message);
        emitOnSocket('leave_live', { liveId });
        return;
      }
      setChatBanned(true);
      setChatBanMessage(payload.message);
      setChatBanUntil(payload.permanent ? null : payload.until ?? null);
    };
    const onChatDenied = (payload: { liveId: string; message?: string }) => {
      if (payload.liveId !== liveId) return;
      setChatBanned(true);
      if (payload.message) setChatBanMessage(payload.message);
    };
    socket.on('live_message', onMsg);
    socket.on('live_message_deleted', onDeleted);
    socket.on('live_user_banned', onBanned);
    socket.on('live_chat_denied', onChatDenied);
    return () => {
      socket.off('live_message', onMsg);
      socket.off('live_message_deleted', onDeleted);
      socket.off('live_user_banned', onBanned);
      socket.off('live_chat_denied', onChatDenied);
    };
  }, [liveId]);

  const isHost = live?.hostId === user?.id;
  const hostCameraRelayActive = !!(isHost && cameraLocalActive && cameraMode === 'camera');
  const viewerCameraRelayActive =
    !isHost && !!live?.cameraActive && live.cameraMode !== 'file';

  const { viewerVideoRef, viewerStreamActive, viewerRelayError } = useLiveVideoRelay({
    liveId,
    userId: user?.id,
    hostId: live?.hostId,
    broadcastStream: hostCameraRelayActive ? getCameraStream() : null,
    cameraRelayActive: isHost ? hostCameraRelayActive : viewerCameraRelayActive,
  });

  const hostCanReceiveDonations = live?.hostMonetizationEligible !== false;

  useEffect(() => {
    if (isHost) {
      setActiveHostLiveId(liveId);
      return () => setActiveHostLiveId(null);
    }
    setActiveHostLiveId(null);
    return undefined;
  }, [isHost, liveId]);

  useEffect(() => {
    if (!user || !isHost) return;
    const socket = getSocket();
    if (!socket) return;
    const onNotif = (n: AppNotification) => {
      if (n.type !== 'live_don' || n.liveId !== liveId) return;
      setHostDonToast(n.message);
      window.setTimeout(() => setHostDonToast(null), 5000);
    };
    socket.on('notification', onNotif);
    return () => {
      socket.off('notification', onNotif);
    };
  }, [liveId, user?.id, isHost]);

  useEffect(() => {
    if (!live || live.hostId !== user?.id) return;
    if (!live.cameraActive && cameraLocalActive) {
      stopCamera();
    }
  }, [live?.cameraActive, live?.hostId, user?.id, cameraLocalActive, stopCamera, live]);

  useEffect(() => {
    return () => {
      if (hostCameraBroadcastRef.current) {
        emitOnSocket('live_camera_toggle', { liveId, active: false });
      }
      stopCamera();
    };
  }, [liveId, stopCamera]);

  const cameraLocalActiveRef = useRef(cameraLocalActive);
  cameraLocalActiveRef.current = cameraLocalActive;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  useBackgroundPlayback(
    live
      ? {
          title: live.playbackState.title,
          artist: live.playbackState.artist,
          artworkUrl: live.playbackState.albumArtUrl,
        }
      : null,
    Boolean(live),
    live?.playbackState.isPlaying ?? false
  );

  usePauseMediaOnPageHidden({
    onPageHidden: () => {
      if (isHostRef.current && cameraLocalActiveRef.current) {
        stopCamera();
        emitCameraState(false);
        setLive((prev) =>
          prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
        );
      }
    },
  });

  useEffect(() => {
    if (!cameraError) return;
    setCameraToast(cameraError);
    const t = window.setTimeout(() => {
      setCameraToast(null);
      setCameraError(null);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [cameraError, setCameraError]);

  const restoreChatAfterLandscape = useCallback(() => {
    if (chatHiddenBeforeLandscapeRef.current === null) return;
    const prev = chatHiddenBeforeLandscapeRef.current;
    chatHiddenBeforeLandscapeRef.current = null;
      setChatHidden(prev);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const inNative = getFullscreenElement() === videoContainerRef.current;
      setIsVideoFullscreen(inNative);
      if (landscapeAutoActiveRef.current && shouldAutoLandscapeVideo() && !inNative) {
        setIsLandscapeTheater(true);
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!live) return;

    const enterLandscapeAuto = async () => {
      if (landscapeAutoActiveRef.current || landscapeAutoDismissedRef.current) return;
      landscapeAutoActiveRef.current = true;
      chatHiddenBeforeLandscapeRef.current = chatHiddenRef.current;
      setChatHidden(true);

      const el = videoContainerRef.current;
      if (el && FULLSCREEN_SUPPORTED) {
        try {
          await requestElementFullscreen(el);
          setIsLandscapeTheater(false);
          return;
        } catch {
          /* iOS / PWA : fallback mode cinéma CSS */
        }
      }
      setIsLandscapeTheater(true);
    };

    const exitLandscapeAuto = async () => {
      if (!landscapeAutoActiveRef.current) return;
      landscapeAutoActiveRef.current = false;
      setIsLandscapeTheater(false);
      if (getFullscreenElement() === videoContainerRef.current) {
        try {
          await exitDocumentFullscreen();
        } catch {
          /* best effort */
        }
      }
      restoreChatAfterLandscape();
    };

    const applyOrientation = () => {
      if (shouldAutoLandscapeVideo()) {
        void enterLandscapeAuto();
      } else {
        landscapeAutoDismissedRef.current = false;
        void exitLandscapeAuto();
      }
    };

    applyOrientation();

    const landscapeMq = window.matchMedia('(orientation: landscape)');
    landscapeMq.addEventListener('change', applyOrientation);
    window.addEventListener('orientationchange', applyOrientation);
    screen.orientation?.addEventListener('change', applyOrientation);

    return () => {
      landscapeMq.removeEventListener('change', applyOrientation);
      window.removeEventListener('orientationchange', applyOrientation);
      screen.orientation?.removeEventListener('change', applyOrientation);
      landscapeAutoDismissedRef.current = false;
      void exitLandscapeAuto();
    };
  }, [live, restoreChatAfterLandscape]);

  const enterVideoFullscreen = useCallback(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    void requestElementFullscreen(el).catch(() => {
      if (shouldAutoLandscapeVideo()) {
        setIsLandscapeTheater(true);
        return;
      }
      setCameraToast('Impossible d\'activer le plein écran sur cet appareil.');
    });
  }, []);

  const exitVideoFullscreen = useCallback(() => {
    if (isLandscapeTheater) {
      landscapeAutoActiveRef.current = false;
      landscapeAutoDismissedRef.current = true;
      setIsLandscapeTheater(false);
      restoreChatAfterLandscape();
      return;
    }
    if (landscapeAutoActiveRef.current) {
      landscapeAutoActiveRef.current = false;
      landscapeAutoDismissedRef.current = true;
      restoreChatAfterLandscape();
    }
    void exitDocumentFullscreen();
  }, [isLandscapeTheater, restoreChatAfterLandscape]);

  const openDonSheet = (amount?: number) => {
    setDonInitialAmount(amount);
    setShowDonSheet(true);
  };

  const openPrivate = (target: { id: string; name: string }) => {
    if (target.id === user?.id) return;
    setPrivateTarget({ id: target.id, username: target.name });
  };

  const toggleChatHidden = () => {
    setChatHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LIVE_CHAT_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const stopLive = async () => {
    if (!token || live?.hostId !== user?.id) return;
    if (cameraLocalActive) {
      stopCamera();
      emitCameraState(false);
    }
    await api.stopLive(token);
    onBack();
  };

  const toggleHostCamera = async () => {
    if (!live || live.hostId !== user?.id || cameraToggling) return;
    setCameraToggling(true);
    try {
      if (cameraLocalActive) {
        stopCamera();
        emitCameraState(false);
        setLive((prev) =>
          prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
        );
        return;
      }
      const ok = await startCamera();
      if (ok) {
        emitCameraState(true, 'camera');
        setLive((prev) => (prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev));
      }
    } finally {
      setCameraToggling(false);
    }
  };

  const onPickVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !live || live.hostId !== user?.id || cameraToggling) return;
    setCameraToggling(true);
    setVideoFileLoading(true);
    try {
      if (cameraLocalActive) {
        stopCamera();
        emitCameraState(false);
      }
      const ok = await startCameraFromFile(file);
      if (ok) {
        emitCameraState(true, 'file');
        setLive((prev) => (prev ? { ...prev, cameraActive: true, cameraMode: 'file' } : prev));
      }
    } finally {
      setVideoFileLoading(false);
      setCameraToggling(false);
    }
  };

  const isVipModerator = (live?.vipModeratorIds ?? []).includes(user?.id ?? '');
  const isDevModerator = Boolean(user?.isAdmin || live?.isDev);
  const canModerateChat = isHost || isVipModerator || isDevModerator;
  const chatParticipants = useMemo(() => {
    if (!live) return [];
    const seen = new Map<string, string>();
    for (const m of chatMessages) {
      if (m.senderId === live.hostId) continue;
      if ((live.vipModeratorIds ?? []).includes(m.senderId)) continue;
      if (!seen.has(m.senderId)) seen.set(m.senderId, m.senderName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [chatMessages, live?.hostId, live?.vipModeratorIds]);

  const vipEntries = useMemo(() => {
    if (!live) return [];
    return (live.vipModeratorIds ?? []).map((id) => {
      const fromChat = chatMessages.find((m) => m.senderId === id);
      return { id, name: fromChat?.senderName ?? 'Utilisateur' };
    });
  }, [live?.vipModeratorIds, chatMessages]);

  const setVipModerator = useCallback(
    (targetUserId: string, add: boolean) => {
      emitOnSocket('live_set_vip', { liveId, userId: targetUserId, add });
    },
    [liveId]
  );

  const banUser = useCallback(
    (
      targetUserId: string,
      opts: { permanent: boolean; durationMs?: number; scope: 'chat' | 'live' }
    ) => {
      emitOnSocket('live_ban', {
        liveId,
        userId: targetUserId,
        permanent: opts.permanent,
        durationMs: opts.durationMs,
        scope: opts.scope,
      });
    },
    [liveId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!token) return;
      const socket = getSocket();
      if (!socket) return;
      socket.emit('live_chat_delete', { liveId, messageId });
      try {
        await api.deleteChatMessage(token, 'live', liveId, messageId);
      } catch {
        /* suppression déjà appliquée via socket ou doublon */
      }
    },
    [token, liveId]
  );

  if (liveViewBanned) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-red-400 font-bold text-lg">Accès au live refusé</p>
        <p className="text-gray-400 text-sm max-w-md">{liveViewBanMessage ?? 'Vous êtes banni de ce live.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-full bg-purple-600 text-white font-bold text-sm hover:bg-purple-500"
        >
          Retour
        </button>
      </div>
    );
  }

  if (liveEnded) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-4xl">⏱</p>
        <p className="text-white font-bold text-lg">Live terminé</p>
        <p className="text-gray-400 text-sm max-w-sm">
          La durée maximale de 8 heures a été atteinte. Le live a été automatiquement arrêté.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-full bg-purple-600 text-white font-bold text-sm hover:bg-purple-500"
        >
          Retour
        </button>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-[#0b0b0f]">
        Chargement du live...
      </div>
    );
  }

  const showHostCamera = isHost && cameraLocalActive;
  const showViewerVideo = !isHost && viewerStreamActive;
  const showViewerCameraBadge =
    !isHost && !!live.cameraActive && !viewerStreamActive;
  const viewerCameraBadgeNote =
    live.cameraMode === 'file' ? LIVE_CAMERA_VIEWER_FILE_NOTE : LIVE_CAMERA_VIEWER_NOTE;
  /** Live = caméra (ou fichier local hôte). La lecture YouTube reste dans SalonPlaybackPanel. */

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
      {hostDonToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          💝 {hostDonToast}
        </div>
      )}

      {durationWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          ⚠ Live se terminera dans 15 min
        </div>
      )}

      {donToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-pink-950/90 border border-pink-500/40 text-sm text-pink-100 font-bold shadow-lg backdrop-blur">
          {donToast}
        </div>
      )}

      {cameraToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-500/40 text-sm text-red-100 font-medium shadow-lg backdrop-blur text-center">
          {cameraToast}
        </div>
      )}

      {showDonSheet && !isHost && hostCanReceiveDonations && token && (
        <LiveDonationSheet
          open={showDonSheet}
          onClose={() => setShowDonSheet(false)}
          liveId={liveId}
          hostName={live.hostName}
          token={token}
          userAge={user?.age}
          initialAmount={donInitialAmount}
          onSuccess={(message) => {
            setDonToast(message);
            window.setTimeout(() => setDonToast(null), 2500);
          }}
        />
      )}

      {privateTarget && (
        <LivePrivateSheet
          target={privateTarget}
          onClose={() => setPrivateTarget(null)}
          onOpenProfile={onOpenProfile}
        />
      )}

      <header className="shrink-0 flex items-center gap-3 px-3 py-2.5 border-b border-[#1e1e2f] bg-red-950/30">
          <button onClick={onBack} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{live.title}</p>
            <p className="text-xs text-red-400 flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="shrink-0">LIVE ·</span>
              <UsernameDisplay
                username={live.hostName}
                usernameColor={live.hostUsernameColor}
                usernameWaveFrom={live.hostUsernameWaveFrom}
                usernameWaveTo={live.hostUsernameWaveTo}
                className="truncate max-w-[8rem] sm:max-w-none"
              />
              {!isHost && (
                <HostRatingBlock
                  hostId={live.hostId}
                  hostName={live.hostName}
                  liveId={live.id}
                  inline
                  hideLabel
                  compact
                />
              )}
              <span className="shrink-0">· {viewers} spectateurs</span>
            </p>
            {remainingMs !== null && remainingMs > 0 && (
              <p className={`text-[10px] mt-0.5 ${remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#5a5a7a]'}`}>
                ⏱ {formatRemaining(remainingMs)} restants
              </p>
            )}
          </div>
          {!isHost && (
            <div className="shrink-0 flex items-center gap-1.5">
              <FollowUserButton
                userId={live.hostId}
                username={live.hostName}
                initialFollowing={hostFollowing}
                compact
                onFollowingChange={setHostFollowing}
              />
              {hostCanReceiveDonations && (
                <button
                  type="button"
                  onClick={() => openDonSheet()}
                  className="hidden sm:inline-flex px-2.5 py-1.5 bg-pink-950/50 border border-pink-500/50 rounded-full text-[10px] font-bold text-pink-200"
                  aria-label="Envoyer un pourboire"
                >
                  💝 Pourboire
                </button>
              )}
              <button
                type="button"
                onClick={() => openPrivate({ id: live.hostId, name: live.hostName })}
                className="px-2.5 py-1.5 bg-[#131318] border border-[#232330] rounded-full text-[10px] font-medium text-gray-400 hover:text-gray-200 hover:border-white/15 transition"
                title="Message privé"
                aria-label={`Message privé à ${live.hostName}`}
              >
                Message privé
              </button>
            </div>
          )}
          {isHost && (
            <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end max-w-[min(100%,14rem)]">
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.m4v"
                className="sr-only"
                aria-hidden
                onChange={(e) => void onPickVideoFile(e)}
              />
              <button
                type="button"
                onClick={toggleHostCamera}
                disabled={cameraToggling}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition disabled:opacity-50 ${
                  cameraLocalActive && cameraMode === 'camera'
                    ? 'bg-[#0f2018] border-[#1e4030] text-[#70aa88]'
                    : 'bg-[#131318] border-[#232330] text-gray-400 hover:border-white/15'
                }`}
              >
                {cameraToggling
                  ? '…'
                  : cameraLocalActive && cameraMode === 'camera'
                    ? '📹 Caméra on'
                    : '📷 Activer la caméra'}
              </button>
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                disabled={cameraToggling || videoFileLoading}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition disabled:opacity-50 ${
                  cameraLocalActive && cameraMode === 'file'
                    ? 'bg-[#0f2018] border-[#1e4030] text-[#70aa88]'
                    : 'bg-[#131318] border-[#232330] text-gray-400 hover:border-white/15'
                }`}
                title="Aperçu vidéo sans caméra (fichier local)"
              >
                {videoFileLoading ? '…' : cameraLocalActive && cameraMode === 'file' ? '🎬 Vidéo on' : 'Choisir une vidéo'}
              </button>
              <button
                onClick={stopLive}
                className="px-3 py-1.5 bg-[#1a1a26] border border-red-500/50 rounded-full text-xs text-red-400 font-bold"
              >
                Arrêter
              </button>
            </div>
          )}
      </header>

      <ChatRoomProvider
        roomId={liveId}
        roomType="live"
        userId={user!.id}
        userName={user!.username}
        token={token ?? undefined}
        initialMessages={chatMessages}
        onPrivateMessage={openPrivate}
        isHost={isHost}
        canModerateChat={canModerateChat}
        isDevModerator={isDevModerator}
        hostId={live.hostId}
        vipModeratorIds={live.vipModeratorIds ?? []}
        onSetVip={isHost || isDevModerator ? setVipModerator : undefined}
        onBanUser={canModerateChat ? banUser : undefined}
        onViewProfile={!isHost && onOpenProfile ? onOpenProfile : undefined}
        chatBanned={chatBanned}
        chatBanMessage={chatBanMessage ?? undefined}
        onDeleteMessage={canModerateChat ? handleDeleteMessage : undefined}
        onOpenDonation={!isHost && hostCanReceiveDonations ? openDonSheet : undefined}
      >
      <RoomTheaterLayout
        chatHidden={chatHidden}
        onToggleChat={toggleChatHidden}
        chatTitle="Chat public"
        chatMinimized={chatMinimized}
        onToggleMinimize={() => setChatMinimized((m) => !m)}
        stage={
          <div
            ref={videoContainerRef}
            className={`live-video-container relative w-full h-full min-h-0 flex flex-col bg-black overflow-hidden${
              isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
            }`}
          >
            {showHostCamera && (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover bg-black"
                aria-label="Aperçu caméra"
              />
            )}
            {showViewerVideo && (
              <video
                ref={viewerVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover bg-black"
                aria-label="Flux vidéo du host"
              />
            )}
            {showViewerCameraBadge && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <div className="rounded-2xl bg-[#12121a]/90 border border-white/10 px-5 py-4 max-w-sm">
                  <p className="text-3xl mb-2">📹</p>
                  <p className="text-sm font-semibold text-gray-200">Caméra du host active</p>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    {viewerRelayError ?? viewerCameraBadgeNote}
                  </p>
                </div>
              </div>
            )}
            {!showHostCamera && !showViewerVideo && !showViewerCameraBadge && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
                style={{
                  backgroundImage: live.playbackState.albumArtUrl
                    ? `url(${live.playbackState.albumArtUrl})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-black/75" aria-hidden />
                <img
                  src={live.playbackState.albumArtUrl}
                  alt=""
                  className="relative z-10 w-28 h-28 rounded-xl object-cover shadow-xl"
                />
                <div className="relative z-10 max-w-xs">
                  <p className="text-sm font-bold text-white truncate">{live.playbackState.title}</p>
                  <p className="text-xs text-gray-300 truncate">{live.playbackState.artist}</p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {isHost
                      ? 'Activez la caméra ou choisissez une vidéo'
                      : 'Écoutez et discutez dans le chat'}
                  </p>
                </div>
              </div>
            )}

            <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 px-3">
              <div className="flex items-center gap-2 pointer-events-none">
                <img
                  src={live.playbackState.albumArtUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{live.playbackState.title}</p>
                  <p className="text-[10px] text-gray-400 truncate">{live.playbackState.artist}</p>
                </div>
              </div>
            </div>

            {!isHost && hostCanReceiveDonations && (
              <LiveGiftOverlay liveId={liveId} visible onOpenGiftSheet={openDonSheet} />
            )}

            {(FULLSCREEN_SUPPORTED || isLandscapeTheater) && (
              <div className="absolute top-2 left-2 z-30 pointer-events-auto">
                {isVideoExpanded ? (
                  <button
                    type="button"
                    onClick={exitVideoFullscreen}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-[11px] font-bold backdrop-blur hover:bg-black/85 active:scale-95 transition"
                    aria-label="Quitter le plein écran"
                  >
                    <LiveVideoShrinkIcon />
                    <span className="hidden sm:inline">Quitter le plein écran</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={enterVideoFullscreen}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-[11px] font-bold backdrop-blur hover:bg-black/85 active:scale-95 transition"
                    aria-label="Plein écran"
                  >
                    <LiveVideoExpandIcon />
                    <span className="hidden sm:inline">Plein écran</span>
                  </button>
                )}
              </div>
            )}
          </div>
        }
        stageFooter={
          <div className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {(isHost || isDevModerator) && (
                <button
                  type="button"
                  onClick={() => setShowVipPanel((v) => !v)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition ${
                    showVipPanel
                      ? 'bg-[#2a2010] border-[#3a3010] text-[#c8a850]'
                      : 'bg-[#131318] border-[#232330] text-gray-400 hover:border-white/15'
                  }`}
                  title="Modérateurs VIP"
                  aria-expanded={showVipPanel}
                >
                  ⭐ VIP
                </button>
              )}
              {!isHost && isDevModerator && (
                <span className="text-[10px] font-bold text-cyan-300">Dev</span>
              )}
              {!isHost && isVipModerator && !isDevModerator && (
                <span className="text-[10px] font-bold text-amber-300">Modérateur VIP</span>
              )}
            </div>
            {isHost && liveCameraHints.length > 0 &&
              liveCameraHints.map((hint) => (
                <p key={hint.slice(0, 48)} className="text-[10px] text-gray-500 leading-relaxed">
                  {hint}
                </p>
              ))}
            {(isHost || isDevModerator) && showVipPanel && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                <p className="text-xs font-bold text-amber-300 mb-2">VIP / Modérateurs</p>
                {vipEntries.length === 0 ? (
                  <p className="text-[11px] text-gray-500 mb-2">Aucun modérateur VIP pour l&apos;instant.</p>
                ) : (
                  <ul className="space-y-1.5 mb-3">
                    {vipEntries.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-200 truncate">
                          <span className="text-amber-400 font-bold">VIP</span> · {v.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Retirer le statut VIP de ${v.name} ?`)) return;
                            setVipModerator(v.id, false);
                          }}
                          className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold text-red-300 border border-red-500/30 hover:bg-red-500/10"
                        >
                          Retirer VIP
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {chatParticipants.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {chatParticipants.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setVipModerator(p.id, true)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1a1a26] border border-amber-500/30 text-amber-100"
                        >
                          + {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-gray-500">Ajoutez un modérateur depuis le chat.</p>
                )}
              </div>
            )}
            <p className="text-[10px] text-gray-600">MP = message privé (touchez un pseudo dans le chat)</p>
          </div>
        }
        chat={
          <div className="flex flex-col h-full min-h-0">
            <ChatMessagesView />
          </div>
        }
        chatInput={<ChatInputBar />}
      />
        <ChatModals />
      </ChatRoomProvider>
    </div>
  );
}
