import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  mapApiAdToMapAd,
  resolvePlacementAds,
  type SponsorPlacementFetch,
} from './sponsorAds';
import { getDisplayDurationMs } from './sponsorDisplaySpec';
import { SPONSOR_PLACEMENT_BY_FETCH, trackSponsorImpression } from './sponsorTrack';

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

  return { ads, ad, index, fading, goTo, hasAds: count > 0 };
}
