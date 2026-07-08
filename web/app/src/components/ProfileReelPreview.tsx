import { useEffect, useRef } from 'react';
import type { MusicReel } from '../content/reels';
import { AccelerateBadge } from './AccelerateBadge';
import { useHoldToAccelerate } from '../hooks/useHoldToAccelerate';

interface ProfileReelPreviewProps {
  reel: MusicReel;
  onClose: () => void;
}

export function ProfileReelPreview({ reel, onClose }: ProfileReelPreviewProps) {
  const isVideo = reel.mediaType !== 'image' && !!reel.videoUrl;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const holdAccelerate = useHoldToAccelerate({
    enabled: isVideo,
    getMedia: () => ({ video: videoRef.current }),
  });

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !holdAccelerate.accelerating) return;
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, [holdAccelerate.accelerating]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu : ${reel.title}`}
    >
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 aspect-[9/16] rounded-2xl overflow-hidden border border-[#2d2d3d] bg-black shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
        {reel.visibility === 'private' && (
          <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-purple-600/80 text-[10px] font-bold text-white uppercase">
            Privé
          </span>
        )}
        {isVideo ? (
          <video
            ref={videoRef}
            src={reel.videoUrl}
            poster={reel.posterUrl}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            autoPlay
            controls
            loop
            {...holdAccelerate.handlers}
          />
        ) : (
          <img
            src={reel.posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <AccelerateBadge
          visible={holdAccelerate.accelerating}
          className="absolute top-14 right-3 z-10 pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white/90 tabular-nums shadow-sm"
        />
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/95 to-transparent pointer-events-none">
          <p className="text-[10px] uppercase tracking-wider text-pink-300 font-bold">{reel.genre}</p>
          <p className="text-lg font-extrabold text-white">{reel.title}</p>
          <p className="text-sm text-gray-300">{reel.artist}</p>
        </div>
      </div>
    </div>
  );
}
