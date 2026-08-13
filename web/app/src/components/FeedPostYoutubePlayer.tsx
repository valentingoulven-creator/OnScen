import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useYouTubeIframeApi, useYoutubeConsentBlocked } from '../hooks/useYouTubeIframeApi';
import { usePageHiddenPauseMedia } from '../hooks/usePageHiddenPauseMedia';
import { setCookieConsent } from '../lib/cookieConsent';
import { FeedPostVideoControls } from './FeedPostVideoControls';

const YT_PLAYING = 1;

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  destroy: () => void;
}

type FeedPostYoutubePlayerProps = {
  videoId: string;
  variant?: 'feed' | 'modal';
};

export function FeedPostYoutubePlayer({ videoId, variant = 'feed' }: FeedPostYoutubePlayerProps) {
  const { t } = useTranslation();
  const apiReady = useYouTubeIframeApi();
  const consentBlocked = useYoutubeConsentBlocked();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  const maxH = variant === 'feed' ? 'max-h-64' : 'max-h-[min(55dvh,24rem)]';

  const syncPlayingFromPlayer = useCallback(() => {
    const state = playerRef.current?.getPlayerState();
    setPlaying(state === YT_PLAYING);
  }, []);

  const pausePlayer = useCallback(() => {
    playerRef.current?.pauseVideo();
    setPlaying(false);
  }, []);

  usePageHiddenPauseMedia({
    enabled: playing,
    onPageHidden: pausePlayer,
  });

  useEffect(() => {
    if (!apiReady || consentBlocked || !containerRef.current) return;

    let destroyed = false;
    const host = containerRef.current;

    const player = new window.YT!.Player(host, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        disablekb: 1,
      },
      events: {
        onReady: () => {
          if (destroyed) return;
          playerRef.current = player as unknown as YTPlayerInstance;
          playerRef.current.mute();
          setMuted(true);
          setReady(true);
        },
        onStateChange: (event: { data: number }) => {
          if (destroyed) return;
          setPlaying(event.data === YT_PLAYING);
        },
      },
    });

    return () => {
      destroyed = true;
      setReady(false);
      try {
        (player as unknown as YTPlayerInstance).destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [apiReady, consentBlocked, videoId]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    const state = player.getPlayerState();
    if (state === YT_PLAYING) {
      player.pauseVideo();
      setPlaying(false);
    } else {
      player.playVideo();
      setPlaying(true);
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
    syncPlayingFromPlayer();
  };

  if (consentBlocked) {
    return (
      <div
        className={`relative w-full aspect-video rounded-lg overflow-hidden bg-[#1e1e2f] border border-[#2a2a3d] flex flex-col items-center justify-center gap-2 px-4 text-center ${maxH}`}
      >
        <p className="text-xs text-gray-400">
          {t('feed.youtubeConsentRequired', {
            defaultValue: 'Acceptez les cookies tiers pour lire la vidéo YouTube.',
          })}
        </p>
        <button
          type="button"
          onClick={() => setCookieConsent('all')}
          className="min-h-11 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white"
        >
          {t('feed.youtubeAcceptCookies', { defaultValue: 'Autoriser' })}
        </button>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-300 underline"
        >
          {t('feed.youtubeOpenExternal', { defaultValue: 'Ouvrir sur YouTube' })}
        </a>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-lg overflow-hidden bg-black ${maxH}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e2f]">
          <span className="text-xs text-gray-500">
            {t('feed.videoLoading', { defaultValue: 'Chargement…' })}
          </span>
        </div>
      ) : null}
      {ready ? (
        <FeedPostVideoControls
          playing={playing}
          muted={muted}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          compact={variant === 'feed'}
        />
      ) : null}
    </div>
  );
}
