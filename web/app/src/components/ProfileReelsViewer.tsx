import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MusicReel } from '../content/reels';
import { AccelerateBadge } from './AccelerateBadge';
import { useHoldToAccelerate } from '../hooks/useHoldToAccelerate';

interface ProfileReelsViewerProps {
  reels: MusicReel[];
  initialReelId: string;
  onClose: () => void;
}

function ProfileReelsViewerSlide({ reel, isActive }: { reel: MusicReel; isActive: boolean }) {
  const isImage = reel.mediaType === 'image' || !reel.videoUrl?.trim();
  const separateAudio = !!reel.audioUrl?.trim();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const holdAccelerate = useHoldToAccelerate({
    enabled: isActive && !isImage,
    getMedia: () => ({
      video: videoRef.current,
      audio: separateAudio ? audioRef.current : null,
    }),
  });

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!isActive) {
      video?.pause();
      audio?.pause();
      return;
    }
    if (isImage) return;

    let cancelled = false;
    void (async () => {
      if (!video) return;
      video.muted = separateAudio;
      try {
        await video.play();
      } catch {
        video.muted = true;
        try {
          await video.play();
        } catch {
          /* ignore */
        }
      }
      if (cancelled || !separateAudio || !audio) return;
      try {
        audio.currentTime = video.currentTime;
        await audio.play();
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isActive, isImage, separateAudio, reel.id]);

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!isActive || !separateAudio || !video || !audio) return;
    if (Math.abs(audio.currentTime - video.currentTime) > 0.35) {
      try {
        audio.currentTime = video.currentTime;
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <section
      className="reel-slide relative shrink-0 snap-start snap-always bg-black self-stretch"
      aria-label={`${reel.title} — ${reel.artist}`}
    >
      {isImage ? (
        <img
          src={reel.posterUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading={isActive ? 'eager' : 'lazy'}
        />
      ) : (
        <>
          <video
            ref={videoRef}
            src={reel.videoUrl}
            poster={reel.posterUrl}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            loop
            preload={isActive ? 'auto' : 'metadata'}
            muted={separateAudio}
            onTimeUpdate={onVideoTimeUpdate}
            {...holdAccelerate.handlers}
          />
          {separateAudio ? (
            <audio ref={audioRef} src={reel.audioUrl} preload={isActive ? 'auto' : 'none'} className="hidden" loop />
          ) : null}
        </>
      )}
      <AccelerateBadge
        visible={holdAccelerate.accelerating}
        className="absolute top-14 right-3 z-10 pointer-events-none rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white/90 tabular-nums shadow-sm"
      />
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none">
        {reel.visibility === 'private' || reel.isPrivate ? (
          <span className="inline-block mb-1 rounded-md bg-purple-600/80 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
            Privé
          </span>
        ) : null}
        {reel.genre ? (
          <p className="text-[10px] uppercase tracking-wider text-pink-300 font-bold">{reel.genre}</p>
        ) : null}
        <p className="text-lg font-extrabold text-white leading-snug">{reel.title}</p>
        <p className="text-sm text-gray-300">{reel.artist}</p>
      </div>
    </section>
  );
}

/** Lecteur plein écran — scroll vertical dans les reels du profil uniquement. */
export function ProfileReelsViewer({ reels, initialReelId, onClose }: ProfileReelsViewerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialIndex = useMemo(() => {
    const i = reels.findIndex((r) => r.id === initialReelId);
    return i >= 0 ? i : 0;
  }, [reels, initialReelId]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el || el.clientHeight <= 0) return;
    const clamped = Math.max(0, Math.min(reels.length - 1, index));
    el.scrollTo({ top: clamped * el.clientHeight, behavior });
    setActiveIndex(clamped);
  }, [reels.length]);

  useLayoutEffect(() => {
    scrollToIndex(initialIndex, 'auto');
  }, [initialIndex, scrollToIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientHeight <= 0) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    const clamped = Math.max(0, Math.min(reels.length - 1, idx));
    setActiveIndex((prev) => (prev === clamped ? prev : clamped));
  };

  if (reels.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.reelsViewerLabel', { defaultValue: 'Reels du profil' })}
    >
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 pointer-events-none">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto min-h-11 min-w-11 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white text-lg"
          aria-label={t('common.close', { defaultValue: 'Fermer' })}
        >
          ✕
        </button>
        <span className="pointer-events-none text-xs font-semibold text-white/80 tabular-nums">
          {activeIndex + 1} / {reels.length}
        </span>
        <span className="w-11" aria-hidden />
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="reels-track flex-1 min-h-0 w-full flex flex-col items-stretch overflow-y-auto overflow-x-hidden touch-pan-y snap-y snap-mandatory"
      >
        {reels.map((reel, index) => (
          <ProfileReelsViewerSlide key={reel.id} reel={reel} isActive={index === activeIndex} />
        ))}
      </div>
    </div>
  );
}
