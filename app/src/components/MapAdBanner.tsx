import { useCallback, useEffect, useState } from 'react';
import { MAP_ADS, type MapAd } from '../content/ads';

const ROTATE_MS = 8000;

const accentStyles: Record<MapAd['accent'], string> = {
  purple: 'from-purple-600/90 via-violet-700/80 to-purple-900/90',
  pink: 'from-pink-600/90 via-fuchsia-700/80 to-purple-900/90',
  amber: 'from-amber-500/90 via-orange-600/80 to-amber-900/90',
  cyan: 'from-cyan-600/90 via-teal-600/80 to-indigo-900/90',
  rose: 'from-rose-600/90 via-pink-700/80 to-purple-900/90',
};

interface MapAdBannerProps {
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

export function MapAdBanner({ onCtaSalon, onCtaLive }: MapAdBannerProps) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const ad = MAP_ADS[index % MAP_ADS.length];
  const badgeLabel = ad.kind === 'sponsored' ? 'Sponsorisé' : 'Promo';

  const goTo = useCallback((nextIndex: number) => {
    setFading(true);
    window.setTimeout(() => {
      setIndex(nextIndex);
      setFading(false);
    }, 180);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setIndex((i) => {
        const nextIndex = (i + 1) % MAP_ADS.length;
        setFading(true);
        window.setTimeout(() => setFading(false), 180);
        return nextIndex;
      });
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const handleCta = () => {
    if (ad.id === 'salon' && onCtaSalon) {
      onCtaSalon();
      return;
    }
    if (ad.id === 'live' && onCtaLive) {
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
        className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${accentStyles[ad.accent]} shadow-lg shadow-black/20`}
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

        <div className="flex justify-center gap-1.5 pb-2">
          {MAP_ADS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index % MAP_ADS.length ? 'w-6 bg-white/90' : 'w-2.5 bg-white/35 hover:bg-white/55'
              }`}
              aria-label={`Publicité ${i + 1} sur ${MAP_ADS.length}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
