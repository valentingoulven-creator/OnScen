import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export type HlsPlaybackPhase = 'idle' | 'waiting' | 'loading' | 'live' | 'error';

function canPlayNativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export function useCloudflareHlsPlayback(opts: {
  playbackUrl: string | null | undefined;
  active: boolean;
}) {
  const { playbackUrl, active } = opts;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [phase, setPhase] = useState<HlsPlaybackPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
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
    destroyHls();
    const video = videoRef.current;
    if (video) {
      video.removeAttribute('src');
      video.load();
    }
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

    const video = videoRef.current;
    if (!video) {
      setPhase('waiting');
      return;
    }

    setPhase('loading');
    setError(null);
    setStreamActive(false);

    const onPlaying = () => {
      setStreamActive(true);
      setPhase('live');
      setPlaybackBlocked(false);
    };

    const onWaiting = () => {
      setPhase((prev) => (prev === 'live' ? prev : 'loading'));
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);

    if (canPlayNativeHls(video)) {
      video.src = playbackUrl;
      void tryPlay();
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
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
    } else {
      setPhase('error');
      setError('Lecture HLS non supportée sur cet appareil.');
    }

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      destroyHls();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [active, playbackUrl, destroyHls, tryPlay]);

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
