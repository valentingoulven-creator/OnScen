import { useCallback, useEffect, useRef, useState } from 'react';
import { type MapAd } from '../content/ads';
import { api } from '../lib/api';
import {
  handleSponsorCta,
  mapApiAdToMapAd,
  resolveMapAds,
  type MapSponsorViewport,
} from '../lib/sponsorAds';
import {
  getDisplayDurationMs,
  MAP_BANNER_CONTENT_CLASS,
  MAP_BANNER_IMAGE_CLASS,
  MAP_BANNER_SHELL_CLASS,
  resolveAccentGradientClass,
  SPONSOR_NEUTRAL_BANNER_BG,
} from '../lib/sponsorDisplaySpec';
import { resolveSponsorBannerSrc } from '../lib/sponsorBannerUpload';

export type { MapSponsorViewport };

interface MapAdBannerProps {
  viewport?: MapSponsorViewport | null;
  /** Onglet carte actif : refetch à chaque retour sur la carte. */
  isActive?: boolean;
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

function viewportQueryKey(viewport?: MapSponsorViewport | null): string {
  if (!viewport) return '';
  const parts: string[] = [];
  if (viewport.lat != null && Number.isFinite(viewport.lat)) parts.push(`lat:${viewport.lat.toFixed(4)}`);
  if (viewport.lng != null && Number.isFinite(viewport.lng)) parts.push(`lng:${viewport.lng.toFixed(4)}`);
  if (viewport.zoom != null && Number.isFinite(viewport.zoom)) parts.push(`zoom:${viewport.zoom.toFixed(2)}`);
  if (viewport.north != null && Number.isFinite(viewport.north)) parts.push(`north:${viewport.north.toFixed(4)}`);
  if (viewport.south != null && Number.isFinite(viewport.south)) parts.push(`south:${viewport.south.toFixed(4)}`);
  if (viewport.east != null && Number.isFinite(viewport.east)) parts.push(`east:${viewport.east.toFixed(4)}`);
  if (viewport.west != null && Number.isFinite(viewport.west)) parts.push(`west:${viewport.west.toFixed(4)}`);
  return parts.join('|');
}

function isBannerClickable(ad: MapAd): boolean {
  const action = ad.actionId ?? (ad.id === 'salon' ? 'salon' : ad.id === 'live' ? 'live' : undefined);
  return Boolean(action || ad.href);
}

function MapAdCarouselDots({
  ads,
  index,
  onSelect,
}: {
  ads: MapAd[];
  index: number;
  onSelect: (i: number) => void;
}) {
  if (ads.length <= 1) return null;
  return (
    <div className="flex justify-center gap-1.5 pb-2">
      {ads.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(i)}
          className={`h-1.5 rounded-full transition-all ${
            i === index % ads.length ? 'w-6 bg-white/90' : 'w-2.5 bg-white/35 hover:bg-white/55'
          }`}
          aria-label={`Publicité ${i + 1} sur ${ads.length}`}
        />
      ))}
    </div>
  );
}

function MapAdBannerImageOnly({
  ad,
  bannerSrc,
  fading,
  onActivate,
}: {
  ad: MapAd;
  bannerSrc: string;
  fading: boolean;
  onActivate: () => void;
}) {
  const clickable = isBannerClickable(ad);
  const sharedClass = `block ${MAP_BANNER_SHELL_CLASS} rounded-xl border border-white/10 shadow-lg shadow-black/20 transition-opacity duration-200 ${
    fading ? 'opacity-0' : 'opacity-100'
  } ${clickable ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60' : ''}`;

  const image = (
    <img
      src={bannerSrc}
      alt={ad.title || ad.sponsor || ''}
      className={MAP_BANNER_IMAGE_CLASS}
    />
  );

  if (clickable && ad.href && !ad.actionId && ad.id !== 'salon' && ad.id !== 'live') {
    return (
      <a
        key={ad.id}
        href={ad.href}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClass}
        aria-label={ad.title || ad.sponsor || 'Bandeau publicitaire'}
      >
        {image}
      </a>
    );
  }

  if (clickable) {
    return (
      <button
        key={ad.id}
        type="button"
        onClick={onActivate}
        className={`${sharedClass} p-0 bg-transparent text-left`}
        aria-label={ad.title || ad.sponsor || 'Bandeau publicitaire'}
      >
        {image}
      </button>
    );
  }

  return (
    <div key={ad.id} className={sharedClass}>
      {image}
    </div>
  );
}

function MapAdBannerFull({
  ad,
  bannerSrc,
  fading,
  onCta,
}: {
  ad: MapAd;
  bannerSrc: string;
  fading: boolean;
  onCta: () => void;
}) {
  const badgeLabel = ad.kind === 'sponsored' ? 'Sponsorisé' : 'Promo';
  const accentGradient = resolveAccentGradientClass(ad.accent);
  const bgClass = bannerSrc
    ? accentGradient
      ? ''
      : ''
    : accentGradient
      ? `bg-gradient-to-r ${accentGradient}`
      : `bg-gradient-to-r ${SPONSOR_NEUTRAL_BANNER_BG}`;

  return (
    <div
      className={`relative ${MAP_BANNER_SHELL_CLASS} rounded-xl border border-white/10 shadow-lg shadow-black/20 ${bgClass}`}
    >
      {bannerSrc ? (
        <>
          <img src={bannerSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {accentGradient ? (
            <div
              className={`absolute inset-0 bg-gradient-to-r ${accentGradient} opacity-75`}
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 bg-black/35" aria-hidden />
        </>
      ) : null}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="text-[13.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/25">
          {badgeLabel}
        </span>
        {ad.sponsor && (
          <span className="text-[13.5px] font-semibold text-white/55 truncate max-w-[9rem] sm:max-w-[12rem]">
            {ad.sponsor}
          </span>
        )}
      </div>

      <div
        key={ad.id}
        className={`${MAP_BANNER_CONTENT_CLASS} transition-opacity duration-200 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[19.5px] sm:text-[21px] font-bold text-white leading-tight truncate">{ad.title}</p>
          <p className="text-[15px] sm:text-[16.5px] text-white/85 mt-0.5 line-clamp-2 leading-snug">{ad.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className="shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-[15px] sm:text-[16.5px] font-bold text-white whitespace-nowrap"
        >
          {ad.cta}
        </button>
      </div>
    </div>
  );
}

export function MapAdBanner({ viewport, isActive = true, onCtaSalon, onCtaLive }: MapAdBannerProps) {
  const [ads, setAds] = useState<MapAd[]>([]);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    const generation = ++fetchGenerationRef.current;

    const load = () => {
      const hasBounds =
        viewport?.north != null &&
        viewport?.south != null &&
        viewport?.east != null &&
        viewport?.west != null &&
        Number.isFinite(viewport.north) &&
        Number.isFinite(viewport.south) &&
        Number.isFinite(viewport.east) &&
        Number.isFinite(viewport.west);

      const query =
        viewport?.lat != null &&
        viewport?.lng != null &&
        Number.isFinite(viewport.lat) &&
        Number.isFinite(viewport.lng)
          ? {
              lat: viewport.lat,
              lng: viewport.lng,
              zoom: viewport.zoom,
              ...(hasBounds
                ? {
                    north: viewport.north,
                    south: viewport.south,
                    east: viewport.east,
                    west: viewport.west,
                  }
                : {}),
            }
          : undefined;

      void api
        .getMapSponsors(query)
        .then((res) => {
          if (cancelled || generation !== fetchGenerationRef.current) return;
          const mapped = res.items.map(mapApiAdToMapAd);
          setAds(resolveMapAds(mapped, viewport));
          setIndex(0);
        })
        .catch(() => {
          if (cancelled || generation !== fetchGenerationRef.current) return;
          setAds(resolveMapAds(null, viewport));
        });
    };

    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(load, 250);

    return () => {
      cancelled = true;
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = null;
      }
    };
  }, [viewportQueryKey(viewport), isActive]);

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

  if (ads.length === 0) return null;

  const ad = ads[index % ads.length];
  const bannerSrc = ad.bannerImageUrl?.trim() ? resolveSponsorBannerSrc(ad.bannerImageUrl) : '';
  const isImageOnly = ad.bannerDisplayMode === 'image_only' && Boolean(bannerSrc);

  const handleActivate = () => {
    handleSponsorCta(ad, { onCtaSalon, onCtaLive });
  };

  return (
    <div
      className="shrink-0 z-10 px-0 pt-0 pb-1 pointer-events-auto"
      role="region"
      aria-label="Bandeau publicitaire"
    >
      {isImageOnly ? (
        <div className="relative">
          <MapAdBannerImageOnly
            ad={ad}
            bannerSrc={bannerSrc}
            fading={fading}
            onActivate={handleActivate}
          />
          <div className="absolute bottom-0 left-0 right-0">
            <MapAdCarouselDots ads={ads} index={index} onSelect={goTo} />
          </div>
        </div>
      ) : (
        <div className="relative">
          <MapAdBannerFull ad={ad} bannerSrc={bannerSrc} fading={fading} onCta={handleActivate} />
          <MapAdCarouselDots ads={ads} index={index} onSelect={goTo} />
        </div>
      )}
    </div>
  );
}
