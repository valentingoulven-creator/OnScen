import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LIVE_CAMERA_VIEWER_AUDIO_BLOCKED,
  LIVE_CAMERA_VIEWER_FILE_NOTE,
  LIVE_CAMERA_VIEWER_NO_HOST_CAMERA,
  LIVE_CAMERA_VIEWER_NOTE,
  LIVE_CAMERA_VIEWER_VIDEO_PENDING,
} from '../lib/liveCameraMessages';
import type { ViewerRelayPhase } from '../hooks/useLiveVideoRelay';

export type LiveVideoStageState = 'loading' | 'live' | 'no-camera' | 'error';

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

function resolveStageState(opts: {
  isHost: boolean;
  hostStreamActive: boolean;
  viewerStreamActive: boolean;
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  viewerRelayPhase: ViewerRelayPhase;
}): LiveVideoStageState {
  const { isHost, hostStreamActive, viewerStreamActive, liveCameraActive, liveCameraMode, viewerRelayPhase } =
    opts;

  if (isHost) {
    return hostStreamActive ? 'live' : 'no-camera';
  }

  if (viewerRelayPhase === 'failed') return 'error';
  if (!liveCameraActive || liveCameraMode === 'file') return 'no-camera';
  if (viewerStreamActive) return 'live';
  return 'loading';
}

function statusLabel(
  state: LiveVideoStageState,
  opts: {
    isHost: boolean;
    viewerRelayPhase: ViewerRelayPhase;
    viewerRelayError: string | null;
    liveCameraMode?: 'camera' | 'file';
  }
): string {
  const { isHost, viewerRelayPhase, viewerRelayError, liveCameraMode } = opts;

  if (isHost) {
    return state === 'live' ? 'Caméra active' : 'Activez la caméra ou choisissez une vidéo';
  }

  switch (state) {
    case 'live':
      return 'Vidéo en direct';
    case 'error':
      return viewerRelayError ?? 'Flux vidéo indisponible';
    case 'no-camera':
      return liveCameraMode === 'file'
        ? LIVE_CAMERA_VIEWER_FILE_NOTE
        : LIVE_CAMERA_VIEWER_NO_HOST_CAMERA;
    case 'loading':
    default:
      if (viewerRelayPhase === 'connecting') return 'Connexion WebRTC…';
      if (viewerRelayPhase === 'waiting') return 'En attente du host…';
      return LIVE_CAMERA_VIEWER_NOTE;
  }
}

export type LiveVideoStageProps = {
  isHost: boolean;
  hostVideoRef: (el: HTMLVideoElement | null) => void;
  viewerVideoRef: (el: HTMLVideoElement | null) => void;
  hostStreamActive: boolean;
  hostCameraMode?: 'camera' | 'file' | null;
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  viewerStreamActive: boolean;
  viewerRelayPhase: ViewerRelayPhase;
  viewerRelayError: string | null;
  viewerPlaybackBlocked: boolean;
  viewerAudioBlocked: boolean;
  viewerHasVideoTrack?: boolean;
  viewerDebugInfo?: string;
  enableViewerPlayback: () => Promise<boolean>;
  hostPreviewBlocked?: boolean;
  enableHostPreview?: () => Promise<boolean>;
  playbackTitle: string;
  playbackArtist: string;
  albumArtUrl?: string;
  initialTheater?: boolean;
  /** Called when fullscreen / landscape theater expands or collapses. */
  onExpandedChange?: (expanded: boolean) => void;
  onFullscreenError?: (message: string) => void;
  overlay?: ReactNode;
  enabled?: boolean;
};

export function LiveVideoStage({
  isHost,
  hostVideoRef,
  viewerVideoRef,
  hostStreamActive,
  liveCameraActive,
  liveCameraMode,
  viewerStreamActive,
  viewerRelayPhase,
  viewerRelayError,
  viewerPlaybackBlocked,
  viewerAudioBlocked,
  viewerHasVideoTrack = true,
  viewerDebugInfo = '',
  enableViewerPlayback,
  hostPreviewBlocked = false,
  enableHostPreview,
  playbackTitle,
  playbackArtist,
  albumArtUrl,
  initialTheater = false,
  onExpandedChange,
  onFullscreenError,
  overlay,
  enabled = true,
}: LiveVideoStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(initialTheater);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const expandedRef = useRef(false);

  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;

  const stageState = resolveStageState({
    isHost,
    hostStreamActive,
    viewerStreamActive,
    liveCameraActive,
    liveCameraMode,
    viewerRelayPhase,
  });

  const showVideo = stageState === 'live';
  const playbackUnlockNeeded = isHost
    ? hostPreviewBlocked
    : viewerPlaybackBlocked || viewerAudioBlocked;
  const showPlayOverlay = showVideo && playbackUnlockNeeded;
  const unlockPlayback = isHost ? enableHostPreview ?? enableViewerPlayback : enableViewerPlayback;

  const playOverlayHint = (() => {
    if (isHost) {
      return 'Appuyez pour démarrer l’aperçu caméra';
    }
    if (!viewerHasVideoTrack) {
      return LIVE_CAMERA_VIEWER_VIDEO_PENDING;
    }
    if (viewerPlaybackBlocked) {
      return 'Appuyez pour démarrer la lecture vidéo';
    }
    return LIVE_CAMERA_VIEWER_AUDIO_BLOCKED;
  })();

  const playOverlayLabel = isHost || viewerPlaybackBlocked ? 'Lancer la vidéo' : 'Activer le son';
  const status = statusLabel(stageState, {
    isHost,
    viewerRelayPhase,
    viewerRelayError,
    liveCameraMode,
  });

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
      onFullscreenError?.('Impossible d\'activer le plein écran sur cet appareil.');
    });
  }, [enterTheaterFallback, onFullscreenError]);

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

  const handleUnlockPlayback = useCallback(() => {
    void unlockPlayback();
  }, [unlockPlayback]);

  useEffect(() => {
    if (!showPlayOverlay) return;
    const root = containerRef.current;
    if (!root) return;

    let autoAttempted = false;
    const onStageInteraction = (event: PointerEvent) => {
      if (autoAttempted) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-live-play-unlock]')) return;
      autoAttempted = true;
      void unlockPlayback();
    };

    root.addEventListener('pointerdown', onStageInteraction, { capture: true });
    return () => root.removeEventListener('pointerdown', onStageInteraction, { capture: true });
  }, [showPlayOverlay, unlockPlayback]);

  const videoRef = isHost ? hostVideoRef : viewerVideoRef;

  return (
    <div
      ref={containerRef}
      className={`live-video-container relative w-full flex-1 min-h-0 flex flex-col bg-black overflow-hidden${
        isLandscapeTheater ? ' live-video-container--landscape-theater' : ''
      }`}
    >
      {/* Video layer — single element, always mounted when role known */}
      <div className="relative flex-1 min-h-0 w-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          {...(isHost ? { muted: true } : {})}
          className={`absolute inset-0 w-full h-full object-cover bg-black z-10${
            showVideo ? '' : ' opacity-0 pointer-events-none'
          }`}
          aria-hidden={!showVideo}
          aria-label={isHost ? 'Aperçu caméra' : 'Flux vidéo du host'}
        />

        {/* Placeholder — album art only when no live video */}
        {!showVideo && (
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-black">
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
            {stageState === 'error' && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 rounded-full text-xs font-bold bg-[#1a1a26] border border-white/15 text-gray-200 hover:text-white"
              >
                Rafraîchir la page
              </button>
            )}
          </div>
        )}

        {/* Autoplay blocked — big obvious button covering video */}
        {showPlayOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <button
              type="button"
              data-live-play-unlock
              onClick={handleUnlockPlayback}
              className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 transition shadow-xl"
              aria-label={isHost ? 'Lancer l’aperçu caméra' : 'Lancer la vidéo et le son du live'}
            >
              <span className="text-4xl">▶</span>
              <span className="text-base font-bold text-white">{playOverlayLabel}</span>
              <span className="text-xs text-purple-200 max-w-[14rem] text-center">
                {playOverlayHint}
              </span>
            </button>
          </div>
        )}

        {overlay}

        {/* Fullscreen control */}
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
      </div>

      {/* Status bar — below video, never over it */}
      <div
        className={`shrink-0 px-3 py-2 border-t border-white/10 bg-[#0a0a0f] text-center text-[11px] leading-relaxed ${
          stageState === 'error'
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
        {!isHost && viewerDebugInfo ? (
          <span className="block text-[9px] text-gray-600 mt-0.5 font-mono">{viewerDebugInfo}</span>
        ) : null}
      </div>
    </div>
  );
}
