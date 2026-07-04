import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../lib/storageKeys';
import { LiveChatVideoOverlay } from './LiveChatVideoOverlay';
import { LiveStreamEndedOverlay } from './LiveStreamEndedOverlay';
import { LiveVideoUnavailableOverlay } from './LiveVideoUnavailableOverlay';
import { LiveTheaterLiveBadge, LiveVideoStagePlaceholder } from './LiveVideoStagePlaceholder';
import { LiveTheaterStatusBar, LiveVideoChromeButton } from './LiveVideoTheaterChrome';
import {
  LIVE_CAMERA_HOST_LIVEKIT_START,
  LIVE_CAMERA_VIEWER_FILE_NOTE,
  LIVE_CAMERA_VIEWER_LIVEKIT_CONNECTING,
  LIVE_CAMERA_VIEWER_LIVEKIT_ERROR,
  LIVE_CAMERA_VIEWER_LIVEKIT_NO_HOST_CAMERA,
  LIVE_CAMERA_VIEWER_LIVEKIT_WAITING,
  isHiddenHostTheaterStatus,
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

function readChatOverlayEnabled(): boolean {
  return getStorageItem(STORAGE_KEYS.liveChatVideoOverlay) === '1';
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
}) {
  const connectionState = useConnectionState();

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
}: LiveKitVideoStageProps) {
  const videoResolution = getLiveVideoResolutionPreset(videoResolutionProp);
  const videoAspectRatio = getLiveVideoAspectRatioPreset(videoAspectRatioProp);
  const displayPlaybackTitle = normalizeBrandText(playbackTitle);
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [chatOverlayEnabled, setChatOverlayEnabled] = useState(readChatOverlayEnabled);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(initialTheater);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const expandedRef = useRef(false);
  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;
  const [session, setSession] = useState<LiveKitSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostStreamActive, setHostStreamActive] = useState(false);
  const [viewerStreamActive, setViewerStreamActive] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [videoTimedOut, setVideoTimedOut] = useState(false);
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (!enabled || !authToken) return;
    const gen = ++fetchGenRef.current;
    setLoadError(null);
    setSession(null);
    setVideoTimedOut(false);

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
    if (!FULLSCREEN_SUPPORTED) {
      enterTheaterFallback();
      return;
    }
    void requestElementFullscreen(el).catch(() => {
      enterTheaterFallback();
    });
  }, [enterTheaterFallback]);

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

  const toggleChatOverlay = useCallback(() => {
    setChatOverlayEnabled((current) => {
      const next = !current;
      setStorageItem(STORAGE_KEYS.liveChatVideoOverlay, next ? '1' : '0');
      return next;
    });
  }, []);

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

  const stageState: 'loading' | 'live' | 'no-camera' | 'error' | 'ended' = (() => {
    if (streamEnded) return 'ended';
    if (loadError || roomError || videoTimedOut) return 'error';
    if (!session) return 'loading';
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

  return (
    <div
      ref={containerRef}
      data-live-viewer={!isHost ? 'true' : undefined}
      data-live-host={isHost ? 'true' : undefined}
      className={`live-video-container live-video-container--theater ${getLiveVideoAspectRatioClass(videoAspectRatio)} relative w-full h-full min-h-0 flex flex-col overflow-hidden${
        isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
      }`}
      style={{
        ['--live-aspect-ratio' as string]: getLiveVideoAspectRatioCss(videoAspectRatio),
        ['--live-stack-width-ratio' as string]: getLiveStackWidthRatioCss(videoAspectRatio),
      }}
    >
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

        <LiveChatVideoOverlay
          containerRef={stageAreaRef}
          active={chatOverlayEnabled}
          onClose={toggleChatOverlay}
        />

        <div className="absolute top-2 left-2 z-30 pointer-events-auto flex items-center gap-1.5">
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
          <LiveVideoChromeButton
            onClick={toggleChatOverlay}
            ariaLabel={chatOverlayEnabled ? 'Masquer le chat sur la vid\u00e9o' : 'Afficher le chat sur la vid\u00e9o'}
            title="Chat sur la vid\u00e9o (d\u00e9pla\u00e7able)"
            className={chatOverlayEnabled ? 'ring-2 ring-purple-400/60' : ''}
          >
            <LiveVideoChatIcon active={chatOverlayEnabled} />
          </LiveVideoChromeButton>
        </div>
      </div>
            </div>
          </div>
        </div>

      {!(isHost && isHiddenHostTheaterStatus(status)) ? (
      <LiveTheaterStatusBar
        tone={
          stageState === 'ended'
            ? 'ended'
            : stageState === 'error'
              ? 'error'
              : stageState === 'live'
                ? 'live'
                : stageState === 'loading'
                  ? 'loading'
                  : 'idle'
        }
      >
        <p className="live-theater-status-bar__text">{status}</p>
      </LiveTheaterStatusBar>
      ) : null}
      </div>
    </div>
  );
}
