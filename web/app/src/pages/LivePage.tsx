import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { useLiveCamera } from '../hooks/useLiveCamera';
import { usePauseMediaOnPageHidden, pauseMediaElements } from '../hooks/usePauseMediaOnPageHidden';
import { useBackgroundPlayback } from '../hooks/useBackgroundPlayback';
import { releaseAppMediaFocus, requestAppMediaFocus } from '../lib/appMediaFocus';
import { api, ApiRequestError } from '../lib/api';
import {
  liveStreamEndedHintKey,
  type LiveStreamEndedReason,
} from '../lib/liveCameraMessages';
import type { LiveVideoResolutionPreset } from '../lib/liveVideoResolution';
import type { LiveVideoAspectRatioPreset } from '../lib/liveVideoAspectRatio';
import { getLiveVideoAspectRatioPreset } from '../lib/liveVideoAspectRatio';
import { emitLiveCameraToggle, clearLiveCameraToggleQueue } from '../lib/liveCameraSocket';
import { useLiveVideoRelay } from '../hooks/useLiveVideoRelay';
import { useCloudflareHlsPlayback } from '../hooks/useCloudflareHlsPlayback';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';
import { setActiveHostLiveId } from '../lib/liveHostContext';
import {
  clearHostSessionDraftFromPrefs,
  clearUseObsFromPrefs,
  clearLiveChatConfigFromPrefs,
  clearPendingLiveCameraStart,
  getLiveMediaPrefs,
  hasPendingLiveCameraStart,
  setLiveMediaPrefs,
} from '../lib/liveMediaPrefs';
import {
  clampLiveVideoDelaySeconds,
  getLiveVideoDelaySeconds,
  type LiveVideoDelayPreset,
} from '../lib/liveVideoDelay';
import { releaseLiveCameraHandoff } from '../lib/liveCameraHandoff';
import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { LivePrivateSheet } from '../components/LivePrivateSheet';
import { LiveHostPanel, type LiveHostPanelDonSubTab, type LiveHostPanelTab } from '../components/LiveHostPanel';
import { LiveHostTopBar } from '../components/LiveHostTopBar';
import {
  LiveHostCamToggleButton,
  LiveHostMicToggleButton,
  LiveHostQuickBar,
  StopLiveButton,
} from '../components/LiveHostQuickBar';
import { LiveRewardRequestsStrip } from '../components/LiveRewardRequestsStrip';
import { LiveVideoGoalOverlay } from '../components/LiveVideoGoalOverlay';
import { useLiveHostSession } from '../hooks/useLiveHostSession';
import { firstActiveGoal, activePublicGoals, withGoalProgress, type GoalProgressStats } from '../lib/liveGoalProgress';
import { enqueueRewardFromGift, patchLiveHostSession } from '../lib/liveHostSession';
import { syncLiveDonationGoals, syncLiveDonationOptions } from '../lib/liveDonationOptions';
import { LiveDonationSheet } from '../components/LiveDonationSheet';
import { FollowUserButton } from '../components/FollowUserButton';
import { LiveGiftOverlay } from '../components/LiveGiftOverlay';
import { LiveViewerRewardsStrip } from '../components/LiveViewerRewardsStrip';
import { LiveParticipantsPopover } from '../components/LiveParticipantsPopover';
import { LiveHostActionsPopover } from '../components/LiveHostActionsPopover';
import { LiveVipModeratorsPopover } from '../components/LiveVipModeratorsPopover';
import { ShareLinkMenu } from '../components/ShareLinkMenu';
import { ShareToUserSheet } from '../components/ShareToUserSheet';
import { LiveVideoStage } from '../components/LiveVideoStage';
import { LiveKitVideoStage } from '../components/LiveKitVideoStage';
import { ReportContentModal } from '../components/ReportContentModal';
import { useDraggableVideoPip, defaultVideoPipPos } from '../components/DraggableVideoPip';
import {
  consumeLiveMinimizePipPending,
  getLiveVideoFloatActive,
  getLiveViewerPlaybackPaused,
  setLiveVideoFloatActive,
  subscribeLiveVideoFloat,
  subscribeLiveViewerPlaybackPaused,
  toggleLiveViewerPlaybackPaused,
} from '../lib/liveVideoFloat';
import type { ChatMessage, DmContact, Live, AppNotification, PlaybackState } from '../types';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';

const SOUNDY_BASE_URL = 'https://getsoundy.com';
const LIVE_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

const LIVE_CHAT_HIDDEN_KEY = 'melosong_live_chat_hidden';

function readLiveChatPinned(): boolean {
  return getStorageItem(STORAGE_KEYS.liveChatPinned) === '1';
}

function readFullscreenChatOverlay(): boolean {
  const stored = getStorageItem(STORAGE_KEYS.liveChatVideoOverlay);
  if (stored === '0') return false;
  return true;
}

export function LivePage({
  liveId,
  onBack,
  onMinimize,
  onLeaveLive,
  onLiveTitleLoaded,
  onOpenProfile,
  liveFullScreen = true,
  initialTheater = false,
  onRestoreFullScreen,
}: {
  liveId: string;
  onBack: () => void;
  /** Retour / changement d'onglet sans quitter le live (PiP persistant). */
  onMinimize?: () => void;
  /** Quitter définitivement le live (leave_live + fin de session). */
  onLeaveLive?: () => void;
  onLiveTitleLoaded?: (title?: string) => void;
  onOpenProfile?: (userId: string) => void;
  /** Grand live plein écran vs session minimisée (PiP flottant). */
  liveFullScreen?: boolean;
  /** Réouvre l'overlay live plein écran (ex. ancrage PiP). */
  onRestoreFullScreen?: () => void;
  /** Ouvre directement en mode plein écran CSS (theater) dès le premier rendu. */
  initialTheater?: boolean;
}) {
  const { user, token, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [live, setLive] = useState<Live | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [chatHidden, setChatHidden] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatPinned, setChatPinned] = useState(readLiveChatPinned);
  const [fullscreenChatOverlay, setFullscreenChatOverlay] = useState(readFullscreenChatOverlay);
  const [privateTarget, setPrivateTarget] = useState<DmContact | null>(null);
  const [showDonSheet, setShowDonSheet] = useState(false);
  const [reportLiveOpen, setReportLiveOpen] = useState(false);
  const [donInitialAmount, setDonInitialAmount] = useState<number | undefined>();
  const [donToast, setDonToast] = useState<string | null>(null);
  const [hostDonToast, setHostDonToast] = useState<string | null>(null);
  const [cameraToast, setCameraToast] = useState<string | null>(null);
  const [cameraToggling, setCameraToggling] = useState(false);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hostPanelTab, setHostPanelTab] = useState<LiveHostPanelTab>('dashboard');
  const [hostPanelDonSubTab, setHostPanelDonSubTab] = useState<LiveHostPanelDonSubTab>('goals');
  const [liveStartedAt] = useState(() => Date.now());
  const [hostTotalDonations, setHostTotalDonations] = useState(0);
  const [hostDonationCount, setHostDonationCount] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [goalTick, setGoalTick] = useState(() => Date.now());
  const [hostFollowing, setHostFollowing] = useState(false);
  const { session: hostSession } = useLiveHostSession(liveId);
  const [cfProvisioning, setCfProvisioning] = useState(false);
  const [cloudflareAvailable, setCloudflareAvailable] = useState<boolean | null>(null);
  const [obsAllowed, setObsAllowed] = useState<boolean | null>(null);
  const [obsIngestLive, setObsIngestLive] = useState(false);
  const [chatBanned, setChatBanned] = useState(false);
  const [chatBanMessage, setChatBanMessage] = useState<string | null>(null);
  const [chatBanUntil, setChatBanUntil] = useState<number | null>(null);
  const [liveViewBanned, setLiveViewBanned] = useState(false);
  const [liveViewBanMessage, setLiveViewBanMessage] = useState<string | null>(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [streamEndedReason, setStreamEndedReason] = useState<LiveStreamEndedReason | null>(null);
  const [archivedPlaybackUrl, setArchivedPlaybackUrl] = useState<string | null>(null);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [livePipActive, setLivePipActiveState] = useState(getLiveVideoFloatActive);
  const livePipActiveRef = useRef(livePipActive);
  livePipActiveRef.current = livePipActive;
  const setLivePipActive = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const prev = livePipActiveRef.current;
    const next = typeof value === 'function' ? value(prev) : value;
    if (next === prev) return;
    setLiveVideoFloatActive(next);
    setLivePipActiveState(next);
  }, []);
  const anchorLivePip = useCallback(() => {
    setLivePipActive(false);
    if (!liveFullScreen) {
      onRestoreFullScreen?.();
    }
  }, [liveFullScreen, onRestoreFullScreen, setLivePipActive]);
  const livePip = useDraggableVideoPip(livePipActive, anchorLivePip, defaultVideoPipPos);
  const [viewerPlaybackPaused, setViewerPlaybackPausedState] = useState(getLiveViewerPlaybackPaused);
  const toggleViewerPlaybackPaused = useCallback(() => {
    toggleLiveViewerPlaybackPaused();
  }, []);
  useEffect(
    () =>
      subscribeLiveViewerPlaybackPaused(() => {
        setViewerPlaybackPausedState(getLiveViewerPlaybackPaused());
      }),
    []
  );
  const leavingLiveRef = useRef(false);
  /** OBS a déjà diffusé au moins une fois durant ce live (auto-stop Soundy si RTMP coupé). */
  const obsWasLiveRef = useRef(false);
  const obsDisconnectPollsRef = useRef(0);
  const obsAutoStopTriggeredRef = useRef(false);
  const stopLiveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(
    () =>
      subscribeLiveVideoFloat(() => {
        const next = getLiveVideoFloatActive();
        setLivePipActiveState((prev) => (prev === next ? prev : next));
      }),
    []
  );

  useEffect(() => {
    if (liveFullScreen) {
      setLivePipActive(false);
    }
  }, [liveId, liveFullScreen, setLivePipActive]);

  /** Réduction live plein écran → PiP vidéo persistant jusqu'à « Quitter le live ». */
  useEffect(() => {
    if (liveFullScreen) return;
    if (!consumeLiveMinimizePipPending()) return;
    setLivePipActive(true);
  }, [liveFullScreen, setLivePipActive]);

  const handleMinimize = onMinimize ?? onBack;
  const handleLeaveLive = useCallback(() => {
    leavingLiveRef.current = true;
    emitOnSocket('leave_live', { liveId });
    if (onLeaveLive) {
      onLeaveLive();
    } else {
      onBack();
    }
  }, [liveId, onBack, onLeaveLive]);
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
    videoDevices,
    audioDeviceId,
    videoDeviceId,
  videoResolution,
  videoAspectRatio,
  micSwitching,
    camSwitching,
    switchMicrophone,
    switchCamera,
    refreshMediaDevices,
    updateMediaDevicePrefs,
    previewBlocked: hostPreviewBlocked,
    enableHostPreview,
  } = useLiveCamera();
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoFileLoading, setVideoFileLoading] = useState(false);
  const chatHiddenBeforeExpandRef = useRef<boolean | null>(null);
  const chatHiddenBeforePipRef = useRef<boolean | null>(null);
  const chatHiddenRef = useRef(chatHidden);
  chatHiddenRef.current = chatHidden;

  /** PiP flottant : masquer FloatingSalonChat (enfant de `.live-video-container`) pour
   * qu'il ne s'affiche pas dans la fenêtre PiP ; restaurer à l'ancrage. */
  const hideChatForLivePip = useCallback(() => {
    if (chatHiddenBeforePipRef.current === null) {
      chatHiddenBeforePipRef.current = chatHiddenRef.current;
    }
    if (!chatHiddenRef.current) {
      setChatHidden(true);
    }
  }, []);

  const openLivePip = useCallback(() => {
    hideChatForLivePip();
    setLivePipActive(true);
  }, [hideChatForLivePip, setLivePipActive]);

  useEffect(() => {
    if (livePipActive) {
      hideChatForLivePip();
      return;
    }
    if (chatHiddenBeforePipRef.current === null) return;
    const prev = chatHiddenBeforePipRef.current;
    chatHiddenBeforePipRef.current = null;
    setChatHidden(prev);
  }, [livePipActive, hideChatForLivePip]);

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
    if (!shareToast) return;
    const id = window.setTimeout(() => setShareToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [shareToast]);

  useEffect(() => {
    if (!token) return;
    setArchivedPlaybackUrl(null);
    api
      .getLive(token, liveId)
      .then(async (r) => {
        setLive(r.live);
        setViewers(r.live.viewersCount);
        onLiveTitleLoaded?.(r.live.title);
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
  }, [liveId, token, user?.id, onLiveTitleLoaded]);

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
            tipsEnabled: l.tipsEnabled ?? prev?.tipsEnabled,
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
    socket.on('salon_playback', onPlayback);
    socket.on('live_join_denied', onJoinDenied);
    return () => {
      offReconnect();
      socket.off('live_updated', onUpdate);
      socket.off('salon_playback', onPlayback);
      socket.off('live_join_denied', onJoinDenied);
    };
  }, [liveId, user?.id]);

  useEffect(() => {
    setStreamEndedReason(null);
    setLiveEnded(false);
    obsWasLiveRef.current = false;
    obsDisconnectPollsRef.current = 0;
    obsAutoStopTriggeredRef.current = false;
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
        leavingLiveRef.current = true;
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

  /** Spectateurs : cadre vidéo = format hôte (live_updated), pas les prefs caméra locales. */
  const stageVideoAspectRatio = useMemo(
    () =>
      isHost
        ? videoAspectRatio
        : getLiveVideoAspectRatioPreset(live?.videoAspectRatio),
    [isHost, videoAspectRatio, live?.videoAspectRatio]
  );

  const viewerDonationOptions = useMemo(
    () => live?.donationOptions?.filter((o) => o.label?.trim() && o.amount >= 1 && o.amount <= 100) ?? [],
    [live?.donationOptions]
  );

  useEffect(() => {
    if (!token || !live?.hostId || isHost) {
      setHostFollowing(false);
      return;
    }
    let cancelled = false;
    api
      .getMyFollowing(token)
      .then((r) => {
        if (!cancelled) setHostFollowing(r.followingIds.includes(live.hostId));
      })
      .catch(() => {
        if (!cancelled) setHostFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, live?.hostId, isHost]);

  useEffect(() => {
    if (!isHost || !liveId || !live?.isActive) return;
    syncLiveDonationOptions(liveId, hostSession.rewards);
    syncLiveDonationGoals(liveId, hostSession.goals);
  }, [isHost, liveId, live?.isActive, hostSession.rewards, hostSession.goals]);

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

  const goalStats: GoalProgressStats = useMemo(
    () => ({
      totalDonations: hostTotalDonations,
      donationCount: hostDonationCount,
      viewers,
      startedAt: live?.startedAt ?? liveStartedAt,
      now: goalTick,
    }),
    [hostTotalDonations, hostDonationCount, viewers, live?.startedAt, liveStartedAt, goalTick],
  );

  const viewerActiveGoals = useMemo(
    () =>
      !isHost && live?.donationGoals?.length
        ? activePublicGoals(live.donationGoals, goalStats, liveId)
        : [],
    [isHost, live?.donationGoals, goalStats, liveId],
  );

  const activeGoal = useMemo(
    () => (isHost ? firstActiveGoal(hostSession.goals, goalStats, liveId) : null),
    [isHost, hostSession.goals, goalStats, liveId],
  );

  useEffect(() => {
    const id = window.setInterval(() => setGoalTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isHost || hostSession.goals.length === 0) return;
    let changed = false;
    const nextGoals = hostSession.goals.map((g) => {
      const progressed = withGoalProgress(g, goalStats);
      if (
        progressed.completedAt !== g.completedAt ||
        Math.abs(progressed.current - g.current) > 0.001
      ) {
        changed = true;
        return progressed;
      }
      return g;
    });
    if (changed) patchLiveHostSession(liveId, { goals: nextGoals });
  }, [isHost, hostSession.goals, goalStats, liveId]);

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

  useEffect(() => {
    if (!token || !liveId || !isCloudflareStream || !live?.isActive) {
      setObsIngestLive(false);
      return;
    }
    let cancelled = false;
    const poll = () => {
      api
        .getCloudflareStreamStatus(token, liveId)
        .then((status) => {
          if (cancelled) return;
          setObsIngestLive(status.live);
          if (isHost) {
            if (status.live) {
              obsWasLiveRef.current = true;
              obsDisconnectPollsRef.current = 0;
            } else if (
              obsWasLiveRef.current &&
              !obsAutoStopTriggeredRef.current &&
              !leavingLiveRef.current
            ) {
              obsDisconnectPollsRef.current += 1;
              // 2 polls consécutifs (~4 s) pour éviter un faux positif réseau.
              if (obsDisconnectPollsRef.current >= 2) {
                obsAutoStopTriggeredRef.current = true;
                void stopLiveRef.current();
              }
            }
          }
          if (status.playbackUrl) {
            setLive((prev) => {
              if (!prev || prev.id !== liveId) return prev;
              if (
                prev.cloudflarePlaybackUrl === status.playbackUrl &&
                prev.cloudflareLiveInputId === status.liveInputId
              ) {
                return prev;
              }
              return {
                ...prev,
                cloudflarePlaybackUrl: status.playbackUrl,
                cloudflareLiveInputId: status.liveInputId,
              };
            });
          }
        })
        .catch(() => {
          if (!cancelled) setObsIngestLive(false);
        });
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, liveId, isCloudflareStream, live?.isActive, isHost]);

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
        tipsEnabled: res.live.tipsEnabled ?? prev?.tipsEnabled,
      }));
      setShowHostPanel(true);
      setHostPanelTab('config');
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
    // HLS CDN : hôte OBS + spectateurs (pas de caméra navigateur requise).
    active: isCloudflareStream,
    obsIngestLive,
    viewerDelaySeconds: getLiveVideoDelaySeconds(live?.videoDelaySeconds),
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

  const hostCanReceiveDonations =
    live?.hostMonetizationEligible !== false && live?.tipsEnabled !== false;

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
    const onGift = (gift: {
      liveId: string;
      senderName: string;
      senderId?: string;
      amount?: number;
      note?: string;
    }) => {
      if (gift.liveId !== liveId || !gift.amount) return;
      setHostTotalDonations((prev) => prev + gift.amount!);
      setHostDonationCount((prev) => prev + 1);
      enqueueRewardFromGift(liveId, gift);
    };
    socket.on('notification', onNotif);
    socket.on('gift_animation', onGift);
    return () => {
      socket.off('notification', onNotif);
      socket.off('gift_animation', onGift);
    };
  }, [liveId, user?.id, isHost]);

  const pendingCameraStartGenRef = useRef(0);

  const releaseHostLiveMedia = useCallback(() => {
    pendingCameraStartGenRef.current += 1;
    clearPendingLiveCameraStart();
    releaseLiveCameraHandoff();
    if (hostCameraBroadcastRef.current) {
      emitCameraState(false);
    }
    clearLiveCameraToggleQueue(liveId);
    releaseRelayConnections();
    stopCamera();
  }, [emitCameraState, liveId, releaseRelayConnections, stopCamera]);

  useEffect(() => {
    if (!live || !isHost || !live.isActive) return;
    const chatConfig = getLiveMediaPrefs()?.chatConfig;
    if (!chatConfig) return;

    const applyChatConfig = () => {
      emitOnSocket('live_update_config', { liveId: live.id, config: chatConfig });
      clearLiveChatConfigFromPrefs();
    };

    const socket = getSocket();
    if (socket?.connected) {
      applyChatConfig();
    } else {
      return onSocketConnect(applyChatConfig);
    }
  }, [live?.id, live?.isActive, isHost]);

  useEffect(() => {
    if (!live || !isHost || !live.isActive) return;
    const aspect = getLiveVideoAspectRatioPreset(
      getLiveMediaPrefs()?.videoAspectRatio ?? videoAspectRatio
    );
    if (live.videoAspectRatio === aspect) return;

    const applyAspect = () => {
      emitOnSocket('live_update_media_config', {
        liveId: live.id,
        config: { videoAspectRatio: aspect },
      });
      setLive((prev) => (prev ? { ...prev, videoAspectRatio: aspect } : prev));
    };

    const socket = getSocket();
    if (socket?.connected) {
      applyAspect();
    } else {
      return onSocketConnect(applyAspect);
    }
  }, [live?.id, live?.isActive, live?.videoAspectRatio, isHost, videoAspectRatio]);

  useEffect(() => {
    if (!live || !isHost || !live.isActive) return;
    const delay = getLiveMediaPrefs()?.videoDelaySeconds;
    if (delay === undefined || delay <= 0) return;
    if (getLiveVideoDelaySeconds(live.videoDelaySeconds) === delay) return;

    const applyVideoDelay = () => {
      emitOnSocket('live_update_media_config', {
        liveId: live.id,
        config: { videoDelaySeconds: delay },
      });
    };

    const socket = getSocket();
    if (socket?.connected) {
      applyVideoDelay();
    } else {
      return onSocketConnect(applyVideoDelay);
    }
  }, [live?.id, live?.isActive, live?.videoDelaySeconds, isHost]);

  useEffect(() => {
    if (!live || !isHost || !live.isActive) return;
    const sessionDraft = getLiveMediaPrefs()?.hostSessionDraft;
    if (!sessionDraft) return;

    patchLiveHostSession(live.id, {
      goals: sessionDraft.goals.map((g) => ({
        ...g,
        liveId: live.id,
        current: 0,
        createdAt: Date.now(),
      })),
      rewards: sessionDraft.rewards,
    });
    clearHostSessionDraftFromPrefs();
  }, [live?.id, live?.isActive, isHost]);

  useEffect(() => {
    if (!live || !isHost || !live.isActive) return;
    if (!getLiveMediaPrefs()?.useObs) return;
    if (live.streamMode === 'cloudflare') {
      setShowHostPanel(true);
      setHostPanelTab('config');
    }
    clearUseObsFromPrefs();
  }, [live?.id, live?.isActive, live?.streamMode, isHost]);

  useEffect(() => {
    if (!live || !isHost || cameraLocalActive) return;
    if (isCloudflareStream) {
      clearPendingLiveCameraStart();
      return;
    }
    if (!hasPendingLiveCameraStart()) return;
    if (getLiveMediaPrefs()?.demoNoMedia) {
      clearPendingLiveCameraStart();
      return;
    }
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
  }, [live?.id, isHost, cameraLocalActive, startCamera, emitCameraState, isLiveKitStream, isCloudflareStream]);

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

  const handleShareLive = () => {
    setShowShareMenu(true);
  };

  const liveShareUrl = `${SOUNDY_BASE_URL}/live/${liveId}`;
  const liveShareTitle = live?.title ?? t('live.shareLiveTitle', { defaultValue: 'Live Soundy' });
  const liveShareText = t('live.shareLiveText', {
    defaultValue: 'Rejoins ce live musical sur Soundy !',
  });

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

  const toggleFloatingChatFromChrome = useCallback(() => {
    if (chatHidden) {
      setChatHidden(false);
      setChatMinimized(false);
      try {
        localStorage.setItem(LIVE_CHAT_HIDDEN_KEY, '0');
      } catch {
        /* ignore */
      }
      return;
    }
    if (chatMinimized) {
      setChatMinimized(false);
      return;
    }
    setChatHidden(true);
    try {
      localStorage.setItem(LIVE_CHAT_HIDDEN_KEY, '1');
    } catch {
      /* ignore */
    }
  }, [chatHidden, chatMinimized]);

  const toggleChatPin = useCallback(() => {
    setChatPinned((prev) => {
      const next = !prev;
      setStorageItem(STORAGE_KEYS.liveChatPinned, next ? '1' : '0');
      if (next) {
        setChatHidden(false);
        setChatMinimized(false);
        try {
          localStorage.setItem(LIVE_CHAT_HIDDEN_KEY, '0');
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const toggleFullscreenChatOverlay = useCallback(() => {
    setFullscreenChatOverlay((prev) => {
      const next = !prev;
      setStorageItem(STORAGE_KEYS.liveChatVideoOverlay, next ? '1' : '0');
      return next;
    });
  }, []);

  const stopLive = async () => {
    if (!token || live?.hostId !== user?.id) return;
    releaseHostLiveMedia();
    leavingLiveRef.current = true;
    emitOnSocket('leave_live', { liveId });
    try {
      await api.stopLive(token);
    } finally {
      // Sans ce refresh, `user.isLive`/`user.liveId` (côté client) restent périmés :
      // App.tsx retombe dessus comme fallback pour la carte (chip "en haut à droite" +
      // pastille live) même après que activeLiveViewerSession soit nettoyé par
      // onLeaveLive/onBack ci-dessous — le live continue donc d'apparaître comme actif.
      void refreshUser();
      if (onLeaveLive) onLeaveLive();
      else onBack();
    }
  };
  stopLiveRef.current = stopLive;

  const leaveLive = () => {
    handleLeaveLive();
  };

  const toggleHostMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      broadcastStream?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, [broadcastStream]);

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
    if (!isHost || micSwitching) return;
    updateMediaDevicePrefs({ audioDeviceId: nextDeviceId });
    if (isLiveKitStream) return;
    if (cameraMode !== 'camera' || !cameraLocalActive) return;
    const track = await switchMicrophone(nextDeviceId);
    if (track) await replaceHostTrack(track);
  };

  const onHostCameraChange = async (nextDeviceId: string) => {
    if (!isHost || camSwitching) return;
    updateMediaDevicePrefs({ videoDeviceId: nextDeviceId });
    if (isLiveKitStream) return;
    if (cameraMode !== 'camera' || !cameraLocalActive) return;
    const track = await switchCamera(nextDeviceId);
    if (track) await replaceHostTrack(track);
  };

  const onHostResolutionChange = async (preset: LiveVideoResolutionPreset) => {
    if (!isHost) return;
    updateMediaDevicePrefs({ videoResolution: preset });
    if (isLiveKitStream) return;
    if (cameraMode !== 'camera' || !cameraLocalActive) return;
    stopCamera();
    await startCamera();
  };

  const onHostAspectRatioChange = async (preset: LiveVideoAspectRatioPreset) => {
    if (!isHost || !liveId) return;
    updateMediaDevicePrefs({ videoAspectRatio: preset });
    setLive((prev) => (prev ? { ...prev, videoAspectRatio: preset } : prev));
    emitOnSocket('live_update_media_config', {
      liveId,
      config: { videoAspectRatio: preset },
    });
    if (isLiveKitStream) return;
    if (cameraMode !== 'camera' || !cameraLocalActive) return;
    stopCamera();
    await startCamera();
  };

  const onHostVideoDelayChange = useCallback(
    (seconds: LiveVideoDelayPreset) => {
      if (!isHost || !liveId) return;
      const clamped = clampLiveVideoDelaySeconds(seconds);
      const prefs = getLiveMediaPrefs();
      setLiveMediaPrefs({ ...prefs, videoDelaySeconds: clamped });
      setLive((prev) => (prev ? { ...prev, videoDelaySeconds: clamped } : prev));
      emitOnSocket('live_update_media_config', {
        liveId,
        config: { videoDelaySeconds: clamped },
      });
    },
    [isHost, liveId]
  );

  const onBoardMenuOpen = useCallback(() => {
    void refreshMediaDevices().catch(() => {
      // Permission refusée ou périphériques non disponibles — l'interface
      // affiche déjà un message "Autorisez caméra et micro" si les listes sont vides.
    });
  }, [refreshMediaDevices]);

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

  const openHostPanel = useCallback(
    (tab: LiveHostPanelTab = 'dashboard', donSubTab: LiveHostPanelDonSubTab = 'goals') => {
      setHostPanelTab(tab);
      if (tab === 'don') setHostPanelDonSubTab(donSubTab);
      setShowHostPanel(true);
    },
    []
  );

  const hostActionsChrome = useMemo(
    () =>
      isHost ? (
        <LiveHostActionsPopover
          liveId={liveId}
          goalStats={goalStats}
          variant="theater-chrome"
          onOpenDonPanel={(subTab) => openHostPanel('don', subTab)}
        />
      ) : null,
    [isHost, liveId, goalStats, openHostPanel],
  );

  const hostVideoOverlay =
    isHost && !viewerStreamEnded ? (
      <>
        {activeGoal ? <LiveVideoGoalOverlay goal={activeGoal} /> : null}
        <LiveRewardRequestsStrip
          items={hostSession.rewardQueue}
          onOpenPanel={() => openHostPanel('don', 'rewards')}
        />
        <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 pointer-events-auto max-w-[calc(100%-5.5rem)] sm:max-w-none">
          <LiveHostMicToggleButton muted={micMuted} onToggle={toggleHostMic} />
          <LiveHostCamToggleButton
            active={
              live
                ? isLiveKitStream
                  ? !!(live.cameraActive && live.cameraMode === 'camera')
                  : cameraLocalActive && cameraMode === 'camera'
                : false
            }
            disabled={cameraToggling || videoFileLoading}
            onToggle={() => void toggleHostCamera()}
          />
          <StopLiveButton compact onStop={() => void stopLive()} />
          <button
            type="button"
            onClick={() => openHostPanel('config')}
            className="flex items-center justify-center w-11 h-11 rounded-lg bg-black/70 border border-white/20 text-white text-lg backdrop-blur hover:bg-black/85 hover:border-purple-500/40 active:scale-95 transition"
            aria-label={t('live.hostDockSettings')}
            title={t('live.hostDockSettings')}
          >
            <span aria-hidden>⚙</span>
          </button>
        </div>
      </>
    ) : null;

  if (liveViewBanned) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-red-400 font-bold text-lg">{t('live.accessDeniedTitle')}</p>
        <p className="text-gray-400 text-sm max-w-md">{liveViewBanMessage ?? t('live.accessDeniedDefault')}</p>
        <button
          type="button"
          onClick={handleLeaveLive}
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
          onClick={handleLeaveLive}
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

  const hostMediaSettings = isHost
    ? {
        videoDevices,
        audioDevices,
        videoDeviceId,
        audioDeviceId,
        videoResolution,
        videoAspectRatio: stageVideoAspectRatio,
        videoDelaySeconds: getLiveVideoDelaySeconds(
          live?.videoDelaySeconds ?? getLiveMediaPrefs()?.videoDelaySeconds
        ),
        cameraMode,
        cameraActive: isLiveKitStream
          ? !!(live.cameraActive && live.cameraMode === 'camera')
          : cameraLocalActive && cameraMode === 'camera',
        camSwitching,
        micSwitching,
        cameraToggling,
        onCameraChange: (id: string) => void onHostCameraChange(id),
        onMicChange: (id: string) => void onHostMicChange(id),
        onResolutionChange: (preset: LiveVideoResolutionPreset) => void onHostResolutionChange(preset),
        onAspectRatioChange: (preset: LiveVideoAspectRatioPreset) => void onHostAspectRatioChange(preset),
        onVideoDelayChange: onHostVideoDelayChange,
        onRefreshDevices: () => void onBoardMenuOpen(),
      }
    : undefined;

  const hostQuickBarProps = {
    cameraActive: isLiveKitStream
      ? !!(live.cameraActive && live.cameraMode === 'camera')
      : cameraLocalActive && cameraMode === 'camera',
    cameraToggling,
    videoFileLoading,
    onToggleCamera: toggleHostCamera,
    onPickVideo: () => videoFileInputRef.current?.click(),
    micMuted,
    onToggleMic: toggleHostMic,
    showObs: showConfigureObsButton,
    cfProvisioning,
    onConfigureObs: () => void configureObs(),
    obsUltraOnly: !!(canSwitchToCloudflare && obsAllowed === false && cloudflareAvailable),
    queueCount: 0,
    onOpenRewards: () => openHostPanel('don'),
    goalPercent: activeGoal
      ? Math.min(100, Math.round((activeGoal.current / activeGoal.target) * 100))
      : null,
    onOpenGoals: () => openHostPanel('don'),
    onStop: () => void stopLive(),
    onOpenDashboard: () => openHostPanel('dashboard'),
    onBoardMenuOpen,
  };

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
          hostAvatarUrl={live.hostAvatarUrl}
          token={token}
          userAge={user?.age}
          initialAmount={donInitialAmount}
          hostDonationOptions={viewerDonationOptions}
          activeGoals={viewerActiveGoals}
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

      {/* ── Header redesigné ── */}
      <div className="live-viewer-chrome shrink-0">
      <LiveHostTopBar
        title={live.title}
        viewers={viewers}
        remainingMs={remainingMs}
        onBack={handleMinimize}
        onShare={handleShareLive}
        hostControls={
          isHost ? <LiveHostQuickBar {...hostQuickBarProps} variant="header" /> : undefined
        }
        trailing={
          !isHost && live ? (
            <button
              type="button"
              onClick={() => setReportLiveOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 hover:bg-[#1a1a26] transition"
              aria-label="Signaler ce live"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
              </svg>
            </button>
          ) : undefined
        }
      />

      {/* Bande 2 : Actions auditeur (non-hôte) */}
      {!isHost && live && (
        <div className="live-viewer-action-bar shrink-0 relative z-30 flex items-center justify-between gap-2 w-full min-w-0 px-3 py-2 min-h-[3.25rem] border-b border-[#1e1e2f] bg-[#0b0b0f]">
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
            {token && (
              <button
                type="button"
                onClick={() => hostCanReceiveDonations && openDonSheet()}
                disabled={!hostCanReceiveDonations}
                title={
                  hostCanReceiveDonations
                    ? t('live.headerDonate')
                    : t('live.donationsHostNotConfigured', {
                        defaultValue: "L'hôte n'a pas configuré les dons",
                      })
                }
                aria-label={
                  hostCanReceiveDonations
                    ? t('live.headerDonate')
                    : t('live.donationsHostNotConfigured', {
                        defaultValue: "L'hôte n'a pas configuré les dons",
                      })
                }
                aria-disabled={!hostCanReceiveDonations}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition min-h-11 shrink-0 ${
                  hostCanReceiveDonations
                    ? 'border-amber-500/35 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                    : 'border-[#2d2d3d]/80 bg-[#14141c]/80 text-gray-500 opacity-50 pointer-events-none cursor-not-allowed'
                }`}
              >
                <span aria-hidden>🎁</span>
                <span className="sm:hidden">{t('live.headerDonateShort')}</span>
                <span className="hidden sm:inline">{t('live.headerDonate')}</span>
              </button>
            )}
            {token && (
              <FollowUserButton
                userId={live.hostId}
                username={live.hostName}
                initialFollowing={hostFollowing}
                compact
                iconStyle="heart"
                className="shrink-0"
                onFollowingChange={setHostFollowing}
              />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {token && !chatPinned && chatHidden ? (
              <>
                <LiveParticipantsPopover
                  liveId={liveId}
                  token={token}
                  hostId={live.hostId}
                  hostName={live.hostName}
                  hostUsernameColor={live.hostUsernameColor}
                  vipModeratorIds={live.vipModeratorIds ?? []}
                  viewersCount={viewers}
                />
                <LiveVipModeratorsPopover
                  vipEntries={vipEntries}
                  chatParticipants={chatParticipants}
                  onSetVip={setVipModerator}
                  canManage={isDevModerator}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={leaveLive}
              className="flex items-center px-3 py-1.5 bg-[#1a1a26] border border-[#232330] rounded-full text-xs text-gray-300 font-bold hover:text-white transition min-h-11 shrink-0"
            >
              <span className="sm:hidden">{t('live.leaveLiveShort')}</span>
              <span className="hidden sm:inline">{t('live.leaveLive')}</span>
            </button>
          </div>
        </div>
      )}
      </div>

      {!isHost && hostCanReceiveDonations && viewerDonationOptions.length > 0 && (
        <LiveViewerRewardsStrip
          options={viewerDonationOptions}
          onSelect={(amount) => openDonSheet(amount)}
          disabled={!token}
        />
      )}

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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <RoomTheaterLayout
        chatDock={chatPinned ? 'left' : 'floating'}
        allowFloatingChat={false}
        liveTheaterChrome
        chatPinned={chatPinned}
        onToggleChatPin={toggleChatPin}
        chatHidden={chatHidden}
        onToggleChat={toggleChatHidden}
        chatTitle={t('live.publicChat')}
        chatMinimized={chatMinimized}
        onToggleMinimize={() => setChatMinimized((m) => !m)}
        stageFooter={isHost ? (
          <>
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov,.m4v"
              className="sr-only"
              aria-hidden
              onChange={(e) => void onPickVideoFile(e)}
            />
          </>
        ) : undefined}
        chatHeaderTrailingExtra={
          isHost ? (
            <LiveHostActionsPopover
              liveId={liveId}
              goalStats={goalStats}
              onOpenDonPanel={(subTab) => openHostPanel('don', subTab)}
            />
          ) : undefined
        }
        chatHeaderExtra={
          token && live ? (
            <>
              <LiveParticipantsPopover
                liveId={liveId}
                token={token}
                hostId={live.hostId}
                hostName={live.hostName}
                hostUsernameColor={live.hostUsernameColor}
                vipModeratorIds={live.vipModeratorIds ?? []}
                viewersCount={viewers}
              />
              <LiveVipModeratorsPopover
                vipEntries={vipEntries}
                chatParticipants={chatParticipants}
                onSetVip={setVipModerator}
                canManage={isHost || isDevModerator}
              />
            </>
          ) : null
        }
        stage={
          isLiveKitStream && token ? (
            <LiveKitVideoStage
              liveId={liveId}
              authToken={token}
              isHost={isHost}
              publishActive={!!(isHost && live.cameraActive && live.cameraMode === 'camera')}
              micEnabled={!micMuted}
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
              videoDeviceId={videoDeviceId || undefined}
              audioDeviceId={audioDeviceId || undefined}
              videoResolution={videoResolution}
              videoAspectRatio={stageVideoAspectRatio}
              chatVisible={!chatHidden}
              onToggleFloatingChat={toggleFloatingChatFromChrome}
              fullscreenChatOverlayVisible={fullscreenChatOverlay}
              onToggleFullscreenChatOverlay={toggleFullscreenChatOverlay}
              viewerPlaybackPaused={!isHost ? viewerPlaybackPaused : undefined}
              onToggleViewerPlaybackPaused={!isHost ? toggleViewerPlaybackPaused : undefined}
              videoFloat={livePipActive ? livePip : undefined}
              onPipOpen={!isHost ? openLivePip : undefined}
              hostActionsChrome={hostActionsChrome}
              overlay={
                !isHost && !viewerStreamEnded ? (
                  <>
                    {hostCanReceiveDonations && !livePipActive && (
                      <LiveGiftOverlay liveId={liveId} visible />
                    )}
                  </>
                ) : (
                  hostVideoOverlay
                )
              }
            />
          ) : (
          <LiveVideoStage
            isHost={isHost}
            streamMode={live.streamMode === 'cloudflare' ? 'cloudflare' : 'webrtc'}
            hostVideoRef={videoRef}
            viewerVideoRef={isCloudflareStream ? hlsVideoRef : viewerVideoRef}
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
            cloudflareObsConnected={obsIngestLive}
            enableViewerPlayback={
              isCloudflareStream ? enableHlsPlayback : enableViewerPlayback
            }
            onRetryViewerRelay={!isHost && !isCloudflareStream ? retryViewerRelay : undefined}
            onRetryHlsPlayback={isCloudflareStream ? retryHlsPlayback : undefined}
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
            videoAspectRatio={stageVideoAspectRatio}
            chatVisible={!chatHidden}
            onToggleFloatingChat={toggleFloatingChatFromChrome}
            fullscreenChatOverlayVisible={fullscreenChatOverlay}
            onToggleFullscreenChatOverlay={toggleFullscreenChatOverlay}
            viewerPlaybackPaused={!isHost ? viewerPlaybackPaused : undefined}
            onToggleViewerPlaybackPaused={!isHost ? toggleViewerPlaybackPaused : undefined}
            videoFloat={livePipActive ? livePip : undefined}
            onPipOpen={!isHost ? openLivePip : undefined}
            hostActionsChrome={hostActionsChrome}
            overlay={
              <>
                {hostVideoOverlay}
                {!isHost && hostCanReceiveDonations && !viewerStreamEnded && !livePipActive ? (
                  <LiveGiftOverlay liveId={liveId} visible />
                ) : null}
              </>
            }
          />
          )
        }
        chat={
          <div className="flex flex-col h-full min-h-0">
            <ChatMessagesView />
          </div>
        }
        chatInput={<ChatInputBar />}
      />
        <ChatModals />
      </div>
      </ChatRoomProvider>

      {isHost && showHostPanel && (
        <LiveHostPanel
          liveId={liveId}
          viewers={viewers}
          totalDonations={hostTotalDonations}
          donationCount={hostDonationCount}
          liveStartedAt={liveStartedAt}
          initialTab={hostPanelTab}
          initialDonSubTab={hostPanelDonSubTab}
          chatConfig={live?.chatConfig}
          token={token}
          isCloudflareStream={isCloudflareStream}
          isLiveKitStream={isLiveKitStream}
          obsIngestLive={obsIngestLive}
          hostMediaSettings={hostMediaSettings}
          user={user}
          onUserUpdated={() => void refreshUser()}
          onClose={() => setShowHostPanel(false)}
        />
      )}

      {showShareMenu && !shareToUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setShowShareMenu(false)}
          url={liveShareUrl}
          title={liveShareTitle}
          text={liveShareText}
          onToast={setShareToast}
          onSendToUser={token ? () => setShareToUserOpen(true) : undefined}
        />
      )}

      {showShareMenu && shareToUserOpen && token && (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setShowShareMenu(false);
          }}
          token={token}
          shareUrl={liveShareUrl}
          shareText={liveShareText}
          onToast={setShareToast}
        />
      )}

      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
            {shareToast}
          </div>
        </div>
      )}
    </div>
  );
}
