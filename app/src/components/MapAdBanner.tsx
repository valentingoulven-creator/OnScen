import { useCallback, useEffect, useState } from 'react';
import { type MapAd } from '../content/ads';
import { api } from '../lib/api';
import { mapApiAdToMapAd, resolveMapAds } from '../lib/sponsorAds';
import { getDisplayDurationMs, SPONSOR_ACCENT_GRADIENTS } from '../lib/sponsorDisplaySpec';

interface MapAdBannerProps {
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

export function MapAdBanner({ onCtaSalon, onCtaLive }: MapAdBannerProps) {
  const [ads, setAds] = useState<MapAd[]>(() => resolveMapAds(null));
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getMapSponsors()
      .then((res) => {
        if (cancelled) return;
        const mapped = res.items.map(mapApiAdToMapAd);
        setAds(resolveMapAds(mapped));
        setIndex(0);
      })
      .catch(() => {
        if (!cancelled) setAds(resolveMapAds(null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = ads.length || 1;
  const ad = ads[index % count];
  const badgeLabel = ad.kind === 'sponsored' ? 'Sponsorisé' : 'Promo';

  const goTo = useCallback((nextIndex: number) => {
    setFading(true);
    window.setTimeout(() => {
      setIndex(nextIndex);
      setFading(false);
    }, 180);
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    let cancelled = false;
    let timer: number | undefined;

    const scheduleNext = (currentIndex: number) => {
      if (cancelled) return;
      const currentAd = ads[currentIndex % ads.length];
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        window.setTimeout(() => setFading(false), 180);
        setIndex((i) => {
          const nextIndex = (i + 1) % ads.length;
          scheduleNext(nextIndex);
          return nextIndex;
        });
      }, getDisplayDurationMs(currentAd.displayDurationSec));
    };

    scheduleNext(0);
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [ads]);

  const handleCta = () => {
    const action = ad.actionId ?? (ad.id === 'salon' ? 'salon' : ad.id === 'live' ? 'live' : undefined);
    if (action === 'salon' && onCtaSalon) {
      onCtaSalon();
      return;
    }
    if (action === 'live' && onCtaLive) {
      onCtaLive();
      return;
    }
    if (ad.href) {
      window.open(ad.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="shrink-0 z-10 px-0 pt-0 pb-1 pointer-events-auto"
      role="region"
      aria-label="Bandeau publicitaire"
    >
      <div
        className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${SPONSOR_ACCENT_GRADIENTS[ad.accent]} shadow-lg shadow-black/20`}
      >
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
          <span className="text-[13.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/25">
            {badgeLabel}
          </span>
          {ad.sponsor && (
            <span className="text-[13.5px] font-semibold text-white/55 truncate max-w-[9rem] sm:max-w-none">
              {ad.sponsor}
            </span>
          )}
        </div>

        <div
          key={ad.id}
          className={`flex items-stretch gap-3 p-4 pt-9 pr-4 min-h-[5.625rem] sm:min-h-[6rem] transition-opacity duration-200 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[19.5px] sm:text-[21px] font-bold text-white leading-tight truncate">{ad.title}</p>
            <p className="text-[15px] sm:text-[16.5px] text-white/85 mt-1 line-clamp-2 leading-snug">{ad.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={handleCta}
            className="shrink-0 self-center px-4 sm:px-[1.125rem] py-2 sm:py-3 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-[16.5px] sm:text-[18px] font-bold text-white whitespace-nowrap"
          >
            {ad.cta}
          </button>
        </div>

        {ads.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-2">
            {ads.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index % ads.length ? 'w-6 bg-white/90' : 'w-2.5 bg-white/35 hover:bg-white/55'
                }`}
                aria-label={`Publicité ${i + 1} sur ${ads.length}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
