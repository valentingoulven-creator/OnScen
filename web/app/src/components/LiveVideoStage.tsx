import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { VIDEO_PIP_WIDTH, VIDEO_PIP_HEADER_HEIGHT, type VideoPipFloatApi } from './DraggableVideoPip';
import {
  LIVE_CAMERA_HOST_OBS_STOPPED,
  LIVE_CAMERA_VIEWER_AUDIO_BLOCKED,
  LIVE_CAMERA_VIEWER_CLOUDFLARE_WAITING_OBS,
  LIVE_CAMERA_VIEWER_FILE_NOTE,
  LIVE_CAMERA_VIEWER_NO_HOST_CAMERA,
  LIVE_CAMERA_VIEWER_NOTE,
  LIVE_CAMERA_VIEWER_VIDEO_PENDING,
  shouldShowTheaterStatusBar,
} from '../lib/liveCameraMessages';
import type { ViewerRelayPhase } from '../hooks/useLiveVideoRelay';
import type { HlsPlaybackPhase } from '../hooks/useCloudflareHlsPlayback';
import { normalizeBrandText } from '../lib/brandName';
import { LiveStreamEndedOverlay } from './LiveStreamEndedOverlay';
import { LiveChatVideoOverlay } from './LiveChatVideoOverlay';
import { LiveTheaterLiveBadge, LiveVideoStagePlaceholder } from './LiveVideoStagePlaceholder';
import { LiveTheaterStatusBar, LiveVideoChromeButton } from './LiveVideoTheaterChrome';
import {
  getLiveVideoAspectRatioClass,
  getLiveVideoAspectRatioCss,
  getLiveStackWidthRatioCss,
  getLiveVideoAspectRatioPreset,
  type LiveVideoAspectRatioPreset,
} from '../lib/liveVideoAspectRatio';

export type LiveVideoStageState = 'loading' | 'live' | 'no-camera' | 'error' | 'ended';

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
  // Seuil abaissé à 640px (breakpoint Tailwind sm:) pour ne pas déclencher sur bureau
  return window.matchMedia('(max-width: 640px)').matches && window.matchMedia('(pointer: coarse)').matches;
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

function LiveVideoPipIcon() {
  return (
    <svg aria-hidden className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="12" y="10" width="8" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.7" />
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

function resolveStageState(opts: {
  isHost: boolean;
  streamMode?: 'webrtc' | 'cloudflare';
  hostStreamActive: boolean;
  viewerStreamActive: boolean;
  hlsStreamActive?: boolean;
  hlsPhase?: HlsPlaybackPhase;
  liveCameraActive: boolean;
  liveCameraMode?: 'camera' | 'file';
  viewerRelayPhase: ViewerRelayPhase;
  viewerHasVideoTrack?: boolean;
  cloudflareObsConnected?: boolean;
}): LiveVideoStageState {
  const {
    isHost,
    streamMode = 'webrtc',
    hostStreamActive,
    viewerStreamActive,
    hlsStreamActive = false,
    hlsPhase = 'idle',
    liveCameraActive,
    liveCameraMode,
    viewerRelayPhase,
    viewerHasVideoTrack,
    cloudflareObsConnected,
  } = opts;

  if (isHost) {
    if (streamMode === 'cloudflare') {
      if (hlsPhase === 'error') return 'error';
      if (hlsStreamActive && cloudflareObsConnected !== false) return 'live';
      if (hlsPhase === 'loading' || hlsPhase === 'waiting' || hlsPhase === 'idle') return 'loading';
      return 'loading';
    }
    return hostStreamActive ? 'live' : 'no-camera';
  }

  if (streamMode === 'cloudflare') {
    if (hlsPhase === 'error') return 'error';
    if (hlsStreamActive && cloudflareObsConnected !== false) return 'live';
    if (hlsPhase === 'loading' || hlsPhase === 'waiting' || hlsPhase === 'idle') return 'loading';
    return 'loading';
  }

  if (viewerRelayPhase === 'failed') return 'error';
  if (!liveCameraActive || liveCameraMode === 'file') return 'no-camera';
  if (viewerStreamActive) return 'live';
  if (viewerHasVideoTrack || viewerRelayPhase === 'connecting' || viewerRelayPhase === 'waiting') {
    return 'loading';
  }
  return 'loading';
}

function statusLabel(
  state: LiveVideoStageState,
  opts: {
    isHost: boolean;
    streamMode?: 'webrtc' | 'cloudflare';
    viewerRelayPhase: ViewerRelayPhase;
    viewerRelayError: string | null;
    hlsPhase?: HlsPlaybackPhase;
    hlsError?: string | null;
    liveCameraMode?: 'camera' | 'file';
    viewerHasVideoTrack?: boolean;
    cloudflareObsConnected?: boolean;
  }
): string {
  const {
    isHost,
    streamMode = 'webrtc',
    viewerRelayPhase,
    viewerRelayError,
    hlsError,
    liveCameraMode,
    viewerHasVideoTrack,
    cloudflareObsConnected,
  } = opts;

  if (isHost) {
    if (streamMode === 'cloudflare') {
      switch (state) {
        case 'live':
          return 'Aperçu OBS (CDN)';
        case 'error':
          return hlsError ?? 'Flux OBS indisponible';
        case 'loading':
        default:
          if (cloudflareObsConnected === false) {
            return LIVE_CAMERA_HOST_OBS_STOPPED;
          }
          return 'Flux OBS reçu — chargement de la vidéo…';
      }
    }
    return state === 'live' ? 'Caméra active' : 'Activez la caméra ou choisissez une vidéo';
  }

  if (streamMode === 'cloudflare') {
    switch (state) {
      case 'live':
        return 'Vidéo en direct (CDN)';
      case 'error':
        return hlsError ?? 'Flux CDN indisponible';
      case 'loading':
      default:
        if (cloudflareObsConnected === false) {
          return 'En attente de la diffusion OBS…';
        }
        return LIVE_CAMERA_VIEWER_CLOUDFLARE_WAITING_OBS;
    }
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
      if (viewerHasVideoTrack) return LIVE_CAMERA_VIEWER_VIDEO_PENDING;
      if (viewerRelayPhase === 'connecting') return 'Connexion WebRTC\u2026';
      if (viewerRelayPhase === 'waiting') return 'En attente du host\u2026';
      return LIVE_CAMERA_VIEWER_NOTE;
  }
}

export type LiveVideoStageProps = {
  isHost: boolean;
  streamMode?: 'webrtc' | 'cloudflare';
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
  hlsStreamActive?: boolean;
  hlsPhase?: HlsPlaybackPhase;
  hlsError?: string | null;
  hlsPlaybackBlocked?: boolean;
  /** Cloudflare lifecycle : RTMP OBS actif. */
  cloudflareObsConnected?: boolean;
  enableViewerPlayback: () => Promise<boolean>;
  onRetryViewerRelay?: () => void;
  onRetryHlsPlayback?: () => void;
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
  streamEnded?: boolean;
  streamEndedTitle?: string;
  streamEndedHint?: string;
  /** PiP flottant in-app : vid\u00e9o seule d\u00e9plaçable, toujours au premier plan. */
  videoFloat?: VideoPipFloatApi;
  /** Appel\u00e9 quand l\u2019utilisateur clique sur \u29c9 pour activer le PiP. */
  onPipOpen?: () => void;
  videoAspectRatio?: LiveVideoAspectRatioPreset;
  /** Chat flottant principal (FloatingSalonChat) visible — hors plein écran. */
  chatVisible?: boolean;
  /** Ouvre ou masque le chat flottant (bouton chrome vidéo, mode normal). */
  onToggleFloatingChat?: () => void;
  /** Overlay chat OBS transparent (plein écran / landscape theater). */
  fullscreenChatOverlayVisible?: boolean;
  /** Bascule l'overlay chat plein écran. */
  onToggleFullscreenChatOverlay?: () => void;
  /** Pause locale du flux (spectateur uniquement). */
  viewerPlaybackPaused?: boolean;
  onToggleViewerPlaybackPaused?: () => void;
};

export function LiveVideoStage({
  isHost,
  streamMode = 'webrtc',
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
  hlsStreamActive = false,
  hlsPhase = 'idle',
  hlsError = null,
  hlsPlaybackBlocked = false,
  cloudflareObsConnected,
  enableViewerPlayback,
  onRetryViewerRelay,
  onRetryHlsPlayback,
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
  streamEnded = false,
  streamEndedTitle = 'Stream termin\u00e9',
  streamEndedHint,
  videoFloat,
  onPipOpen,
  videoAspectRatio: videoAspectRatioProp,
  chatVisible = false,
  onToggleFloatingChat,
  fullscreenChatOverlayVisible = false,
  onToggleFullscreenChatOverlay,
  viewerPlaybackPaused = false,
  onToggleViewerPlaybackPaused,
}: LiveVideoStageProps) {
  const videoAspectRatio = getLiveVideoAspectRatioPreset(videoAspectRatioProp);
  const displayPlaybackTitle = normalizeBrandText(playbackTitle);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isLandscapeTheater, setIsLandscapeTheater] = useState(initialTheater);
  const landscapeAutoActiveRef = useRef(false);
  const landscapeAutoDismissedRef = useRef(false);
  const expandedRef = useRef(false);

  const isVideoExpanded = isVideoFullscreen || isLandscapeTheater;

  const stageState: LiveVideoStageState = streamEnded
    ? 'ended'
    : resolveStageState({
        isHost,
        streamMode,
        hostStreamActive,
        viewerStreamActive,
        hlsStreamActive,
        hlsPhase,
        liveCameraActive,
        liveCameraMode,
        viewerRelayPhase,
        viewerHasVideoTrack,
        cloudflareObsConnected,
      });

  const showVideo = stageState === 'live';
  const isCloudflareCdn = streamMode === 'cloudflare';
  const playbackUnlockNeeded = isCloudflareCdn
    ? hlsPlaybackBlocked
    : isHost
      ? hostPreviewBlocked
      : viewerPlaybackBlocked || viewerAudioBlocked;
  const showPlayOverlay =
    !streamEnded &&
    (isCloudflareCdn ? hlsPlaybackBlocked : showVideo && playbackUnlockNeeded);
  const unlockPlayback = isCloudflareCdn
    ? enableViewerPlayback
    : isHost
      ? enableHostPreview ?? enableViewerPlayback
      : enableViewerPlayback;

  const playOverlayHint = (() => {
    if (isHost && isCloudflareCdn) {
      return 'Appuyez pour lancer l’aperçu OBS';
    }
    if (isHost) {
      return 'Appuyez pour démarrer l’aperçu caméra';
    }
    if (!viewerHasVideoTrack) {
      return LIVE_CAMERA_VIEWER_VIDEO_PENDING;
    }
    if (viewerPlaybackBlocked) {
      return 'Appuyez pour d\u00e9marrer la lecture vid\u00e9o';
    }
    return LIVE_CAMERA_VIEWER_AUDIO_BLOCKED;
  })();

  const playOverlayLabel = isHost || viewerPlaybackBlocked ? 'Lancer la vid\u00e9o' : 'Activer le son';
  const status = streamEnded
    ? streamEndedTitle
    : statusLabel(stageState, {
    isHost,
    streamMode,
    viewerRelayPhase,
    viewerRelayError,
    hlsPhase,
    hlsError,
    liveCameraMode,
    viewerHasVideoTrack,
    cloudflareObsConnected,
  });

  useEffect(() => {
    if (!streamEnded) return;
    const video = containerRef.current?.querySelector('video');
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, [streamEnded]);

  useEffect(() => {
    if (isHost || !onToggleViewerPlaybackPaused) return;
    const video = containerRef.current?.querySelector('video');
    if (!video) return;
    if (viewerPlaybackPaused) {
      video.pause();
    } else if (showVideo) {
      void video.play().catch(() => {});
    }
  }, [isHost, viewerPlaybackPaused, showVideo, onToggleViewerPlaybackPaused]);

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

  const videoRef = isCloudflareCdn ? viewerVideoRef : isHost ? hostVideoRef : viewerVideoRef;

  const VIDEO_PIP_VIDEO_HEIGHT = Math.round(VIDEO_PIP_WIDTH * 9 / 16);
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={videoFloat.onClose}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition text-sm"
            title="Ancrer la vid\u00e9o"
            aria-label="Ancrer la vid\u00e9o"
          >
            &#x2199;
          </button>
          {!isHost && onToggleViewerPlaybackPaused ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleViewerPlaybackPaused}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition"
              title={viewerPlaybackPaused ? 'Reprendre la lecture' : 'Mettre en pause'}
              aria-label={viewerPlaybackPaused ? 'Reprendre la lecture' : 'Mettre en pause'}
            >
              {viewerPlaybackPaused ? <LiveVideoPlayIcon /> : <LiveVideoPauseIcon />}
            </button>
          ) : null}
        </div>
      )}

      <div className="live-theater-stage-stack flex flex-col flex-1 min-h-0 min-w-0 w-full h-full">
        <div className="live-theater-hero-wrap flex flex-col min-w-0 w-full h-full min-h-0 shrink-0">
          <div className="live-theater-hero flex flex-col min-w-0 w-full flex-1 min-h-0">
            <div className="live-theater-hero__frame relative min-w-0 w-full flex-1 min-h-0">
      {/* Video layer — single element, always mounted when role known */}
      <div ref={stageAreaRef} className="live-video-stage-area absolute inset-0 w-full h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          {...(isHost ? { muted: true } : {})}
          className={`absolute inset-0 w-full h-full bg-black z-10 live-stage-video${
            isCloudflareCdn ? ' live-cloudflare-stage-video' : ''
          }${showVideo ? '' : ' opacity-0 pointer-events-none'}`}
          aria-hidden={!showVideo}
          aria-label={
            isCloudflareCdn
              ? isHost
                ? 'Aperçu OBS (CDN)'
                : 'Flux vidéo du host'
              : isHost
                ? 'Aperçu caméra'
                : 'Flux vidéo du host'
          }
        />

        {/* Placeholder — album art only when no live video */}
        {!showVideo && !streamEnded && (
          isCloudflareCdn ? (
            <LiveVideoStagePlaceholder
              title={status}
              icon={
                <span className="text-4xl leading-none" aria-hidden>
                  📡
                </span>
              }
              loading={stageState === 'loading'}
              badge={stageState === 'loading' ? <LiveTheaterLiveBadge label="CDN" /> : undefined}
            />
          ) : (
            <LiveVideoStagePlaceholder
              title={displayPlaybackTitle}
              artist={playbackArtist}
              albumArtUrl={albumArtUrl}
              loading={stageState === 'loading'}
              badge={stageState === 'loading' ? <LiveTheaterLiveBadge /> : undefined}
              footer={
                stageState === 'error' ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    {onRetryHlsPlayback ? (
                      <button
                        type="button"
                        onClick={() => onRetryHlsPlayback()}
                        className="px-4 py-2 min-h-11 rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white touch-manipulation"
                      >
                        R\u00e9essayer
                      </button>
                    ) : onRetryViewerRelay ? (
                      <button
                        type="button"
                        onClick={() => onRetryViewerRelay()}
                        className="px-4 py-2 min-h-11 rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white touch-manipulation"
                      >
                        R\u00e9essayer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 min-h-11 rounded-full text-xs font-bold bg-[#1a1a26] border border-white/15 text-gray-200 hover:text-white touch-manipulation"
                    >
                      Rafra\u00eechir la page
                    </button>
                  </div>
                ) : undefined
              }
            />
          )
        )}

        {streamEnded ? (
          <LiveStreamEndedOverlay title={streamEndedTitle} hint={streamEndedHint} />
        ) : null}

        {/* Autoplay blocked — big obvious button covering video */}
        {showPlayOverlay && !streamEnded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 pointer-events-none">
            <button
              type="button"
              data-live-play-unlock
              onClick={handleUnlockPlayback}
              className="pointer-events-auto flex flex-col items-center gap-1 px-4 py-2.5 min-h-[44px] max-w-[min(100%,11rem)] rounded-xl bg-purple-600/95 hover:bg-purple-500 active:scale-95 transition shadow-lg"
              aria-label={
                isCloudflareCdn
                  ? isHost
                    ? 'Lancer l’aperçu OBS'
                    : 'Lancer la vidéo du live'
                  : isHost
                    ? 'Lancer l’aperçu caméra'
                    : 'Lancer la vidéo et le son du live'
              }
            >
              <span className="flex items-center gap-1.5">
                <span className="text-lg leading-none" aria-hidden>
                  &#9654;
                </span>
                <span className="text-xs font-bold text-white">{playOverlayLabel}</span>
              </span>
              <span className="text-[10px] text-purple-200 text-center leading-snug">
                {playOverlayHint}
              </span>
            </button>
          </div>
        )}

        {overlay}

        {isVideoExpanded && fullscreenChatOverlayVisible ? (
          <LiveChatVideoOverlay active />
        ) : null}

        {/* Fullscreen + PiP + chat — hidden when container is already floating */}
        {!videoFloat && (
          <div className="absolute top-2 left-2 z-30 pointer-events-auto flex items-center gap-1.5">
            {isVideoExpanded ? (
              <LiveVideoChromeButton onClick={exitVideoFullscreen} ariaLabel="Quitter le plein \u00e9cran">
                <LiveVideoShrinkIcon />
              </LiveVideoChromeButton>
            ) : (
              <LiveVideoChromeButton onClick={enterVideoFullscreen} ariaLabel="Plein \u00e9cran">
                <LiveVideoExpandIcon />
              </LiveVideoChromeButton>
            )}
            {onPipOpen && !isVideoExpanded && (
              <LiveVideoChromeButton onClick={onPipOpen} ariaLabel="D\u00e9tacher en PiP" title="D\u00e9tacher la vid\u00e9o (PiP)">
                <LiveVideoPipIcon />
                <span className="hidden sm:inline">PiP</span>
              </LiveVideoChromeButton>
            )}
            {!isVideoExpanded && onToggleFloatingChat ? (
              <LiveVideoChromeButton
                onClick={onToggleFloatingChat}
                ariaLabel={chatVisible ? 'Masquer le chat' : 'Afficher le chat'}
                title={chatVisible ? 'Masquer le chat' : 'Afficher le chat'}
                className={chatVisible ? 'ring-2 ring-purple-400/60' : ''}
              >
                <LiveVideoChatIcon active={chatVisible} />
              </LiveVideoChromeButton>
            ) : null}
            {isVideoExpanded && onToggleFullscreenChatOverlay ? (
              <LiveVideoChromeButton
                onClick={onToggleFullscreenChatOverlay}
                ariaLabel={
                  fullscreenChatOverlayVisible ? 'Masquer le chat' : 'Afficher le chat sur la vidéo'
                }
                title={
                  fullscreenChatOverlayVisible ? 'Masquer le chat' : 'Afficher le chat sur la vidéo'
                }
                className={fullscreenChatOverlayVisible ? 'ring-2 ring-purple-400/60' : ''}
              >
                <LiveVideoChatIcon active={fullscreenChatOverlayVisible} />
              </LiveVideoChromeButton>
            ) : null}
            {!isHost && onToggleViewerPlaybackPaused ? (
              <LiveVideoChromeButton
                onClick={onToggleViewerPlaybackPaused}
                ariaLabel={viewerPlaybackPaused ? 'Reprendre la lecture' : 'Mettre en pause'}
                title={viewerPlaybackPaused ? 'Reprendre la lecture' : 'Mettre en pause'}
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

      {/* Status bar — erreurs uniquement ; placeholder + contrôles pour le reste */}
      {!videoFloat && shouldShowTheaterStatusBar(stageState) && (
        <LiveTheaterStatusBar
          tone={
            stageState === 'error'
              ? 'error'
              : stageState === 'live'
                ? 'live'
                : stageState === 'loading'
                  ? 'loading'
                  : 'idle'
          }
        >
          <p className="live-theater-status-bar__text">{status}</p>
          {import.meta.env.DEV && !isHost && viewerDebugInfo ? (
            <span className="block text-[9px] text-gray-600 mt-0.5 font-mono">{viewerDebugInfo}</span>
          ) : null}
        </LiveTheaterStatusBar>
      )}
      </div>
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
