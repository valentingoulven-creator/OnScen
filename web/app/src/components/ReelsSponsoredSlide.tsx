import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReelsSponsorAd } from '../types';
import { SPONSOR_ACCENT_GRADIENTS, sponsorKindBadgeLabel } from '../lib/sponsorDisplaySpec';
import { handleSponsorCta } from '../lib/sponsorAds';

type ReelsSponsoredSlideProps = {
  ad: ReelsSponsorAd;
  isActive: boolean;
  muted: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
  onTapCenter?: () => void;
  showPlaybackPaused?: boolean;
  resolveMuted?: () => boolean;
};

export const ReelsSponsoredSlide = memo(function ReelsSponsoredSlide({
  ad,
  isActive,
  muted,
  videoRef,
  onTapCenter,
  showPlaybackPaused,
  resolveMuted,
}: ReelsSponsoredSlideProps) {
  const { t } = useTranslation();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const hasVideo = !!ad.videoUrl?.trim() && !videoFailed;
  const posterSrc = ad.posterUrl?.trim() || ad.logoUrl?.trim();
  const badgeLabel = sponsorKindBadgeLabel(ad.kind ?? 'sponsored');

  useEffect(() => {
    setVideoFailed(false);
  }, [ad.id, ad.videoUrl]);

  useEffect(() => {
    const m = resolveMuted?.() ?? muted;
    if (localVideoRef.current) {
      localVideoRef.current.muted = m;
      localVideoRef.current.volume = m ? 0 : 1;
    }
  }, [muted, isActive, resolveMuted]);

  const onCenterTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onTapCenter?.();
  };

  const onCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSponsorCta({
      id: ad.id,
      title: ad.title,
      subtitle: ad.subtitle,
      cta: ad.cta,
      href: ad.href,
      accent: ad.accent,
      sponsor: ad.sponsor,
      kind: ad.kind,
      logoUrl: ad.logoUrl,
      displayDurationSec: ad.displayDurationSec,
    });
  };

  return (
    <section
      className="reel-slide relative shrink-0 snap-start snap-always bg-black self-stretch"
      aria-label={t('reels.sponsoredAria', { title: ad.title })}
    >
      {hasVideo ? (
        <video
          ref={(el) => {
            localVideoRef.current = el;
            videoRef(el);
          }}
          className="absolute inset-0 w-full h-full object-cover"
          src={ad.videoUrl}
          poster={posterSrc}
          playsInline
          autoPlay={false}
          loop
          preload={isActive ? 'auto' : 'none'}
          muted={resolveMuted?.() ?? muted}
          onError={() => setVideoFailed(true)}
        />
      ) : posterSrc ? (
        <img
          src={posterSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-b ${SPONSOR_ACCENT_GRADIENTS[ad.accent]}`}
        />
      )}

      <div className="reel-slide__scrim absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

      <div className="absolute top-4 left-3 z-10 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-400/30">
          {badgeLabel}
        </span>
        {ad.sponsor?.trim() && (
          <span className="text-xs font-semibold text-white/80 truncate max-w-[10rem]">
            {ad.sponsor}
          </span>
        )}
      </div>

      <button
        type="button"
        className="absolute inset-0 z-[5] cursor-default"
        aria-label={t('reels.sponsoredTapPause')}
        onClick={onCenterTap}
      />

      {showPlaybackPaused && (
        <div className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center">
          <span className="w-16 h-16 rounded-full bg-black/50 border border-white/30 flex items-center justify-center text-3xl text-white">
            ▶
          </span>
        </div>
      )}

      <div className="reel-sponsor-foot absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 pointer-events-none">
        <div className="pointer-events-auto max-w-[85%]">
          {ad.logoUrl?.trim() && (
            <img
              src={ad.logoUrl.trim()}
              alt=""
              className="w-12 h-12 rounded-xl object-cover bg-white/10 mb-3 border border-white/20"
              loading="lazy"
              decoding="async"
            />
          )}
          <p className="text-lg font-bold text-white leading-tight drop-shadow">{ad.title}</p>
          <p className="text-sm text-white/85 mt-1 line-clamp-2 drop-shadow">{ad.subtitle}</p>
          <button
            type="button"
            onClick={onCtaClick}
            className="mt-3 px-4 py-2 rounded-xl bg-white/15 border border-white/25 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/25 transition-colors"
          >
            {ad.cta}
          </button>
        </div>
      </div>
    </section>
  );
});
