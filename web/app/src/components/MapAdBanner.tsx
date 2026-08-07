import { useEffect, useRef, useState } from 'react';
import { type MapAd } from '../content/ads';
import { api } from '../lib/api';
import {
  handleSponsorCta,
  mapApiAdToMapAd,
  resolveMapAds,
  type MapSponsorViewport,
} from '../lib/sponsorAds';
import { trackSponsorImpression } from '../lib/sponsorTrack';
import {
  getMapBannerDisplayDurationMs,
  MAP_BANNER_CONTENT_CLASS,
  MAP_BANNER_IMAGE_CLASS,
  MAP_BANNER_SHELL_CLASS,
  resolveAccentGradientClass,
  SPONSOR_NEUTRAL_BANNER_BG,
} from '../lib/sponsorDisplaySpec';
import {
  areMapSponsorAdListsEqual,
  buildMapSponsorViewportFetchKey,
} from '../lib/sponsorMapViewport';
import { resolveSponsorBannerSrc } from '../lib/sponsorBannerUpload';

export type { MapSponsorViewport };

interface MapAdBannerProps {
  viewport?: MapSponsorViewport | null;
  /** Onglet carte actif : refetch à chaque retour sur la carte. */
  isActive?: boolean;
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

/** Attente avant refetch après déplacement carte (ms). */
const MAP_SPONSOR_FETCH_DEBOUNCE_MS = 2000;

function isBannerClickable(ad: MapAd): boolean {
  const action = ad.actionId ?? (ad.id === 'salon' ? 'salon' : ad.id === 'live' ? 'live' : undefined);
  return Boolean(action || ad.href);
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
      loading="lazy"
      decoding="async"
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

const ACCENT_BADGE_CLASS: Partial<Record<NonNullable<MapAd['accent']>, string>> = {
  amber: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
  cyan: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-400/25',
  pink: 'bg-pink-500/15 text-pink-300 border-pink-400/25',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
};

const ACCENT_CTA_CLASS: Partial<Record<NonNullable<MapAd['accent']>, string>> = {
  amber: 'bg-amber-500/20 hover:bg-amber-400/30 border-amber-400/35 text-white',
  cyan: 'bg-cyan-500/25 hover:bg-cyan-400/40 border-cyan-300/45 text-white',
  purple: 'bg-purple-500/20 hover:bg-purple-400/30 border-purple-400/35 text-white',
  pink: 'bg-pink-500/20 hover:bg-pink-400/30 border-pink-400/35 text-white',
  rose: 'bg-rose-500/20 hover:bg-rose-400/30 border-rose-400/35 text-white',
};

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
    ? ''
    : accentGradient
      ? `bg-gradient-to-r ${accentGradient}`
      : `bg-gradient-to-r ${SPONSOR_NEUTRAL_BANNER_BG}`;

  const badgeColorClass =
    ad.accent
      ? (ACCENT_BADGE_CLASS[ad.accent] ?? 'bg-amber-500/15 text-amber-300 border-amber-400/25')
      : 'bg-white/10 text-white/60 border-white/20';

  const ctaColorClass =
    ad.accent
      ? (ACCENT_CTA_CLASS[ad.accent] ?? 'bg-white/15 hover:bg-white/25 border-white/20 text-white')
      : 'bg-white/15 hover:bg-white/25 border-white/20 text-white';

  return (
    <div
      className={`relative ${MAP_BANNER_SHELL_CLASS} rounded-xl border border-white/10 shadow-lg shadow-black/20 ${bgClass}`}
    >
      {bannerSrc ? (
        <>
          <img
            src={bannerSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {accentGradient ? (
            <div
              className={`absolute inset-0 bg-gradient-to-r ${accentGradient} opacity-70`}
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 bg-black/30" aria-hidden />
        </>
      ) : null}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className={`text-[13.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColorClass}`}>
          {badgeLabel}
        </span>
        {ad.sponsor && (
          <span className="text-[13.5px] font-semibold text-white/60 truncate max-w-[9rem] sm:max-w-[12rem]">
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
          className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-[15px] sm:text-[16.5px] font-bold whitespace-nowrap ${ctaColorClass}`}
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
  const adsRef = useRef(ads);
  adsRef.current = ads;
  const viewportKey = buildMapSponsorViewportFetchKey(viewport);
  const adsRotationKey = ads.map((a) => a.id).join(',');

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
          const nextAds = resolveMapAds(mapped, viewport);
          setAds((prev) => {
            if (areMapSponsorAdListsEqual(prev, nextAds)) return prev;
            setIndex(0);
            return nextAds;
          });
        })
        .catch(() => {
          if (cancelled || generation !== fetchGenerationRef.current) return;
          const nextAds = resolveMapAds(null, viewport);
          setAds((prev) => {
            if (areMapSponsorAdListsEqual(prev, nextAds)) return prev;
            setIndex(0);
            return nextAds;
          });
        });
    };

    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(load, MAP_SPONSOR_FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = null;
      }
    };
  }, [viewportKey, isActive, viewport]);

  useEffect(() => {
    if (!adsRotationKey || ads.length <= 1) return;
    let cancelled = false;
    let timer: number | undefined;
    const list = adsRef.current;

    const scheduleNext = (currentIndex: number) => {
      if (cancelled) return;
      const currentAd = list[currentIndex % list.length];
      if (!currentAd) return;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        window.setTimeout(() => setFading(false), 180);
        setIndex((i) => {
          const nextIndex = (i + 1) % list.length;
          scheduleNext(nextIndex);
          return nextIndex;
        });
      }, getMapBannerDisplayDurationMs(currentAd.displayDurationSec));
    };

    scheduleNext(0);
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [adsRotationKey, ads.length]);

  const visibleAd = ads.length > 0 ? ads[index % ads.length] : null;

  useEffect(() => {
    if (visibleAd?.id) trackSponsorImpression(visibleAd.id, 'map_banner');
  }, [visibleAd?.id]);

  if (ads.length === 0 || !visibleAd) return null;

  const ad = visibleAd;
  const bannerSrc = ad.bannerImageUrl?.trim() ? resolveSponsorBannerSrc(ad.bannerImageUrl) : '';
  const isImageOnly = ad.bannerDisplayMode === 'image_only' && Boolean(bannerSrc);

  const handleActivate = () => {
    handleSponsorCta(ad, { onCtaSalon, onCtaLive }, { placement: 'map_banner' });
  };

  return (
    <div
      className="shrink-0 z-10 px-0 pt-0 pb-1 pointer-events-auto"
      role="region"
      aria-label="Bandeau publicitaire"
    >
      {isImageOnly ? (
        <MapAdBannerImageOnly
          ad={ad}
          bannerSrc={bannerSrc}
          fading={fading}
          onActivate={handleActivate}
        />
      ) : (
        <MapAdBannerFull ad={ad} bannerSrc={bannerSrc} fading={fading} onCta={handleActivate} />
      )}
    </div>
  );
}
