import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCamera } from '../hooks/useLiveCamera';
import {
  pauseMediaElements,
  pauseYoutubeEmbeds,
  restoreYoutubeEmbeds,
  usePauseMediaOnPageHidden,
} from '../hooks/usePauseMediaOnPageHidden';
import { api } from '../lib/api';
import { LIVE_CAMERA_VIEWER_NOTE } from '../lib/liveCameraMessages';
import { getLiveCameraContextHints } from '../lib/liveCameraSupport';
import { getSocket } from '../lib/socket';
import { setActiveHostLiveId } from '../lib/liveHostContext';
import { ChatPanel } from '../components/ChatPanel';
import { LivePrivateSheet } from '../components/LivePrivateSheet';
import { UserProfileSheet } from '../components/UserProfileSheet';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { FollowUserButton } from '../components/FollowUserButton';
import {
  DON_AMOUNT_MAX,
  DON_AMOUNT_MIN,
  LIVE_DON_TIERS,
  donAmountValidationMessage,
  parseDonAmount,
} from '../lib/liveReactions';
import type { ChatMessage, DmContact, Live, AppNotification } from '../types';

const LIVE_CHAT_HIDDEN_KEY = 'melosong_live_chat_hidden';

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

function readLiveChatHidden(): boolean {
  try {
    return localStorage.getItem(LIVE_CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function LivePage({ liveId, onBack }: { liveId: string; onBack: () => void }) {
  const { user, token } = useAuth();
  const [live, setLive] = useState<Live | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [chatHidden, setChatHidden] = useState(readLiveChatHidden);
  const [chatAnimReady, setChatAnimReady] = useState(false);
  const [chatDir, setChatDir] = useState<'idle' | 'open' | 'close'>('idle');
  const [privateTarget, setPrivateTarget] = useState<DmContact | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [showDonSheet, setShowDonSheet] = useState(false);
  const [donSending, setDonSending] = useState(false);
  const [donCustomAmount, setDonCustomAmount] = useState('');
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
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const {
    videoRef,
    active: cameraLocalActive,
    mode: cameraMode,
    error: cameraError,
    setError: setCameraError,
    start: startCamera,
    startFromFile: startCameraFromFile,
    stop: stopCamera,
  } = useLiveCamera();
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoFileLoading, setVideoFileLoading] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const liveCameraHints = useMemo(() => getLiveCameraContextHints(), []);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(false);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const chatHiddenBeforeLandscapeRef = useRef<boolean | null>(null);
  const chatHiddenRef = useRef(chatHidden);
  chatHiddenRef.current = chatHidden;

  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;

  const emitCameraState = useCallback(
    (active: boolean) => {
      getSocket().emit('live_camera_toggle', { liveId, active });
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
    socket.emit('join_live', { liveId });
    const onUpdate = (l: Live) => {
      if (l.id === liveId) {
        setLive(l);
        setViewers(l.viewersCount);
      }
    };
    socket.on('live_updated', onUpdate);
    return () => {
      socket.emit('leave_live', { liveId });
      socket.off('live_updated', onUpdate);
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
    const socket = getSocket();
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
        getSocket().emit('leave_live', { liveId });
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
        getSocket().emit('live_camera_toggle', { liveId, active: false });
      }
      stopCamera();
    };
  }, [liveId, stopCamera]);

  const cameraLocalActiveRef = useRef(cameraLocalActive);
  cameraLocalActiveRef.current = cameraLocalActive;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const pausedByPageHiddenRef = useRef(false);
  const savedYoutubeSrcsRef = useRef<string[]>([]);

  usePauseMediaOnPageHidden({
    onPageHidden: () => {
      pausedByPageHiddenRef.current = true;
      const root = videoContainerRef.current;
      if (root) {
        pauseMediaElements(root);
        savedYoutubeSrcsRef.current = pauseYoutubeEmbeds(root);
      }
      pauseMediaElements(document);
      if (savedYoutubeSrcsRef.current.length === 0) {
        savedYoutubeSrcsRef.current = pauseYoutubeEmbeds(document);
      }
      if (isHostRef.current && cameraLocalActiveRef.current) {
        stopCamera();
        emitCameraState(false);
        setLive((prev) => (prev ? { ...prev, cameraActive: false } : prev));
      }
    },
    onPageVisible: () => {
      if (!pausedByPageHiddenRef.current) return;
      pausedByPageHiddenRef.current = false;
      const root = videoContainerRef.current;
      const urls = savedYoutubeSrcsRef.current;
      if (root && urls.length > 0) {
        restoreYoutubeEmbeds(root, urls);
      }
      savedYoutubeSrcsRef.current = [];
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
    setChatDir(prev ? 'close' : 'open');
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
      setChatDir('close');

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

  const sendDonation = async (amount: number) => {
    if (!token || donSending) return;
    setGiftError(null);
    setDonSending(true);
    try {
      await api.sendGift(token, liveId, 'don', amount);
      setDonCustomAmount('');
      setShowDonSheet(false);
      setDonToast('Merci pour votre don !');
      window.setTimeout(() => setDonToast(null), 2500);
    } catch (e) {
      setGiftError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setDonSending(false);
    }
  };

  const openPrivate = (target: { id: string; name: string }) => {
    if (target.id === user?.id) return;
    setPrivateTarget({ id: target.id, username: target.name });
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setChatAnimReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleChatHidden = () => {
    setChatHidden((prev) => {
      const next = !prev;
      setChatDir(next ? 'close' : 'open');
      try {
        localStorage.setItem(LIVE_CHAT_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const onChatCollapsibleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === 'clip-path' && chatHidden && chatDir === 'close') {
      setChatDir('idle');
    }
    if (e.propertyName === 'max-height' && !chatHidden && chatDir === 'open') {
      setChatDir('idle');
    }
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
        setLive((prev) => (prev ? { ...prev, cameraActive: false } : prev));
        return;
      }
      const ok = await startCamera();
      if (ok) {
        emitCameraState(true);
        setLive((prev) => (prev ? { ...prev, cameraActive: true } : prev));
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
        emitCameraState(true);
        setLive((prev) => (prev ? { ...prev, cameraActive: true } : prev));
      }
    } finally {
      setVideoFileLoading(false);
      setCameraToggling(false);
    }
  };

  const isVipModerator = (live?.vipModeratorIds ?? []).includes(user?.id ?? '');
  const canModerateChat = isHost || isVipModerator;
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
      getSocket().emit('live_set_vip', { liveId, userId: targetUserId, add });
    },
    [liveId]
  );

  const banUser = useCallback(
    (
      targetUserId: string,
      opts: { permanent: boolean; durationMs?: number; scope: 'chat' | 'live' }
    ) => {
      getSocket().emit('live_ban', {
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

  if (!live) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-[#0b0b0f]">
        Chargement du live...
      </div>
    );
  }

  const showHostCamera = isHost && cameraLocalActive;
  const showViewerCameraBadge = !isHost && !!live.cameraActive;
  const youtubeEmbed =
    live.platform === 'youtube' && live.playbackState.trackId
      ? `https://www.youtube.com/embed/${live.playbackState.trackId}?autoplay=0`
      : null;

  return (
    <div className="relative flex flex-col flex-1 h-full min-h-0 pb-0 mb-0 bg-[#0b0b0f] overflow-hidden">
      {hostDonToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          💝 {hostDonToast}
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

      {showDonSheet && !isHost && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowDonSheet(false)}>
          <div
            className="bg-[#12121a] rounded-t-2xl border-t border-[#2d2d3d] shadow-2xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-white">Faire un don</p>
              <button type="button" onClick={() => setShowDonSheet(false)} className="text-gray-400 hover:text-white text-xl px-2">
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Soutenez {live.hostName} — don symbolique, sans MeloCoins.
            </p>
            {giftError && <p className="text-xs text-red-400 text-center mb-3">{giftError}</p>}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {LIVE_DON_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={donSending}
                  onClick={() => sendDonation(tier)}
                  className="flex flex-col items-center py-4 rounded-xl bg-pink-950/40 border border-pink-500/40 hover:border-pink-400 active:scale-95 transition disabled:opacity-50"
                >
                  <span className="text-2xl">💝</span>
                  <span className="text-sm font-bold text-pink-200 mt-1">{tier} €</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-pink-500/30 bg-pink-950/20 p-3">
              <p className="text-xs font-bold text-pink-200 mb-2">Montant libre</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={DON_AMOUNT_MIN}
                    max={DON_AMOUNT_MAX}
                    step={1}
                    inputMode="numeric"
                    value={donCustomAmount}
                    onChange={(e) => setDonCustomAmount(e.target.value)}
                    placeholder={`${DON_AMOUNT_MIN}–${DON_AMOUNT_MAX}`}
                    disabled={donSending}
                    className="w-full rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2.5 pr-8 text-sm text-white placeholder:text-gray-500 disabled:opacity-50"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    €
                  </span>
                </div>
                <button
                  type="button"
                  disabled={donSending}
                  onClick={() => {
                    const amount = parseDonAmount(donCustomAmount);
                    if (amount == null) {
                      setGiftError(donAmountValidationMessage());
                      return;
                    }
                    void sendDonation(amount);
                  }}
                  className="shrink-0 px-4 py-2.5 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-500 active:scale-95 transition disabled:opacity-50"
                >
                  Donner
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">{donAmountValidationMessage()}</p>
            </div>
          </div>
        </div>
      )}

      {privateTarget && (
        <LivePrivateSheet target={privateTarget} onClose={() => setPrivateTarget(null)} />
      )}

      {profileUserId && (
        <UserProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}

      <div className="shrink-0 min-h-0">
        <header className="flex items-center gap-3 px-3 py-2.5 border-b border-[#1e1e2f] bg-red-950/30">
          <button onClick={onBack} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{live.title}</p>
            <p className="text-xs text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE · {live.hostName} · {viewers} spectateurs
            </p>
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
              <button
                type="button"
                onClick={() => setShowDonSheet(true)}
                className="px-2.5 py-1.5 bg-pink-950/50 border border-pink-500/50 rounded-full text-[10px] font-bold text-pink-200"
              >
                💝 Don
              </button>
              <button
                type="button"
                onClick={() => openPrivate({ id: live.hostId, name: live.hostName })}
                className="px-2.5 py-1.5 bg-purple-900/40 border border-purple-600/40 rounded-full text-[10px] font-bold text-purple-300"
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
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition disabled:opacity-50 ${
                  cameraLocalActive && cameraMode === 'camera'
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-purple-500/40'
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
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition disabled:opacity-50 ${
                  cameraLocalActive && cameraMode === 'file'
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-purple-500/40'
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

        <div className="px-3 py-2 flex gap-2.5 items-center border-b border-[#1e1e2f] relative z-0">
          {isHost && (
            <button
              type="button"
              onClick={() => setShowVipPanel((v) => !v)}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition ${
                showVipPanel
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                  : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300 hover:border-amber-500/40'
              }`}
              title="Modérateurs VIP"
              aria-expanded={showVipPanel}
            >
              ⭐ VIP
            </button>
          )}
          <img
            src={live.playbackState.albumArtUrl}
            alt=""
            className="w-12 h-12 rounded-lg object-cover shadow-lg shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{live.playbackState.title}</h2>
            <p className="text-xs text-gray-400 truncate">{live.playbackState.artist}</p>
          </div>
        </div>

        {isHost && liveCameraHints.length > 0 && (
          <div className="px-3 py-1.5 border-b border-[#1e1e2f] bg-[#12121a]/60">
            {liveCameraHints.map((hint) => (
              <p key={hint.slice(0, 48)} className="text-[10px] text-gray-500 leading-relaxed">
                {hint}
              </p>
            ))}
          </div>
        )}

        {isHost && showVipPanel && (
          <div className="px-3 py-2 border-b border-[#1e1e2f] bg-amber-950/20 relative z-0">
            <p className="text-xs font-bold text-amber-300 mb-2">VIP / Modérateurs</p>
            <p className="text-[10px] text-gray-500 mb-2">
              Les modérateurs peuvent supprimer les messages du chat public.
            </p>
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
                      onClick={() => setVipModerator(v.id, false)}
                      className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold text-red-300 border border-red-500/30 hover:bg-red-500/10"
                    >
                      Retirer VIP
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {chatParticipants.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Ajouter depuis le chat
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {chatParticipants.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setVipModerator(p.id, true)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1a1a26] border border-amber-500/30 text-amber-100 hover:border-amber-400"
                      >
                        + {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">
                Les pseudos du chat apparaîtront ici pour nommer un modérateur.
              </p>
            )}
          </div>
        )}

        {!isHost && isVipModerator && (
          <div className="px-3 py-1 border-b border-[#1e1e2f] bg-amber-950/15">
            <p className="text-[10px] font-bold text-amber-300">
              Modérateur · supprimer des messages, bannir du chat ou du live
            </p>
          </div>
        )}

        {!isHost && (
          <div className="px-3 py-1.5 border-b border-[#1e1e2f] bg-[#12121a]/40">
            <HostRatingBlock hostId={live.hostId} hostName={live.hostName} liveId={live.id} compact />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 pb-0 flex flex-col overflow-hidden relative">
        <div
          ref={videoContainerRef}
          className={`live-video-container relative flex-1 min-h-0 flex flex-col bg-[#0b0b0f] overflow-hidden${
            isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
          }`}
        >
          {youtubeEmbed && (
            <iframe
              title="YouTube"
              src={youtubeEmbed}
              className={`live-video-youtube w-full border-0 bg-black ${
                isVideoExpanded
                  ? 'absolute inset-0 h-full z-0'
                  : 'relative shrink-0 h-[7.5rem] max-h-[7.5rem] mx-3 mt-2 rounded-lg border border-[#1e1e2f]'
              }`}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            />
          )}

          <div
            className={`relative flex-1 min-h-0 ${
              isVideoExpanded ? 'absolute inset-0 z-10 pointer-events-none' : ''
            }`}
          >
            {showHostCamera && (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={
                  youtubeEmbed
                    ? `pointer-events-auto absolute bottom-3 right-3 z-20 object-cover border-2 border-emerald-500/40 shadow-lg shadow-black/60 bg-black ${
                        isVideoExpanded
                          ? 'live-video-camera-pip w-[28%] max-w-[220px] aspect-[3/4] rounded-xl'
                          : 'w-[38%] max-w-[140px] aspect-[3/4] rounded-xl'
                      }`
                    : 'absolute inset-0 w-full h-full object-cover bg-black'
                }
                aria-label="Aperçu caméra"
              />
            )}
            {showViewerCameraBadge && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
                <div className="rounded-2xl bg-[#12121a]/90 border border-emerald-500/30 px-5 py-4 max-w-sm">
                  <p className="text-3xl mb-2">📹</p>
                  <p className="text-sm font-bold text-emerald-200">Caméra du host active</p>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{LIVE_CAMERA_VIEWER_NOTE}</p>
                </div>
              </div>
            )}
            {!showHostCamera && !showViewerCameraBadge && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs px-4 text-center pointer-events-none">
                {isHost
                  ? 'Activez la caméra ou choisissez une vidéo pour l’aperçu'
                  : 'Écoutez et discutez dans le chat'}
              </div>
            )}
          </div>

          {(FULLSCREEN_SUPPORTED || isLandscapeTheater) && (
            <div className="absolute top-2 right-2 z-30 pointer-events-auto">
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

        <div
          className={`live-chat-panel relative shrink-0 w-full mt-auto flex flex-col border-t border-[#1e1e2f] bg-[#0b0b0f] pb-0 ${
            chatAnimReady ? 'live-chat-panel--ready' : ''
          } ${isLandscapeTheater && !chatHidden ? 'fixed bottom-0 left-0 right-0 z-[60] max-h-[32vh] shadow-[0_-8px_32px_rgba(0,0,0,0.6)]' : 'z-10'}`}
          data-collapsed={chatHidden ? 'true' : 'false'}
          data-chat-dir={chatDir}
        >
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-0.5 min-h-0 border-b border-[#1e1e2f] bg-[#12121a]/50">
              {!chatHidden && (
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Chat public</p>
              )}
              <div
                className={`flex items-center gap-2 shrink-0 ${chatHidden ? 'w-full justify-center' : ''}`}
              >
                {!chatHidden && (
                  <p className="text-[10px] text-gray-500 hidden sm:inline">MP = message privé</p>
                )}
                <button
                  type="button"
                  onClick={toggleChatHidden}
                  className={`flex items-center gap-1 rounded-full font-bold bg-[#1a1a26] border border-[#2d2d3d] transition ${
                    chatHidden
                      ? 'gap-1.5 px-3 py-1.5 text-[11px] text-purple-300 hover:border-purple-500/40'
                      : 'px-2.5 py-1 text-[10px] text-gray-400 hover:text-purple-300 hover:border-purple-500/40'
                  }`}
                  aria-expanded={!chatHidden}
                  aria-label={chatHidden ? 'Afficher le chat' : 'Masquer le chat'}
                >
                  <span aria-hidden>💬</span>
                  {chatHidden ? 'Afficher le chat' : 'Masquer le chat'}
                </button>
              </div>
            </div>
            <div
              className="live-chat-collapsible"
              aria-hidden={chatHidden && chatDir === 'idle'}
              onTransitionEnd={onChatCollapsibleTransitionEnd}
            >
              <div className="live-chat-body min-h-0 overflow-hidden">
                <ChatPanel
                  roomId={liveId}
                  roomType="live"
                  userId={user!.id}
                  userName={user!.username}
                  token={token ?? undefined}
                  initialMessages={chatMessages}
                  onPrivateMessage={openPrivate}
                  isHost={isHost}
                  canModerateChat={canModerateChat}
                  hostId={live.hostId}
                  vipModeratorIds={live.vipModeratorIds ?? []}
                  onSetVip={isHost ? setVipModerator : undefined}
                  onBanUser={canModerateChat ? banUser : undefined}
                  onViewProfile={!isHost ? setProfileUserId : undefined}
                  chatBanned={chatBanned}
                  chatBanMessage={chatBanMessage ?? undefined}
                  onDeleteMessage={canModerateChat ? handleDeleteMessage : undefined}
                />
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
