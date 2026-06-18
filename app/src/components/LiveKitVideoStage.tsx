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
import { ConnectionState, RoomEvent, Track } from 'livekit-client';
import { api } from '../lib/api';
import { LiveStreamEndedOverlay } from './LiveStreamEndedOverlay';
import { LiveVideoUnavailableOverlay } from './LiveVideoUnavailableOverlay';
import {
  LIVE_CAMERA_HOST_LIVEKIT_START,
  LIVE_CAMERA_VIEWER_FILE_NOTE,
  LIVE_CAMERA_VIEWER_LIVEKIT_CONNECTING,
  LIVE_CAMERA_VIEWER_LIVEKIT_ERROR,
  LIVE_CAMERA_VIEWER_LIVEKIT_NO_HOST_CAMERA,
  LIVE_CAMERA_VIEWER_LIVEKIT_WAITING,
} from '../lib/liveCameraMessages';

const LIVEKIT_VIDEO_WAIT_TIMEOUT_MS = 30_000;

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

const LIVEKIT_VIDEO_CLASS =
  'lk-live-stage-video absolute inset-0 w-full h-full object-contain bg-black z-10';

type LiveKitSession = {
  token: string;
  serverUrl: string;
  roomName: string;
  canPublish: boolean;
};

function LiveKitHostPublisher({
  publishActive,
  onPublishChange,
  onError,
}: {
  publishActive: boolean;
  onPublishChange: (active: boolean) => void;
  onError: (message: string) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localCamera = tracks.find(
    (t) => t.participant.identity === localParticipant.identity && t.source === Track.Source.Camera
  );

  const publishTracks = useCallback(async () => {
    await localParticipant.setCameraEnabled(true);
    await localParticipant.setMicrophoneEnabled(true);
  }, [localParticipant]);

  const unpublishTracks = useCallback(async () => {
    await localParticipant.setCameraEnabled(false);
    await localParticipant.setMicrophoneEnabled(false);
  }, [localParticipant]);

  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;
    let cancelled = false;

    const runPublish = async () => {
      try {
        if (publishActive) {
          await publishTracks();
          if (!cancelled) onPublishChange(true);
        } else {
          await unpublishTracks();
          if (!cancelled) onPublishChange(false);
        }
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : 'Impossible d’activer la caméra.');
          onPublishChange(false);
        }
      }
    };

    void runPublish();

    const onSignalConnected = () => {
      if (!publishActive || cancelled) return;
      void runPublish();
    };
    room.on(RoomEvent.SignalConnected, onSignalConnected);

    return () => {
      cancelled = true;
      room.off(RoomEvent.SignalConnected, onSignalConnected);
    };
  }, [publishActive, room, publishTracks, unpublishTracks, onPublishChange, onError]);

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
  liveCameraActive,
  liveCameraMode,
  onHostStreamActive,
  onViewerStreamActive,
  onError,
}: {
  isHost: boolean;
  publishActive: boolean;
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
};

export function LiveKitVideoStage({
  liveId,
  authToken,
  isHost,
  publishActive,
  liveCameraActive,
  liveCameraMode,
  playbackTitle,
  playbackArtist,
  albumArtUrl,
  initialTheater = false,
  onExpandedChange,
  onFullscreenError,
  overlay,
  enabled = true,
  streamEnded = false,
  streamEndedTitle = 'Stream terminé',
  streamEndedHint,
}: LiveKitVideoStageProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [egressActive, setEgressActive] = useState(false);
  const [egressLoading, setEgressLoading] = useState(false);
  const [egressError, setEgressError] = useState<string | null>(null);
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

  const toggleEgress = useCallback(async () => {
    setEgressError(null);
    setEgressLoading(true);
    try {
      if (egressActive) {
        await api.stopEgress(authToken, liveId);
        setEgressActive(false);
      } else {
        await api.startEgress(authToken, liveId);
        setEgressActive(true);
      }
    } catch (err) {
      setEgressError(err instanceof Error ? err.message : 'Erreur egress CDN');
    } finally {
      setEgressLoading(false);
    }
  }, [authToken, liveId, egressActive]);

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
      if (isMobileNarrowViewport() || shouldAutoLandscapeVideo()) {
        enterTheaterFallback();
        return;
      }
      onFullscreenError?.(t('live.fullscreenError'));
    });
  }, [enterTheaterFallback, onFullscreenError, t]);

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
      className={`live-video-container relative w-full h-full min-h-0 flex flex-col bg-black overflow-hidden${
        isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
      }`}
    >
      <div className="live-video-stage-area">
        {session && roomEnabled ? (
          <LiveKitRoom
            serverUrl={session.serverUrl}
            token={session.token}
            connect={roomEnabled}
            audio={false}
            video={false}
            onError={handleRoomError}
            className="absolute inset-0 w-full h-full"
          >
            <LiveKitRoomInner
              isHost={isHost}
              publishActive={publishActive}
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
          <div className="live-video-stage-overlay z-0 bg-black">
            {albumArtUrl ? (
              <img
                src={albumArtUrl}
                alt=""
                className="w-24 h-24 rounded-xl object-cover shadow-lg opacity-80"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-[#1a1a26] flex items-center justify-center text-3xl">
                🎵
              </div>
            )}
            <div className="max-w-xs">
              <p className="text-sm font-bold text-white truncate">{playbackTitle}</p>
              <p className="text-xs text-gray-400 truncate">{playbackArtist}</p>
            </div>
            {stageState === 'loading' && (
              <div className="mt-2 w-8 h-8 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
            )}
          </div>
        )}

        {!streamEnded && stageState === 'error' ? (
          <LiveVideoUnavailableOverlay
            title={videoErrorTitle}
            hint={videoErrorHint}
            actions={retryActions}
          />
        ) : null}

        {overlay}

        <div className="absolute top-2 left-2 z-30 pointer-events-auto">
          {isVideoExpanded ? (
            <button
              type="button"
              onClick={exitVideoFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-[11px] font-bold backdrop-blur hover:bg-black/85 active:scale-95 transition"
              aria-label={t('live.exitFullscreen')}
              title={t('live.exitFullscreen')}
            >
              <LiveVideoShrinkIcon />
              <span className="hidden sm:inline">{t('live.exitFullscreen')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={enterVideoFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-[11px] font-bold backdrop-blur hover:bg-black/85 active:scale-95 transition"
              aria-label={t('live.enterFullscreen')}
              title={t('live.enterFullscreen')}
            >
              <LiveVideoExpandIcon />
              <span className="hidden sm:inline">{t('live.enterFullscreen')}</span>
            </button>
          )}
        </div>
      </div>

      {isHost && hostStreamActive && !streamEnded ? (
        <div className="shrink-0 px-3 py-1.5 border-t border-white/10 bg-[#0a0a0f] flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-500">
            {egressActive ? 'CDN actif — HLS disponible' : 'Diffusion CDN désactivée'}
          </span>
          <button
            type="button"
            onClick={toggleEgress}
            disabled={egressLoading}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition active:scale-95 ${
              egressActive
                ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                : 'bg-[#1a1a26] border border-white/20 text-gray-200 hover:text-white hover:border-white/40'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={egressActive ? 'Arrêter la diffusion CDN' : 'Diffuser sur CDN (HLS via Cloudflare)'}
          >
            <svg aria-hidden className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {egressActive
                ? <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 10h6v4H9z" />
                : <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />}
            </svg>
            {egressLoading ? '…' : egressActive ? 'Arrêter CDN' : 'Diffuser sur CDN'}
          </button>
          {egressError ? (
            <span className="text-[10px] text-red-400 truncate max-w-[160px]" title={egressError}>
              {egressError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`shrink-0 px-3 py-2 border-t border-white/10 bg-[#0a0a0f] text-center text-[11px] leading-relaxed ${
          stageState === 'ended'
            ? 'text-gray-400'
            : stageState === 'error'
              ? 'text-red-300'
              : stageState === 'live'
                ? 'text-emerald-300'
                : stageState === 'loading'
                  ? 'text-gray-400'
                  : 'text-gray-500'
        }`}
        aria-live="polite"
      >
        {status}
      </div>
    </div>
  );
}
