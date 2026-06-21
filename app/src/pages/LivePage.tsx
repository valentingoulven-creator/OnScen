import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { useLiveCamera } from '../hooks/useLiveCamera';
import { usePauseMediaOnPageHidden, pauseMediaElements } from '../hooks/usePauseMediaOnPageHidden';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import { releaseAppMediaFocus, requestAppMediaFocus } from '../lib/appMediaFocus';
import { api, ApiRequestError } from '../lib/api';
import {
  LIVE_CAMERA_MIC_SWITCHING,
  liveStreamEndedHintKey,
  type LiveStreamEndedReason,
} from '../lib/liveCameraMessages';
import { emitLiveCameraToggle, clearLiveCameraToggleQueue } from '../lib/liveCameraSocket';
import { useLiveVideoRelay } from '../hooks/useLiveVideoRelay';
import { useCloudflareHlsPlayback } from '../hooks/useCloudflareHlsPlayback';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';
import { setActiveHostLiveId } from '../lib/liveHostContext';
import {
  clearPendingLiveCameraStart,
  hasPendingLiveCameraStart,
} from '../lib/liveMediaPrefs';
import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { LivePrivateSheet } from '../components/LivePrivateSheet';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { LiveDonationSheet } from '../components/LiveDonationSheet';
import { CreatorSubscribeSheet } from '../components/CreatorSubscribeSheet';
import { LiveGiftOverlay } from '../components/LiveGiftOverlay';
import { LiveParticipantsPopover } from '../components/LiveParticipantsPopover';
import { LiveVideoStage } from '../components/LiveVideoStage';
import { LiveKitVideoStage } from '../components/LiveKitVideoStage';
import { LiveCloudflareHostPanel } from '../components/LiveCloudflareHostPanel';
import { ReportContentModal } from '../components/ReportContentModal';
import { useDraggableVideoPip } from '../components/DraggableVideoPip';
import type { ChatMessage, DmContact, Live, AppNotification, PlaybackState } from '../types';

const SOUNDY_BASE_URL = 'https://getsoundy.com';
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
  const { t } = useTranslation();
  const [live, setLive] = useState<Live | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [chatHidden, setChatHidden] = useState(readLiveChatHidden);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [privateTarget, setPrivateTarget] = useState<DmContact | null>(null);
  const [showDonSheet, setShowDonSheet] = useState(false);
  const [showSubscribeSheet, setShowSubscribeSheet] = useState(false);
  const [reportLiveOpen, setReportLiveOpen] = useState(false);
  const [donInitialAmount, setDonInitialAmount] = useState<number | undefined>();
  const [donToast, setDonToast] = useState<string | null>(null);
  const [subscribeToast, setSubscribeToast] = useState<string | null>(null);
  const [hostDonToast, setHostDonToast] = useState<string | null>(null);
  const [cameraToast, setCameraToast] = useState<string | null>(null);
  const [cameraToggling, setCameraToggling] = useState(false);
  const [showVipPanel, setShowVipPanel] = useState(false);
  const [showCfHostPanel, setShowCfHostPanel] = useState(true);
  const [cfProvisioning, setCfProvisioning] = useState(false);
  const [cloudflareAvailable, setCloudflareAvailable] = useState<boolean | null>(null);
  const [obsAllowed, setObsAllowed] = useState<boolean | null>(null);
  const [chatBanned, setChatBanned] = useState(false);
  const [chatBanMessage, setChatBanMessage] = useState<string | null>(null);
  const [chatBanUntil, setChatBanUntil] = useState<number | null>(null);
  const [liveViewBanned, setLiveViewBanned] = useState(false);
  const [liveViewBanMessage, setLiveViewBanMessage] = useState<string | null>(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [streamEndedReason, setStreamEndedReason] = useState<LiveStreamEndedReason | null>(null);
  const [archivedPlaybackUrl, setArchivedPlaybackUrl] = useState<string | null>(null);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [livePipActive, setLivePipActive] = useState(false);
  const livePip = useDraggableVideoPip(livePipActive, () => setLivePipActive(false));
  const {
    videoRef,
    active: cameraLocalActive,
    mode: cameraMode,
    error: cameraError,
    setError: setCameraError,
    start: startCamera,
    startFromFile: startCameraFromFile,
    stop: stopCamera,
    broadcastStream,
    audioDevices,
    audioDeviceId,
    micSwitching,
    switchMicrophone,
    previewBlocked: hostPreviewBlocked,
    enableHostPreview,
  } = useLiveCamera();
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoFileLoading, setVideoFileLoading] = useState(false);
  const chatHiddenBeforeExpandRef = useRef<boolean | null>(null);
  const chatHiddenRef = useRef(chatHidden);
  chatHiddenRef.current = chatHidden;
  const isHostRef = useRef(false);

  const emitCameraState = useCallback(
    (active: boolean, mode?: 'camera' | 'file') => {
      emitLiveCameraToggle(liveId, active, mode);
    },
    [liveId]
  );

  const hostCameraBroadcastRef = useRef(false);
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const cameraLocalActiveRef = useRef(cameraLocalActive);
  cameraLocalActiveRef.current = cameraLocalActive;
  useEffect(() => {
    hostCameraBroadcastRef.current = !!(live?.hostId === user?.id && cameraLocalActive);
  }, [live?.hostId, user?.id, cameraLocalActive]);

  useEffect(() => {
    if (!token) return;
    setArchivedPlaybackUrl(null);
    api
      .getLive(token, liveId)
      .then(async (r) => {
        setLive(r.live);
        setViewers(r.live.viewersCount);
        if (!r.live.isActive) {
          if (r.live.streamMode === 'cloudflare') {
            try {
              const playback = await api.getLivePlayback(token, liveId);
              setArchivedPlaybackUrl(playback.playbackUrl);
              setStreamEndedReason(null);
            } catch {
              if (r.live.hostId !== user?.id) setStreamEndedReason('host_stopped');
            }
          } else if (r.live.hostId !== user?.id) {
            setStreamEndedReason('host_stopped');
          }
        } else if (r.live.hostId !== user?.id) {
          setStreamEndedReason(null);
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
        if (!l.isActive && l.hostId !== user?.id) {
          setStreamEndedReason((prev) => prev ?? 'host_stopped');
        } else if (l.isActive && l.hostId !== user?.id) {
          setStreamEndedReason(null);
        }
        setLive((prev) => {
          const preserveHostCamera =
            !!prev &&
            prev.hostId === user?.id &&
            cameraLocalActiveRef.current &&
            !l.cameraActive;
          return {
            ...l,
            ...(preserveHostCamera
              ? { cameraActive: true, cameraMode: prev.cameraMode ?? 'camera' }
              : {}),
            hostMonetizationEligible:
              l.hostMonetizationEligible ?? prev?.hostMonetizationEligible,
          };
        });
        setViewers(l.viewersCount);
      }
    };
    const onPlayback = (state: PlaybackState) => {
      setLive((prev) => {
        if (!prev || prev.id !== liveId) return prev;
        return { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) };
      });
    };
    const onJoinDenied = (payload: { liveId: string; message?: string }) => {
      if (payload.liveId !== liveId) return;
      setLiveViewBanned(true);
      setLiveViewBanMessage(payload.message ?? 'Impossible de rejoindre ce live.');
    };
    socket.on('live_updated', onUpdate);
    socket.on('playback_sync', onPlayback);
    socket.on('salon_playback', onPlayback);
    socket.on('live_join_denied', onJoinDenied);
    return () => {
      offReconnect();
      socket.emit('leave_live', { liveId });
      socket.off('live_updated', onUpdate);
      socket.off('playback_sync', onPlayback);
      socket.off('salon_playback', onPlayback);
      socket.off('live_join_denied', onJoinDenied);
    };
  }, [liveId, user?.id]);

  useEffect(() => {
    setStreamEndedReason(null);
    setLiveEnded(false);
  }, [liveId]);

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
      setDurationWarning(false);
      if (isHostRef.current && payload.reason === 'duration_limit') {
        setLiveEnded(true);
        return;
      }
      if (!isHostRef.current) {
        setStreamEndedReason(payload.reason);
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
    pauseMediaElements(document, { exceptLiveStage: true });
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
  isHostRef.current = isHost;
  const viewerStreamEnded = !isHost && streamEndedReason !== null && live?.isActive === false;
  const streamEndedTitle = t('live.streamEnded');
  const streamEndedHint = streamEndedReason
    ? t(liveStreamEndedHintKey(streamEndedReason))
    : undefined;
  const isLiveKitStream = live?.streamMode === 'livekit';
  const isArchivedReplay = !!live && !live.isActive && !!archivedPlaybackUrl;
  const isCloudflareStream =
    (live?.streamMode === 'cloudflare' && !!live.cloudflarePlaybackUrl) || isArchivedReplay;
  const canSwitchToCloudflare = !!(
    isHost &&
    live?.isActive &&
    !isCloudflareStream &&
    (live.streamMode === 'livekit' || live.streamMode === 'webrtc' || !live.streamMode)
  );
  const showConfigureObsButton =
    canSwitchToCloudflare && cloudflareAvailable === true && obsAllowed !== false;
  useEffect(() => {
    if (!token || !isHost) return;
    let cancelled = false;
    api
      .getLiveStreamCapabilities(token)
      .then((caps) => {
        if (!cancelled) {
          setCloudflareAvailable(caps.cloudflareStreamAvailable);
          setObsAllowed(caps.obsAllowed ?? false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloudflareAvailable(false);
          setObsAllowed(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, isHost]);

  const configureObs = useCallback(async () => {
    if (!token || !live || cfProvisioning || !canSwitchToCloudflare) return;
    setCfProvisioning(true);
    try {
      if (isLiveKitStream && live.cameraActive) {
        emitCameraState(false);
        setLive((prev) =>
          prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
        );
      } else if (hostCameraBroadcastRef.current) {
        emitCameraState(false);
        setLive((prev) =>
          prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
        );
      }
      const res = await api.provisionCloudflareStream(token, liveId);
      if (res.live.streamMode !== 'cloudflare' || !res.live.cloudflarePlaybackUrl) {
        throw new Error('Impossible de configurer Cloudflare Stream.');
      }
      setLive((prev) => ({
        ...res.live,
        hostMonetizationEligible:
          res.live.hostMonetizationEligible ?? prev?.hostMonetizationEligible,
      }));
      setShowCfHostPanel(true);
    } catch (e) {
      const message =
        e instanceof ApiRequestError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Impossible de configurer Cloudflare Stream.';
      setCameraToast(message);
      window.setTimeout(() => setCameraToast(null), 5000);
    } finally {
      setCfProvisioning(false);
    }
  }, [
    token,
    live,
    liveId,
    cfProvisioning,
    canSwitchToCloudflare,
    isLiveKitStream,
    emitCameraState,
  ]);

  const hostCameraRelayActive = !!(
    isHost &&
    cameraLocalActive &&
    cameraMode === 'camera' &&
    !isCloudflareStream &&
    !isLiveKitStream
  );
  const viewerCameraRelayActive =
    !isHost &&
    !!live?.cameraActive &&
    live.cameraMode !== 'file' &&
    !isCloudflareStream &&
    !isLiveKitStream;

  const {
    viewerVideoRef,
    viewerStreamActive,
    viewerRelayError,
    viewerRelayPhase,
    viewerAudioBlocked,
    viewerPlaybackBlocked,
    viewerHasVideoTrack,
    viewerDebugInfo,
    enableViewerPlayback,
    retryViewerRelay,
    replaceHostTrack,
    releaseRelayConnections,
  } = useLiveVideoRelay({
    liveId,
    userId: user?.id,
    authToken: token ?? undefined,
    hostId: live?.hostId,
    broadcastStream: hostCameraRelayActive ? broadcastStream : null,
    cameraRelayActive: isHost ? hostCameraRelayActive : viewerCameraRelayActive,
  });

  useEffect(() => {
    if (!viewerStreamEnded) return;
    releaseRelayConnections();
  }, [viewerStreamEnded, releaseRelayConnections]);

  const {
    hlsVideoRef,
    hlsPhase,
    hlsError,
    hlsStreamActive,
    hlsPlaybackBlocked,
    enableHlsPlayback,
    retryHlsPlayback,
  } = useCloudflareHlsPlayback({
    playbackUrl: archivedPlaybackUrl ?? live?.cloudflarePlaybackUrl,
    // Cloudflare HLS does not depend on browser cameraActive (OBS/RTMP ingest).
    active: !isHost && isCloudflareStream,
  });

  /** Re-emit camera state after socket connect (emitOnSocket is no-op when disconnected). */
  useEffect(() => {
    if (!isHost || !cameraLocalActive) return;
    return onSocketConnect(() => {
      const mode = cameraModeRef.current === 'file' ? 'file' : 'camera';
      emitLiveCameraToggle(liveId, true, mode);
      setLive((prev) =>
        prev ? { ...prev, cameraActive: true, cameraMode: mode } : prev
      );
    });
  }, [isHost, cameraLocalActive, liveId]);

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

  const pendingCameraStartGenRef = useRef(0);

  const releaseHostLiveMedia = useCallback(() => {
    pendingCameraStartGenRef.current += 1;
    clearPendingLiveCameraStart();
    if (hostCameraBroadcastRef.current) {
      emitCameraState(false);
    }
    clearLiveCameraToggleQueue(liveId);
    releaseRelayConnections();
    stopCamera();
  }, [emitCameraState, liveId, releaseRelayConnections, stopCamera]);

  useEffect(() => {
    if (!live || !isHost || cameraLocalActive) return;
    if (!hasPendingLiveCameraStart()) return;
    if (isLiveKitStream) {
      emitCameraState(true, 'camera');
      setLive((prev) => (prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev));
      clearPendingLiveCameraStart();
      return;
    }

    const gen = ++pendingCameraStartGenRef.current;

    emitCameraState(true, 'camera');
    setLive((prev) => (prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev));

    void (async () => {
      const ok = await startCamera();
      if (gen !== pendingCameraStartGenRef.current) return;
      if (ok) {
        clearPendingLiveCameraStart();
        emitCameraState(true, 'camera');
        setLive((prev) => (prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev));
      } else {
        emitCameraState(false);
        setLive((prev) =>
          prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
        );
      }
    })();

    return () => {
      pendingCameraStartGenRef.current += 1;
    };
  }, [live?.id, isHost, cameraLocalActive, startCamera, emitCameraState, isLiveKitStream]);

  useEffect(() => {
    return () => {
      releaseHostLiveMedia();
    };
  }, [liveId, releaseHostLiveMedia]);

  useEffect(() => {
    if (!liveEnded || !isHost) return;
    releaseHostLiveMedia();
  }, [isHost, liveEnded, releaseHostLiveMedia]);

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

  const cameraPausedByHiddenRef = useRef(false);
  const cameraModeBeforeHiddenRef = useRef<'camera' | 'file'>('camera');

  usePauseMediaOnPageHidden({
    onPageHidden: () => {
      if (isHostRef.current && cameraLocalActiveRef.current) {
        cameraModeBeforeHiddenRef.current =
          cameraModeRef.current === 'file' ? 'file' : 'camera';
        stopCamera();
        cameraPausedByHiddenRef.current = true;
      }
    },
    onPageVisible: () => {
      if (!isHostRef.current || !cameraPausedByHiddenRef.current) return;
      cameraPausedByHiddenRef.current = false;
      if (cameraModeBeforeHiddenRef.current === 'file') return;
      void (async () => {
        const ok = await startCamera();
        if (ok) {
          emitCameraState(true, 'camera');
          setLive((prev) =>
            prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev
          );
        }
      })();
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

  const handleVideoExpandedChange = useCallback((expanded: boolean) => {
    if (expanded) {
      if (chatHiddenBeforeExpandRef.current === null) {
        chatHiddenBeforeExpandRef.current = chatHiddenRef.current;
        setChatHidden(true);
      }
      return;
    }
    if (chatHiddenBeforeExpandRef.current === null) return;
    const prev = chatHiddenBeforeExpandRef.current;
    chatHiddenBeforeExpandRef.current = null;
    setChatHidden(prev);
  }, []);

  const openDonSheet = (amount?: number) => {
    setDonInitialAmount(amount);
    setShowDonSheet(true);
  };

  const handleShareLive = async () => {
    const url = `${SOUNDY_BASE_URL}/live/${liveId}`;
    const title = live?.title ?? 'Live Soundy';
    const text = `Rejoins ce live musical sur Soundy !`;
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
    releaseHostLiveMedia();
    emitOnSocket('leave_live', { liveId });
    try {
      await api.stopLive(token);
    } finally {
      onBack();
    }
  };

  const leaveLive = () => {
    emitOnSocket('leave_live', { liveId });
    onBack();
  };

  const toggleHostCamera = async () => {
    if (!live || live.hostId !== user?.id || cameraToggling) return;
    setCameraToggling(true);
    try {
      if (isLiveKitStream) {
        const cameraOn = live.cameraActive && live.cameraMode === 'camera';
        if (cameraOn) {
          emitCameraState(false);
          setLive((prev) =>
            prev ? { ...prev, cameraActive: false, cameraMode: undefined } : prev
          );
        } else {
          emitCameraState(true, 'camera');
          setLive((prev) =>
            prev ? { ...prev, cameraActive: true, cameraMode: 'camera' } : prev
          );
        }
        return;
      }
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

  const onHostMicChange = async (nextDeviceId: string) => {
    if (!isHost || cameraMode !== 'camera' || !cameraLocalActive || micSwitching) return;
    const track = await switchMicrophone(nextDeviceId);
    if (track) await replaceHostTrack(track);
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
        <p className="text-red-400 font-bold text-lg">{t('live.accessDeniedTitle')}</p>
        <p className="text-gray-400 text-sm max-w-md">{liveViewBanMessage ?? t('live.accessDeniedDefault')}</p>
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

  if (liveEnded && isHost) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-4xl">⏱</p>
        <p className="text-white font-bold text-lg">{t('live.streamEnded')}</p>
        <p className="text-gray-400 text-sm max-w-sm">{t('live.streamEndedDuration')}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-full bg-purple-600 text-white font-bold text-sm hover:bg-purple-500"
        >
          {t('live.streamEndedBack')}
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

      {showSubscribeSheet && !isHost && hostCanReceiveDonations && token && live && (
        <CreatorSubscribeSheet
          open={showSubscribeSheet}
          onClose={() => setShowSubscribeSheet(false)}
          token={token}
          userAge={user?.age}
          creatorId={live.hostId}
          creatorName={live.hostName}
          targetType="creator"
          onSuccess={(message) => {
            setSubscribeToast(message);
            window.setTimeout(() => setSubscribeToast(null), 4000);
          }}
        />
      )}

      {subscribeToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-xl bg-purple-950/90 border border-purple-500/40 text-sm text-purple-100 font-medium shadow-lg backdrop-blur text-center">
          {subscribeToast}
        </div>
      )}

      {privateTarget && (
        <LivePrivateSheet
          target={privateTarget}
          onClose={() => setPrivateTarget(null)}
          onOpenProfile={onOpenProfile}
        />
      )}

      {reportLiveOpen && live && (
        <ReportContentModal
          context={{
            targetUserId: live.hostId,
            targetUsername: live.hostName,
            roomType: 'live',
            roomId: live.id,
          }}
          onClose={() => setReportLiveOpen(false)}
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
              <span className="shrink-0">{t('live.liveBadge')}</span>
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
              <span className="shrink-0">· {t('live.viewersCount', { count: viewers })}</span>
              {!isHost && isDevModerator && (
                <span className="shrink-0 text-[10px] font-bold text-cyan-300">· {t('live.devBadge')}</span>
              )}
              {!isHost && isVipModerator && !isDevModerator && (
                <span className="shrink-0 text-[10px] font-bold text-amber-300">· {t('live.vipModBadge')}</span>
              )}
            </p>
            {remainingMs !== null && remainingMs > 0 && (
              <p className={`text-[10px] mt-0.5 ${remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#5a5a7a]'}`}>
                ⏱ {formatRemaining(remainingMs)} restants
              </p>
            )}
          </div>
          {!isHost && (
            <div className="shrink-0 flex items-center flex-wrap gap-1 sm:gap-1.5 max-w-[min(100%,13rem)] sm:max-w-none justify-end">
              {hostCanReceiveDonations && token && (
                <button
                  type="button"
                  onClick={() => openDonSheet()}
                  className="shrink-0 px-2 sm:px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border border-amber-500/35 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60 hover:border-amber-400/50 transition"
                  title={t('live.headerDonate')}
                >
                  <span aria-hidden>🎁</span>
                  <span className="ml-0.5 sm:hidden">{t('live.headerDonateShort')}</span>
                  <span className="ml-0.5 hidden sm:inline">{t('live.headerDonate')}</span>
                </button>
              )}
              {hostCanReceiveDonations && token && (
                <button
                  type="button"
                  onClick={() => setShowSubscribeSheet(true)}
                  className="shrink-0 px-2 sm:px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-bold border border-purple-500/35 bg-purple-950/50 text-purple-200 hover:bg-purple-900/60 hover:border-purple-400/50 transition"
                  title={t('live.headerSubscribe')}
                >
                  <span aria-hidden>⭐</span>
                  <span className="ml-0.5 sm:hidden">{t('live.headerSubscribeShort')}</span>
                  <span className="ml-0.5 hidden sm:inline">{t('live.headerSubscribe')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={leaveLive}
                className="shrink-0 px-2 sm:px-3 py-1.5 bg-[#1a1a26] border border-[#232330] rounded-full text-[10px] sm:text-xs text-gray-300 font-bold hover:text-white hover:border-white/15 transition"
              >
                <span className="sm:hidden">{t('live.leaveLiveShort')}</span>
                <span className="hidden sm:inline">{t('live.leaveLive')}</span>
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
              {showConfigureObsButton && (
                <button
                  type="button"
                  onClick={() => void configureObs()}
                  disabled={cfProvisioning}
                  className="px-2.5 py-1.5 rounded-full text-[10px] font-bold border border-orange-500/40 bg-orange-950/60 text-orange-200 hover:bg-orange-900/70 hover:border-orange-400/50 transition disabled:opacity-50"
                  title="Passer en diffusion OBS via Cloudflare Stream (SoundyUltra)"
                >
                  {cfProvisioning ? '…' : '📡 Configurer OBS'}
                </button>
              )}
              {canSwitchToCloudflare && obsAllowed === false && cloudflareAvailable && (
                <span
                  className="px-2 py-1 rounded-full text-[9px] text-gray-500 border border-[#2d2d3d]"
                  title="Réservé à SoundyUltra"
                >
                  OBS · Ultra
                </span>
              )}
              <button
                type="button"
                onClick={toggleHostCamera}
                disabled={cameraToggling}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition disabled:opacity-50 ${
                  (isLiveKitStream
                    ? live.cameraActive && live.cameraMode === 'camera'
                    : cameraLocalActive && cameraMode === 'camera')
                    ? 'bg-[#0f2018] border-[#1e4030] text-[#70aa88]'
                    : 'bg-[#131318] border-[#232330] text-gray-400 hover:border-white/15'
                }`}
              >
                {cameraToggling
                  ? '…'
                  : (isLiveKitStream
                      ? live.cameraActive && live.cameraMode === 'camera'
                      : cameraLocalActive && cameraMode === 'camera')
                    ? '📹 Caméra on'
                    : '📷 Activer la caméra'}
              </button>
              {cameraLocalActive && cameraMode === 'camera' && audioDevices.length > 0 && (
                <label className="sr-only" htmlFor="live-host-mic-select">
                  Microphone
                </label>
              )}
              {cameraLocalActive && cameraMode === 'camera' && audioDevices.length > 0 && (
                <select
                  id="live-host-mic-select"
                  value={audioDeviceId}
                  disabled={micSwitching || cameraToggling}
                  onChange={(e) => void onHostMicChange(e.target.value)}
                  className="max-w-[7.5rem] px-2 py-1.5 rounded-full text-[10px] font-medium border bg-[#131318] border-[#232330] text-gray-300 hover:border-white/15 disabled:opacity-50 truncate"
                  title="Changer de micro"
                  aria-label="Microphone du live"
                >
                  {audioDevices.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              {micSwitching && (
                <span className="text-[9px] text-gray-500 shrink-0">{LIVE_CAMERA_MIC_SWITCHING}</span>
              )}
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
          {!isHost && live && (
            <button
              type="button"
              onClick={() => setReportLiveOpen(true)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 hover:bg-[#2a2a3a] transition"
              aria-label="Signaler ce live"
              title="Signaler ce live"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleShareLive()}
            title={shareCopied ? t('live.shareLiveCopied') : t('live.shareLiveTitle')}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition"
            aria-label={t('live.shareLive')}
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
      </header>

      <ChatRoomProvider
        roomId={liveId}
        roomType="live"
        userId={user?.id ?? ''}
        userName={user?.username ?? ''}
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
        chatDock="bottom"
        chatHidden={chatHidden}
        onToggleChat={toggleChatHidden}
        chatTitle={t('live.publicChat')}
        chatMinimized={chatMinimized}
        onToggleMinimize={() => setChatMinimized((m) => !m)}
        chatHeaderExtra={
          <>
            {token ? (
              <LiveParticipantsPopover
                liveId={liveId}
                token={token}
                hostId={live.hostId}
                hostName={live.hostName}
                hostUsernameColor={live.hostUsernameColor}
                vipModeratorIds={live.vipModeratorIds ?? []}
                viewersCount={viewers}
                panelAbove
              />
            ) : null}
            {(isHost || isDevModerator) ? (
              <button
                type="button"
                onClick={() => setShowVipPanel((v) => !v)}
                className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-medium border transition ${
                  showVipPanel
                    ? 'bg-[#2a2010] border-[#3a3010] text-[#c8a850]'
                    : 'bg-[#131318] border-[#232330] text-gray-400 hover:border-white/15'
                }`}
                title="Modérateurs VIP"
                aria-expanded={showVipPanel}
              >
                ⭐ VIP
              </button>
            ) : null}
          </>
        }
        stage={
          isLiveKitStream && token ? (
            <LiveKitVideoStage
              liveId={liveId}
              authToken={token}
              isHost={isHost}
              publishActive={!!(isHost && live.cameraActive && live.cameraMode === 'camera')}
              liveCameraActive={!!live.cameraActive}
              liveCameraMode={live.cameraMode}
              playbackTitle={live.playbackState.title}
              playbackArtist={live.playbackState.artist}
              albumArtUrl={live.playbackState.albumArtUrl}
              initialTheater={initialTheater}
              onExpandedChange={handleVideoExpandedChange}
              onFullscreenError={setCameraToast}
              streamEnded={viewerStreamEnded}
              streamEndedTitle={streamEndedTitle}
              streamEndedHint={streamEndedHint}
              overlay={
                !isHost && hostCanReceiveDonations && !viewerStreamEnded ? (
                  <LiveGiftOverlay liveId={liveId} visible onOpenGiftSheet={openDonSheet} />
                ) : null
              }
            />
          ) : (
          <LiveVideoStage
            isHost={isHost}
            streamMode={live.streamMode === 'cloudflare' ? 'cloudflare' : 'webrtc'}
            hostVideoRef={videoRef}
            viewerVideoRef={isCloudflareStream && !isHost ? hlsVideoRef : viewerVideoRef}
            hostStreamActive={cameraLocalActive}
            hostCameraMode={cameraMode}
            liveCameraActive={!!live.cameraActive}
            liveCameraMode={live.cameraMode}
            viewerStreamActive={isCloudflareStream ? hlsStreamActive : viewerStreamActive}
            viewerRelayPhase={viewerRelayPhase}
            viewerRelayError={viewerRelayError}
            viewerPlaybackBlocked={
              isCloudflareStream ? hlsPlaybackBlocked : viewerPlaybackBlocked
            }
            viewerAudioBlocked={isCloudflareStream ? false : viewerAudioBlocked}
            viewerHasVideoTrack={isCloudflareStream ? true : viewerHasVideoTrack}
            viewerDebugInfo={viewerDebugInfo}
            hlsStreamActive={hlsStreamActive}
            hlsPhase={hlsPhase}
            hlsError={hlsError}
            hlsPlaybackBlocked={hlsPlaybackBlocked}
            enableViewerPlayback={
              isCloudflareStream && !isHost ? enableHlsPlayback : enableViewerPlayback
            }
            onRetryViewerRelay={!isHost && !isCloudflareStream ? retryViewerRelay : undefined}
            onRetryHlsPlayback={!isHost && isCloudflareStream ? retryHlsPlayback : undefined}
            hostPreviewBlocked={hostPreviewBlocked}
            enableHostPreview={enableHostPreview}
            playbackTitle={live.playbackState.title}
            playbackArtist={live.playbackState.artist}
            albumArtUrl={live.playbackState.albumArtUrl}
            initialTheater={initialTheater}
            onExpandedChange={handleVideoExpandedChange}
            onFullscreenError={setCameraToast}
            streamEnded={viewerStreamEnded}
            streamEndedTitle={streamEndedTitle}
            streamEndedHint={streamEndedHint}
            videoFloat={livePipActive ? livePip : undefined}
            onPipOpen={!isHost ? () => setLivePipActive(true) : undefined}
            overlay={
              <>
                {isHost && isCloudflareStream && token ? (
                  <LiveCloudflareHostPanel
                    token={token}
                    liveId={liveId}
                    expanded={showCfHostPanel}
                    onToggle={() => setShowCfHostPanel((v) => !v)}
                  />
                ) : null}
                {!isHost && hostCanReceiveDonations && !viewerStreamEnded ? (
                  <LiveGiftOverlay liveId={liveId} visible onOpenGiftSheet={openDonSheet} />
                ) : null}
              </>
            }
          />
          )
        }
        chat={
          <div className="flex flex-col h-full min-h-0">
            {(isHost || isDevModerator) && showVipPanel && (
              <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 mx-2 mt-2">
                <p className="text-xs font-bold text-amber-300 mb-2">{t('live.vipModerators')}</p>
                {vipEntries.length === 0 ? (
                  <p className="text-[11px] text-gray-500 mb-2">{t('live.noVipModerators')}</p>
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
                          {t('live.removeVip')} VIP
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
                  <p className="text-[11px] text-gray-500">{t('live.addModeratorFromChat')}</p>
                )}
              </div>
            )}
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
