import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLiveVideoDelaySeconds,
} from '../lib/liveVideoDelay';
import { shouldUseNativeHls as preferNativeHls } from '../lib/safariPlayback';
import { configureInlinePlaybackVideo } from '../lib/liveCameraSupport';

export type HlsPlaybackPhase = 'idle' | 'waiting' | 'loading' | 'live' | 'error';

let hlsModulePromise: Promise<typeof import('hls.js')> | null = null;

function loadHlsModule(): Promise<typeof import('hls.js')> {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js');
  }
  return hlsModulePromise;
}

function hasRenderableVideo(video: HTMLVideoElement): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}

/** Manifeste LL-HLS Cloudflare (réduit le délai glass-to-glass côté lecteur). */
function withCloudflareLlHlsManifest(url: string, viewerDelaySeconds: number): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('protocol=llhls')) return trimmed;
  if (viewerDelaySeconds > 0) return trimmed;
  return `${trimmed}${trimmed.includes('?') ? '&' : '?'}protocol=llhls`;
}

/** Réglages hls.js — latence live vs délai intentionnel hôte. */
function createCloudflareHlsInstance(
  Hls: typeof import('hls.js').default,
  viewerDelaySeconds: number
): import('hls.js').default {
  const delay = getLiveVideoDelaySeconds(viewerDelaySeconds);
  if (delay === 0) {
    return new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 0,
      liveBackBufferLength: 0,
      maxBufferLength: 8,
      maxMaxBufferLength: 12,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 6,
      maxLiveSyncPlaybackRate: 1.5,
      liveDurationInfinity: true,
    });
  }

  const approxSegmentSec = 4;
  const syncCount = Math.max(3, Math.ceil(delay / approxSegmentSec));
  return new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: delay + 15,
    liveBackBufferLength: delay + 15,
    maxBufferLength: delay + 12,
    maxMaxBufferLength: delay + 24,
    liveSyncDurationCount: syncCount,
    liveMaxLatencyDurationCount: syncCount + 2,
    maxLiveSyncPlaybackRate: 1,
    liveDurationInfinity: true,
  });
}

export function useCloudflareHlsPlayback(opts: {
  playbackUrl: string | null | undefined;
  active: boolean;
  /** Passe à true quand Cloudflare lifecycle confirme le flux RTMP OBS. */
  obsIngestLive?: boolean;
  /** Délai intentionnel hôte (secondes) — spectateurs HLS uniquement. */
  viewerDelaySeconds?: number;
}) {
  const { playbackUrl, active, obsIngestLive = false, viewerDelaySeconds = 0 } = opts;
  const delaySeconds = getLiveVideoDelaySeconds(viewerDelaySeconds);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const [phase, setPhase] = useState<HlsPlaybackPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  /** Re-déclenche l’effet HLS quand l’élément <video> est monté ou après retry(). */
  const [videoReady, setVideoReady] = useState(false);
  const [initGeneration, setInitGeneration] = useState(0);

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) configureInlinePlaybackVideo(el);
    setVideoReady(el != null);
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return false;
    try {
      await video.play();
      setPlaybackBlocked(false);
      return true;
    } catch {
      setPlaybackBlocked(true);
      return false;
    }
  }, []);

  const enablePlayback = useCallback(async () => {
    return tryPlay();
  }, [tryPlay]);

  const retry = useCallback(() => {
    setError(null);
    setPhase('loading');
    setStreamActive(false);
    destroyHls();
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setInitGeneration((g) => g + 1);
  }, [destroyHls]);

  useEffect(() => {
    if (!active || !playbackUrl) {
      destroyHls();
      setPhase('idle');
      setStreamActive(false);
      setError(null);
      setPlaybackBlocked(false);
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    if (!videoReady) {
      setPhase('waiting');
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setPhase('waiting');
      return;
    }

    const hlsPlaybackUrl = withCloudflareLlHlsManifest(playbackUrl, delaySeconds);
    const isProgressiveMp4 = /\.mp4(\?|$)/i.test(playbackUrl.trim());

    setPhase('loading');
    setError(null);
    setStreamActive(false);

    const markLiveIfRenderable = () => {
      if (hasRenderableVideo(video)) {
        setStreamActive(true);
        setPhase('live');
        setPlaybackBlocked(false);
      }
    };

    const onPlaying = () => {
      markLiveIfRenderable();
      if (!hasRenderableVideo(video)) {
        window.setTimeout(markLiveIfRenderable, 400);
        window.setTimeout(markLiveIfRenderable, 1500);
        window.setTimeout(markLiveIfRenderable, 4000);
      }
    };

    const onWaiting = () => {
      setPhase((prev) => (prev === 'live' ? prev : 'loading'));
    };

    const onLoadedData = () => {
      markLiveIfRenderable();
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('loadeddata', onLoadedData);

    if (isProgressiveMp4) {
      destroyHls();
      video.loop = true;
      video.src = playbackUrl.trim();
      void tryPlay();

      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('loadeddata', onLoadedData);
        destroyHls();
        video.pause();
        video.loop = false;
        video.removeAttribute('src');
        video.load();
      };
    }

    let cancelled = false;
    let nativeBlackScreenTimer: number | undefined;

    const attachHlsJs = async () => {
      const Hls = (await loadHlsModule()).default;
      if (cancelled) return false;
      if (!Hls.isSupported()) return false;

      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();

      const hls = createCloudflareHlsInstance(Hls, delaySeconds);
      hlsRef.current = hls;
      hls.loadSource(hlsPlaybackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void tryPlay();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setPhase('loading');
          hls.startLoad();
          return;
        }
        setPhase('error');
        setError('Flux HLS indisponible. L’hôte diffuse peut-être encore via OBS.');
        destroyHls();
      });
      return true;
    };

    void (async () => {
      if (preferNativeHls()) {
        video.src = hlsPlaybackUrl;
        const onNativeError = () => {
          void attachHlsJs();
        };
        video.addEventListener('error', onNativeError, { once: true });
        nativeBlackScreenTimer = window.setTimeout(() => {
          if (cancelled || hasRenderableVideo(video)) return;
          void attachHlsJs();
        }, 5000);
        void tryPlay();
        return;
      }

      const attached = await attachHlsJs();
      if (cancelled) return;
      if (!attached) {
        setPhase('error');
        setError('Lecture HLS non supportée sur cet appareil.');
      }
    })();

    return () => {
      cancelled = true;
      if (nativeBlackScreenTimer) window.clearTimeout(nativeBlackScreenTimer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('loadeddata', onLoadedData);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [active, playbackUrl, videoReady, initGeneration, destroyHls, tryPlay, delaySeconds]);

  useEffect(() => {
    if (!active || delaySeconds <= 0) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.seekable.length === 0) return;
      const end = video.seekable.end(video.seekable.length - 1);
      const target = Math.max(0, end - delaySeconds);
      if (video.currentTime > target + 0.35) {
        video.currentTime = target;
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [active, delaySeconds, streamActive]);

  const prevObsLiveRef = useRef(false);
  useEffect(() => {
    if (!active || !playbackUrl) {
      prevObsLiveRef.current = false;
      return;
    }
    if (obsIngestLive && !prevObsLiveRef.current && !streamActive) {
      retry();
    }
    if (!obsIngestLive && prevObsLiveRef.current) {
      setStreamActive(false);
      setPhase('loading');
      setError(null);
      destroyHls();
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }
    prevObsLiveRef.current = obsIngestLive;
  }, [active, obsIngestLive, playbackUrl, retry, streamActive, destroyHls]);

  useEffect(() => {
    if (!active || !playbackUrl || streamActive) return;
    const id = window.setInterval(() => {
      if (obsIngestLive && !streamActive) retry();
    }, 12000);
    return () => window.clearInterval(id);
  }, [active, obsIngestLive, playbackUrl, retry, streamActive]);

  return {
    hlsVideoRef: setVideoEl,
    hlsPhase: phase,
    hlsError: error,
    hlsStreamActive: streamActive,
    hlsPlaybackBlocked: playbackBlocked,
    enableHlsPlayback: enablePlayback,
    retryHlsPlayback: retry,
  };
}
