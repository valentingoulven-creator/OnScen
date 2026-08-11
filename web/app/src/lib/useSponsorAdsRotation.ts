import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  mapApiAdToMapAd,
  resolvePlacementAds,
  type SponsorPlacementFetch,
} from './sponsorAds';
import { getDisplayDurationMs } from './sponsorDisplaySpec';
import { SPONSOR_PLACEMENT_BY_FETCH, trackSponsorImpression } from './sponsorTrack';

const SPONSOR_CAROUSEL_FADE_MS = 200;

const SPONSOR_FETCHERS = {
  map: () => api.getMapSponsors(),
  feed: () => api.getFeedSponsors(),
  stories: () => api.getStoriesSponsors(),
  salon: () => api.getSalonSponsors(),
} satisfies Record<SponsorPlacementFetch, () => Promise<{ items: import('../types').MapAdItem[] }>>;

export function useSponsorAdsRotation(placement: SponsorPlacementFetch) {
  const [ads, setAds] = useState(() => resolvePlacementAds(placement, null));
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    let cancelled = false;
    void SPONSOR_FETCHERS[placement]()
      .then((res) => {
        if (cancelled) return;
        const mapped = res.items.map(mapApiAdToMapAd);
        setAds(resolvePlacementAds(placement, mapped));
        setIndex(0);
      })
      .catch(() => {
        if (!cancelled) setAds(resolvePlacementAds(placement, null));
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  const count = ads.length || 0;
  const ad = count > 0 ? ads[index % count] : null;
  const lastImpressionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ad?.id) return;
    const key = `${ad.id}:${SPONSOR_PLACEMENT_BY_FETCH[placement]}`;
    if (lastImpressionRef.current === key) return;
    lastImpressionRef.current = key;
    trackSponsorImpression(ad.id, SPONSOR_PLACEMENT_BY_FETCH[placement]);
  }, [ad?.id, placement]);

  const goTo = useCallback((nextIndex: number) => {
    setFading(true);
    window.setTimeout(() => {
      setIndex(nextIndex);
      indexRef.current = nextIndex;
      setFading(false);
    }, SPONSOR_CAROUSEL_FADE_MS);
  }, []);

  useEffect(() => {
    if (ads.length <= 1) {
      setFading(false);
      return;
    }

    let cancelled = false;
    let rotateTimer: number | undefined;
    let fadeTimer: number | undefined;
    const startIndex = indexRef.current % ads.length;

    const scheduleNext = (currentIndex: number) => {
      if (cancelled) return;
      const currentAd = ads[currentIndex % ads.length];
      if (!currentAd) return;

      rotateTimer = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        fadeTimer = window.setTimeout(() => {
          if (cancelled) return;
          const nextIndex = (currentIndex + 1) % ads.length;
          setIndex(nextIndex);
          indexRef.current = nextIndex;
          setFading(false);
          scheduleNext(nextIndex);
        }, SPONSOR_CAROUSEL_FADE_MS);
      }, getDisplayDurationMs(currentAd.displayDurationSec));
    };

    scheduleNext(startIndex);
    return () => {
      cancelled = true;
      if (rotateTimer != null) clearTimeout(rotateTimer);
      if (fadeTimer != null) clearTimeout(fadeTimer);
    };
  }, [ads]);

  return { ads, ad, index, fading, goTo, hasAds: count > 0 };
}
