import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent, Track, type RoomOptions } from 'livekit-client';
import { VIDEO_PIP_WIDTH, VIDEO_PIP_HEADER_HEIGHT, type VideoPipFloatApi } from './DraggableVideoPip';
import {
  buildLiveKitAudioCaptureOptions,
  buildLiveKitVideoCaptureOptions,
  getLiveVideoResolutionPreset,
  type LiveVideoResolutionPreset,
} from '../lib/liveVideoResolution';
import {
  getLiveVideoAspectRatioClass,
  getLiveVideoAspectRatioCss,
  getLiveStackWidthRatioCss,
  getLiveVideoAspectRatioPreset,
  type LiveVideoAspectRatioPreset,
} from '../lib/liveVideoAspectRatio';
import { normalizeBrandText } from '../lib/brandName';
import { api } from '../lib/api';
import { LiveStreamEndedOverlay } from './LiveStreamEndedOverlay';
import { LiveChatVideoOverlay } from './LiveChatVideoOverlay';
import { LiveVideoUnavailableOverlay } from './LiveVideoUnavailableOverlay';
import {
  LiveTheaterLiveBadge,
  LiveVideoStageOverlayLeaveButton,
  LiveVideoStagePlaceholder,
} from './LiveVideoStagePlaceholder';
import { LiveTheaterStatusBar, LiveVideoChromeButton } from './LiveVideoTheaterChrome';
import { useLiveVideoChromeAutoHide } from '../hooks/useLiveVideoChromeAutoHide';
import {
  LIVE_CAMERA_HOST_LIVEKIT_START,
  LIVE_CAMERA_RECONNECTING,
  LIVE_CAMERA_VIEWER_FILE_NOTE,
  LIVE_CAMERA_VIEWER_LIVEKIT_CONNECTING,
  LIVE_CAMERA_VIEWER_LIVEKIT_ERROR,
  LIVE_CAMERA_VIEWER_LIVEKIT_NO_HOST_CAMERA,
  LIVE_CAMERA_VIEWER_LIVEKIT_WAITING,
  shouldShowTheaterStatusBar,
} from '../lib/liveCameraMessages';

const LIVEKIT_VIDEO_WAIT_TIMEOUT_MS = 30_000;

const LIVEKIT_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
};

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
  const webkit = (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
    .webkitRequestFullscreen;
  if (webkit) await webkit.call(el);
}

async function exitDocumentFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  const webkit = (document as Document & { webkitExitFullscreen?: () => Promise<void> })
    .webkitExitFullscreen;
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

function LiveVideoChatIcon({ active }: { active?: boolean }) {
  return (
    <svg
      aria-hidden
      className={`w-4 h-4 shrink-0${active ? ' text-purple-300' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12c0 4.418-4.03 8-9 8-1.28 0-2.5-.23-3.6-.65L3 20l1.05-3.15C3.39 15.6 3 13.85 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
    </svg>
  );
}

function LiveVideoPauseIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function LiveVideoPlayIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function LiveVideoPipIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="12" y="10" width="8" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.7" />
    </svg>
  );
}

const LIVEKIT_VIDEO_CLASS =
  'lk-live-stage-video absolute inset-0 w-full h-full object-cover object-center bg-black z-10';

type LiveKitSession = {
  token: string;
  serverUrl: string;
  roomName: string;
  canPublish: boolean;
};

function LiveKitHostPublisher({
  publishActive,
  micEnabled,
  videoDeviceId,
  audioDeviceId,
  videoResolution,
  videoAspectRatio,
  onPublishChange,
  onError,
}: {
  publishActive: boolean;
  micEnabled: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
  videoResolution: LiveVideoResolutionPreset;
  videoAspectRatio: LiveVideoAspectRatioPreset;
  onPublishChange: (active: boolean) => void;
  onError: (message: string) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localCamera = tracks.find(
    (t) => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera
  );

  const syncMedia = useCallback(async () => {
    const videoOptions = buildLiveKitVideoCaptureOptions(
      videoResolution,
      videoDeviceId,
      videoAspectRatio
    );
    const audioOptions = buildLiveKitAudioCaptureOptions(audioDeviceId);
    await localParticipant.setCameraEnabled(publishActive, videoOptions);
    await localParticipant.setMicrophoneEnabled(micEnabled, audioOptions);
  }, [
    audioDeviceId,
    localParticipant,
    micEnabled,
    publishActive,
    videoDeviceId,
    videoResolution,
    videoAspectRatio,
  ]);

  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;
    let cancelled = false;

    const runPublish = async () => {
      try {
        await syncMedia();
        if (!cancelled) onPublishChange(publishActive);
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Impossible d’activer la caméra.');
          onPublishChange(false);
        }
      }
    };

    void runPublish();

    const onSignalConnected = () => {
      if (cancelled) return;
      void runPublish();
    };
    room.on(RoomEvent.SignalConnected, onSignalConnected);

    return () => {
      cancelled = true;
      room.off(RoomEvent.SignalConnected, onSignalConnected);
    };
  }, [publishActive, micEnabled, videoDeviceId, audioDeviceId, videoResolution, videoAspectRatio, room, syncMedia, onPublishChange, onError]);

  if (!localCamera?.publication?.track) return null;
  return (
    <VideoTrack
      trackRef={localCamera}
      autoPlay
      playsInline
      className={LIVEKIT_VIDEO_CLASS}
    />
  );
}

function LiveKitViewerSubscriber({
  liveCameraActive,
  liveCameraMode,
  onStreamActive,
}: {
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  onStreamActive: (active: boolean) => void;
}) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remoteCamera = tracks.find(
    (t) =>
      !t.participant.isLocal &&
      t.source === Track.Source.Camera &&
      t.publication &&
      !t.publication.isMuted &&
      (t.publication.track ?? t.publication.isSubscribed)
  );

  useEffect(() => {
    onStreamActive(Boolean(remoteCamera?.publication?.track));
  }, [remoteCamera, onStreamActive]);

  if (!liveCameraActive || liveCameraMode === 'file') return null;
  if (!remoteCamera?.publication?.track) return null;

  return (
    <>
      <VideoTrack
        trackRef={remoteCamera}
        autoPlay
        playsInline
        className={LIVEKIT_VIDEO_CLASS}
      />
      <RoomAudioRenderer />
    </>
  );
}

function LiveKitRoomInner({
  isHost,
  publishActive,
  micEnabled,
  videoDeviceId,
  audioDeviceId,
  videoResolution,
  videoAspectRatio,
  liveCameraActive,
  liveCameraMode,
  onHostStreamActive,
  onViewerStreamActive,
  onError,
  onConnectionStateChange,
}: {
  isHost: boolean;
  publishActive: boolean;
  micEnabled: boolean;
  videoDeviceId?: string;
  audioDeviceId?: string;
  videoResolution: LiveVideoResolutionPreset;
  videoAspectRatio: LiveVideoAspectRatioPreset;
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  onHostStreamActive: (active: boolean) => void;
  onViewerStreamActive: (active: boolean) => void;
  onError: (message: string) => void;
  /** Audit Low #12 — surface `Reconnecting` (backoff auto géré par le SDK) dans l'UI. */
  onConnectionStateChange: (state: ConnectionState) => void;
}) {
  const connectionState = useConnectionState();

  useEffect(() => {
    onConnectionStateChange(connectionState);
  }, [connectionState, onConnectionStateChange]);

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      onHostStreamActive(false);
      onViewerStreamActive(false);
    }
  }, [connectionState, onHostStreamActive, onViewerStreamActive]);

  if (connectionState === ConnectionState.Connecting) {
    return null;
  }

  if (isHost) {
    return (
      <LiveKitHostPublisher
        publishActive={publishActive}
        micEnabled={micEnabled}
        videoDeviceId={videoDeviceId}
        audioDeviceId={audioDeviceId}
        videoResolution={videoResolution}
        videoAspectRatio={videoAspectRatio}
        onPublishChange={onHostStreamActive}
        onError={onError}
      />
    );
  }

  return (
    <LiveKitViewerSubscriber
      liveCameraActive={liveCameraActive}
      liveCameraMode={liveCameraMode}
      onStreamActive={onViewerStreamActive}
    />
  );
}

export type LiveKitVideoStageProps = {
  liveId: string;
  authToken: string;
  isHost: boolean;
  publishActive: boolean;
  /** Micro hôte activé (LiveKit setMicrophoneEnabled). */
  micEnabled?: boolean;
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  playbackTitle: string;
  playbackArtist: string;
  albumArtUrl?: string;
  initialTheater?: boolean;
  /** Called when fullscreen / landscape theater expands or collapses. */
  onExpandedChange?: (expanded: boolean) => void;
  onFullscreenError?: (message: string) => void;
  overlay?: ReactNode;
  enabled?: boolean;
  streamEnded?: boolean;
  streamEndedTitle?: string;
  streamEndedHint?: string;
  videoDeviceId?: string;
  audioDeviceId?: string;
  videoResolution?: LiveVideoResolutionPreset;
  videoAspectRatio?: LiveVideoAspectRatioPreset;
  /** Chat flottant interactif (FloatingSalonChat) — rendu dans `.live-video-container` en live théâtre. */
  floatingChat?: ReactNode;
  chatVisible?: boolean;
  onToggleFloatingChat?: () => void;
  fullscreenChatOverlayVisible?: boolean;
  onToggleFullscreenChatOverlay?: () => void;
  viewerPlaybackPaused?: boolean;
  onToggleViewerPlaybackPaused?: () => void;
  /** PiP flottant in-app : vidéo seule déplaçable, toujours au premier plan. */
  videoFloat?: VideoPipFloatApi;
  /** Fermer le PiP sans rouvrir le live plein écran. */
  onDismissPip?: () => void;
  /** Appelé quand l'utilisateur clique sur ⤢ pour activer le PiP. */
  onPipOpen?: () => void;
  /** Bouton « Actions à faire » hôte (chrome théâtre, après plein écran). */
  hostActionsChrome?: ReactNode;
  /** Spectateur : quitter le live depuis le placeholder théâtre. */
  onLeaveLive?: () => void;
};

export function LiveKitVideoStage({
  liveId,
  authToken,
  isHost,
  publishActive,
  micEnabled = true,
  liveCameraActive,
  liveCameraMode,
  playbackTitle,
  playbackArtist,
  albumArtUrl,
  initialTheater = false,
  onExpandedChange,
  overlay,
  enabled = true,
  streamEnded = false,
  streamEndedTitle = 'Stream terminé',
  streamEndedHint,
  videoDeviceId,
  audioDeviceId,
  videoResolution: videoResolutionProp,
  videoAspectRatio: videoAspectRatioProp,
  floatingChat,
  chatVisible = false,
  onToggleFloatingChat,
  fullscreenChatOverlayVisible = false,
  onToggleFullscreenChatOverlay,
  viewerPlaybackPaused = false,
  onToggleViewerPlaybackPaused,
  videoFloat,
  onDismissPip,
  onPipOpen,
  hostActionsChrome,
  onLeaveLive,
}: LiveKitVideoStageProps) {
  const videoResolution = getLiveVideoResolutionPreset(videoResolutionProp);
  const videoAspectRatio = getLiveVideoAspectRatioPreset(videoAspectRatioProp);
  const displayPlaybackTitle = normalizeBrandText(playbackTitle);
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(initialTheater);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const expandedRef = useRef(false);
  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;
  const { chromeVisible } = useLiveVideoChromeAutoHide(stageAreaRef, enabled && !videoFloat);

  const placeholderLeaveAction =
    !isHost && onLeaveLive && !videoFloat ? (
      <LiveVideoStageOverlayLeaveButton
        onClick={onLeaveLive}
        label={t('live.leaveLive')}
        shortLabel={t('live.leaveLiveShort')}
      />
    ) : undefined;
  const [session, setSession] = useState<LiveKitSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostStreamActive, setHostStreamActive] = useState(false);
  const [viewerStreamActive, setViewerStreamActive] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [videoTimedOut, setVideoTimedOut] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fetchGenRef = useRef(0);

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setIsReconnecting(state === ConnectionState.Reconnecting);
  }, []);

  useEffect(() => {
    if (!enabled || !authToken) return;
    const gen = ++fetchGenRef.current;
    setLoadError(null);
    setSession(null);
    setVideoTimedOut(false);
    setIsReconnecting(false);

    void (async () => {
      try {
        const res = await api.getLiveKitToken(authToken, liveId);
        if (gen !== fetchGenRef.current) return;
        setSession({
          token: res.token,
          serverUrl: res.serverUrl,
          roomName: res.roomName,
          canPublish: res.canPublish,
        });
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setLoadError(
          err instanceof Error ? err.message : LIVE_CAMERA_VIEWER_LIVEKIT_ERROR
        );
      }
    })();

    return () => {
      fetchGenRef.current += 1;
    };
  }, [authToken, enabled, liveId]);

  const handleRoomError = useCallback((err: Error) => {
    setRoomError(err.message || LIVE_CAMERA_VIEWER_LIVEKIT_ERROR);
  }, []);

  const handlePublishError = useCallback((message: string) => {
    setRoomError(message);
    setHostStreamActive(false);
  }, []);

  const retryToken = useCallback(() => {
    fetchGenRef.current += 1;
    setLoadError(null);
    setRoomError(null);
    setVideoTimedOut(false);
    setIsReconnecting(false);
    setSession(null);
    const gen = fetchGenRef.current;
    void (async () => {
      try {
        const res = await api.getLiveKitToken(authToken, liveId);
        if (gen !== fetchGenRef.current) return;
        setSession({
          token: res.token,
          serverUrl: res.serverUrl,
          roomName: res.roomName,
          canPublish: res.canPublish,
        });
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        setLoadError(
          err instanceof Error ? err.message : LIVE_CAMERA_VIEWER_LIVEKIT_ERROR
        );
      }
    })();
  }, [authToken, liveId]);

  const roomEnabled = enabled && !streamEnded;

  const showVideo = !streamEnded && (isHost ? hostStreamActive : viewerStreamActive);

  const waitingForVideo =
    !streamEnded &&
    !loadError &&
    !roomError &&
    !videoTimedOut &&
    !!session &&
    (isHost
      ? publishActive && !hostStreamActive
      : liveCameraActive && liveCameraMode !== 'file' && !viewerStreamActive);

  useEffect(() => {
    if (!waitingForVideo) {
      setVideoTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setVideoTimedOut(true), LIVEKIT_VIDEO_WAIT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [waitingForVideo]);

  useEffect(() => {
    const next = isVideoExpanded;
    if (expandedRef.current !== next) {
      expandedRef.current = next;
      onExpandedChange?.(next);
    }
  }, [isVideoExpanded, onExpandedChange]);

  useEffect(() => {
    const syncFullscreen = () => {
      const inNative = getFullscreenElement() === containerRef.current;
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

  const enterTheaterFallback = useCallback(() => {
    setIsLandscapeTheater(true);
  }, []);

  const enterVideoFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    onExpandedChange?.(true);
    if (!FULLSCREEN_SUPPORTED) {
      enterTheaterFallback();
      return;
    }
    void requestElementFullscreen(el).catch(() => {
      enterTheaterFallback();
    });
  }, [enterTheaterFallback, onExpandedChange]);

  const exitVideoFullscreen = useCallback(() => {
    if (isLandscapeTheater) {
      landscapeAutoActiveRef.current = false;
      landscapeAutoDismissedRef.current = true;
      setIsLandscapeTheater(false);
      return;
    }
    if (landscapeAutoActiveRef.current) {
      landscapeAutoActiveRef.current = false;
      landscapeAutoDismissedRef.current = true;
    }
    void exitDocumentFullscreen();
  }, [isLandscapeTheater]);

  useEffect(() => {
    if (!enabled) return;

    const enterLandscapeAuto = async () => {
      if (landscapeAutoActiveRef.current || landscapeAutoDismissedRef.current) return;
      landscapeAutoActiveRef.current = true;

      const el = containerRef.current;
      if (el && FULLSCREEN_SUPPORTED) {
        try {
          await requestElementFullscreen(el);
          setIsLandscapeTheater(false);
          return;
        } catch {
          /* iOS / PWA fallback */
        }
      }
      setIsLandscapeTheater(true);
    };

    const exitLandscapeAuto = async () => {
      if (!landscapeAutoActiveRef.current) return;
      landscapeAutoActiveRef.current = false;
      setIsLandscapeTheater(false);
      if (getFullscreenElement() === containerRef.current) {
        try {
          await exitDocumentFullscreen();
        } catch {
          /* best effort */
        }
      }
    };

    const applyOrientation = () => {
      if (shouldAutoLandscapeVideo()) {
        void enterLandscapeAuto();
      } else {
        landscapeAutoDismissedRef.current = false;
        void exitLandscapeAuto();
      }
    };

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
  }, [enabled]);

  useEffect(() => {
    if (!isVideoExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitVideoFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isVideoExpanded, exitVideoFullscreen]);

  useEffect(() => {
    if (!isLandscapeTheater) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isLandscapeTheater]);

  useEffect(() => {
    if (isHost || !onToggleViewerPlaybackPaused) return;
    const videos = containerRef.current?.querySelectorAll('video');
    if (!videos?.length) return;
    videos.forEach((video) => {
      if (viewerPlaybackPaused) {
        video.pause();
      } else if (showVideo) {
        void video.play().catch(() => {});
      }
    });
  }, [isHost, viewerPlaybackPaused, showVideo, onToggleViewerPlaybackPaused]);

  const stageState: 'loading' | 'live' | 'no-camera' | 'error' | 'ended' | 'reconnecting' = (() => {
    if (streamEnded) return 'ended';
    if (loadError || roomError || videoTimedOut) return 'error';
    if (!session) return 'loading';
    // Reconnecting a un statut dédié même si une frame vidéo figée reste affichée —
    // le SDK LiveKit gère le retry/backoff automatiquement, on ne fait ici que
    // rendre cet état visible côté UI (audit Low #12).
    if (isReconnecting) return 'reconnecting';
    if (isHost) {
      return publishActive && hostStreamActive ? 'live' : publishActive ? 'loading' : 'no-camera';
    }
    if (!liveCameraActive || liveCameraMode === 'file') return 'no-camera';
    return showVideo ? 'live' : 'loading';
  })();

  const videoErrorTitle = videoTimedOut
    ? t('live.videoUnavailable')
    : (loadError ?? roomError ?? LIVE_CAMERA_VIEWER_LIVEKIT_ERROR);
  const videoErrorHint = videoTimedOut ? t('live.videoUnavailableHint') : undefined;

  const status = (() => {
    if (streamEnded) return streamEndedTitle;
    if (stageState === 'error') return videoErrorTitle;
    if (stageState === 'reconnecting') return LIVE_CAMERA_RECONNECTING;
    if (!session) return LIVE_CAMERA_VIEWER_LIVEKIT_CONNECTING;
    if (isHost) {
      if (hostStreamActive) return 'Caméra active — diffusion LiveKit';
      if (publishActive) return 'Activation de la caméra…';
      return LIVE_CAMERA_HOST_LIVEKIT_START;
    }
    if (!liveCameraActive) return LIVE_CAMERA_VIEWER_LIVEKIT_NO_HOST_CAMERA;
    if (liveCameraMode === 'file') return LIVE_CAMERA_VIEWER_FILE_NOTE;
    if (stageState === 'live') return 'Vidéo en direct (LiveKit)';
    return LIVE_CAMERA_VIEWER_LIVEKIT_WAITING;
  })();

  const retryActions = (
    <>
      <button
        type="button"
        onClick={retryToken}
        className="px-4 py-2 rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white"
      >
        {t('live.retryVideo')}
      </button>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-full text-xs font-bold bg-[#1a1a26] border border-white/15 text-gray-200 hover:text-white"
      >
        {t('live.refreshPage')}
      </button>
    </>
  );

  const VIDEO_PIP_VIDEO_HEIGHT = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
  const pipContainerStyle: CSSProperties | undefined = videoFloat
    ? {
        position: 'fixed',
        zIndex: 99999,
        left: videoFloat.position.x,
        top: videoFloat.position.y,
        width: VIDEO_PIP_WIDTH,
        height: VIDEO_PIP_HEADER_HEIGHT + VIDEO_PIP_VIDEO_HEIGHT,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }
    : undefined;

  const shouldPortalPip = Boolean(videoFloat && typeof document !== 'undefined');

  const videoContainer = (
    <div
      ref={containerRef}
      data-live-viewer={!isHost ? 'true' : undefined}
      data-live-host={isHost ? 'true' : undefined}
      className={`live-video-container live-video-container--theater ${getLiveVideoAspectRatioClass(videoAspectRatio)} relative w-full h-full min-h-0 flex flex-col overflow-hidden${
        isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
      }${videoFloat ? ' live-video-pip-float pointer-events-auto' : ''}`}
      style={{
        ...pipContainerStyle,
        ['--live-aspect-ratio' as string]: getLiveVideoAspectRatioCss(videoAspectRatio),
        ['--live-stack-width-ratio' as string]: getLiveStackWidthRatioCss(videoAspectRatio),
      }}
    >
      {/* Draggable PiP header — shown only when floating */}
      {videoFloat && (
        <div
          className="live-video-pip__header shrink-0 flex items-center gap-1.5 px-2 border-b border-[#2a2a36] bg-[#14141c]/95 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ height: VIDEO_PIP_HEADER_HEIGHT }}
          onPointerDown={videoFloat.onHeaderPointerDown}
        >
          <span className="text-[10px] text-purple-400/80 leading-none shrink-0" aria-hidden>
            ⠿
          </span>
          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex-1 truncate min-w-0">
            {displayPlaybackTitle}
          </p>
          {!isHost && onToggleViewerPlaybackPaused ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleViewerPlaybackPaused}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition"
              title={viewerPlaybackPaused ? t('live.viewerResumePlayback') : t('live.viewerPausePlayback')}
              aria-label={viewerPlaybackPaused ? t('live.viewerResumePlayback') : t('live.viewerPausePlayback')}
            >
              {viewerPlaybackPaused ? <LiveVideoPlayIcon /> : <LiveVideoPauseIcon />}
            </button>
          ) : null}
          {(!isHost && onLeaveLive) || onDismissPip ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={!isHost && onLeaveLive ? onLeaveLive : onDismissPip!}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-red-500/25 transition text-sm leading-none"
              title={!isHost && onLeaveLive ? t('live.leaveLive') : t('live.closePip')}
              aria-label={!isHost && onLeaveLive ? t('live.leaveLive') : t('live.closePip')}
            >
              ×
            </button>
          ) : null}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={videoFloat.onClose}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
            title={t('live.anchorVideoPip')}
            aria-label={t('live.anchorVideoPip')}
          >
            &#x2199;
          </button>
        </div>
      )}

      <div className="live-theater-stage-stack flex flex-col flex-1 min-h-0 min-w-0 w-full h-full">
        <div className="live-theater-hero-wrap flex flex-col min-w-0 w-full h-full min-h-0 shrink-0">
          <div className="live-theater-hero flex flex-col min-w-0 w-full flex-1 min-h-0">
            <div className="live-theater-hero__frame relative min-w-0 w-full flex-1 min-h-0">
              <div ref={stageAreaRef} className="live-video-stage-area absolute inset-0 w-full h-full">
        {session && roomEnabled ? (
          <LiveKitRoom
            serverUrl={session.serverUrl}
            token={session.token}
            connect={roomEnabled}
            audio={false}
            video={false}
            options={LIVEKIT_ROOM_OPTIONS}
            onError={handleRoomError}
            className="absolute inset-0 w-full h-full"
          >
            <LiveKitRoomInner
              isHost={isHost}
              publishActive={publishActive}
              micEnabled={micEnabled}
              videoDeviceId={videoDeviceId}
              audioDeviceId={audioDeviceId}
              videoResolution={videoResolution}
              videoAspectRatio={videoAspectRatio}
              liveCameraActive={liveCameraActive}
              liveCameraMode={liveCameraMode}
              onHostStreamActive={setHostStreamActive}
              onViewerStreamActive={setViewerStreamActive}
              onError={handlePublishError}
              onConnectionStateChange={handleConnectionStateChange}
            />
          </LiveKitRoom>
        ) : null}

        {streamEnded ? (
          <LiveStreamEndedOverlay title={streamEndedTitle} hint={streamEndedHint} />
        ) : null}

        {!showVideo && !streamEnded && stageState !== 'error' && (
          <LiveVideoStagePlaceholder
            title={displayPlaybackTitle}
            artist={playbackArtist}
            albumArtUrl={albumArtUrl}
            loading={stageState === 'loading'}
            badge={stageState === 'loading' ? <LiveTheaterLiveBadge /> : undefined}
            topTrailing={placeholderLeaveAction}
          />
        )}

        {!streamEnded && stageState === 'error' ? (
          <LiveVideoUnavailableOverlay
            title={videoErrorTitle}
            hint={videoErrorHint}
            actions={retryActions}
          />
        ) : null}

        {overlay}

        {!videoFloat && (
        <div
          className={`absolute top-2 left-2 z-30 flex items-center gap-1.5 transition-opacity duration-300 ease-out ${
            chromeVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {isVideoExpanded ? (
            <LiveVideoChromeButton onClick={exitVideoFullscreen} ariaLabel={t('live.exitFullscreen')}>
              <LiveVideoShrinkIcon />
              <span className="hidden sm:inline">{t('live.exitFullscreen')}</span>
            </LiveVideoChromeButton>
          ) : (
            <LiveVideoChromeButton onClick={enterVideoFullscreen} ariaLabel={t('live.enterFullscreen')}>
              <LiveVideoExpandIcon />
              <span className="hidden sm:inline">{t('live.enterFullscreen')}</span>
            </LiveVideoChromeButton>
          )}
          {isHost && hostActionsChrome ? hostActionsChrome : null}
          {onPipOpen && !isVideoExpanded && (
            <LiveVideoChromeButton onClick={onPipOpen} ariaLabel="Détacher en PiP" title="Détacher la vidéo (PiP)">
              <LiveVideoPipIcon />
            </LiveVideoChromeButton>
          )}
          {onToggleFloatingChat ? (
            <LiveVideoChromeButton
              onClick={onToggleFloatingChat}
              ariaLabel={chatVisible ? t('live.hideChat', { defaultValue: 'Masquer le chat' }) : t('live.showChat', { defaultValue: 'Afficher le chat' })}
              title={chatVisible ? t('live.hideChat', { defaultValue: 'Masquer le chat' }) : t('live.showChat', { defaultValue: 'Afficher le chat' })}
              className={chatVisible ? 'ring-2 ring-purple-400/60' : ''}
            >
              <LiveVideoChatIcon active={chatVisible} />
            </LiveVideoChromeButton>
          ) : isVideoExpanded && onToggleFullscreenChatOverlay ? (
            <LiveVideoChromeButton
              onClick={onToggleFullscreenChatOverlay}
              ariaLabel={
                fullscreenChatOverlayVisible
                  ? t('live.hideChat', { defaultValue: 'Masquer le chat' })
                  : t('live.showChatOverlay', { defaultValue: 'Afficher le chat sur la vidéo' })
              }
              title={
                fullscreenChatOverlayVisible
                  ? t('live.hideChat', { defaultValue: 'Masquer le chat' })
                  : t('live.showChatOverlay', { defaultValue: 'Afficher le chat sur la vidéo' })
              }
              className={fullscreenChatOverlayVisible ? 'ring-2 ring-purple-400/60' : ''}
            >
              <LiveVideoChatIcon active={fullscreenChatOverlayVisible} />
            </LiveVideoChromeButton>
          ) : null}
          {!isHost && onToggleViewerPlaybackPaused ? (
            <LiveVideoChromeButton
              onClick={onToggleViewerPlaybackPaused}
              ariaLabel={
                viewerPlaybackPaused ? t('live.viewerResumePlayback') : t('live.viewerPausePlayback')
              }
              title={
                viewerPlaybackPaused ? t('live.viewerResumePlayback') : t('live.viewerPausePlayback')
              }
              className={viewerPlaybackPaused ? 'ring-2 ring-amber-400/60' : ''}
            >
              {viewerPlaybackPaused ? <LiveVideoPlayIcon /> : <LiveVideoPauseIcon />}
            </LiveVideoChromeButton>
          ) : null}
        </div>
        )}
      </div>
            </div>
          </div>
        </div>
      </div>

      {/*
        MODIF 937 — le shell chat + la status bar DOIVENT être des enfants DIRECTS de
        `.live-video-container` (pas de `.live-theater-stage-stack`). En mode théâtre
        (`--theater`), `.live-theater-stage-stack` est volontairement rétréci en
        `height: auto` pour épouser le ratio de la vidéo (letterbox), donc tout enfant
        `position:absolute; inset:0` placé À L'INTÉRIEUR de stage-stack se retrouve
        confiné à la zone vidéo lettrboxée au lieu de couvrir tout le viewport
        plein écran — c'était la cause du chat invisible/mal positionné en plein écran
        malgré MODIF 930 et MODIF 935.
      */}
      {!videoFloat && floatingChat}
      {isVideoExpanded && fullscreenChatOverlayVisible && !floatingChat ? (
        <div
          className="live-chat-video-overlay-shell absolute inset-0 z-[35] pointer-events-none"
          aria-hidden={false}
        >
          <LiveChatVideoOverlay active />
        </div>
      ) : null}

      {!videoFloat && shouldShowTheaterStatusBar(stageState) ? (
      <LiveTheaterStatusBar
        tone={
          stageState === 'ended'
            ? 'ended'
            : stageState === 'error'
              ? 'error'
              : stageState === 'live'
                ? 'live'
                : stageState === 'loading' || stageState === 'reconnecting'
                  ? 'loading'
                  : 'idle'
        }
      >
        <p className="live-theater-status-bar__text">{status}</p>
      </LiveTheaterStatusBar>
      ) : null}
    </div>
  );

  return (
    <>
      {videoFloat && (
        <div
          className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-3 bg-black"
          aria-hidden
        >
          {albumArtUrl ? (
            <img
              src={albumArtUrl}
              alt=""
              className="w-16 h-16 rounded-xl object-cover shadow-lg opacity-60"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#1a1a26] flex items-center justify-center text-2xl">
              🎵
            </div>
          )}
          <div className="text-center max-w-[12rem] px-2">
            <p className="text-xs font-bold text-white truncate">{displayPlaybackTitle}</p>
            <p className="text-[11px] text-gray-400 truncate">{playbackArtist}</p>
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5">📺 Vidéo en mode PiP</p>
        </div>
      )}
      {shouldPortalPip ? createPortal(videoContainer, document.body) : videoContainer}
    </>
  );
}
