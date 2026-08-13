import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageHiddenPauseMedia } from '../hooks/usePageHiddenPauseMedia';
import { FeedPostVideoControls } from './FeedPostVideoControls';

type FeedPostNativeVideoProps = {
  src: string;
  variant?: 'feed' | 'modal';
};

export function FeedPostNativeVideo({ src, variant = 'feed' }: FeedPostNativeVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const maxH = variant === 'feed' ? 'max-h-64' : 'max-h-[min(55dvh,24rem)]';

  const pauseVideo = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  }, []);

  usePageHiddenPauseMedia({
    enabled: playing,
    onPageHidden: pauseVideo,
  });

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    setMuted((v) => !v);
  };

  return (
    <div className={`relative w-full rounded-lg overflow-hidden bg-[#1e1e2f] ${maxH}`}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        muted={muted}
        className={`w-full ${maxH} object-cover bg-[#1e1e2f]`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <FeedPostVideoControls
        playing={playing}
        muted={muted}
        onTogglePlay={togglePlay}
        onToggleMute={toggleMute}
        compact={variant === 'feed'}
      />
    </div>
  );
}
