import { MAP_ADS, type MapAd } from '../content/ads';
import type { MapAdItem } from '../types';

export type SponsorPlacementFetch = 'map' | 'feed' | 'stories';

export function mapApiAdToMapAd(item: MapAdItem): MapAd {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    cta: item.cta,
    href: item.href,
    accent: item.accent,
    sponsor: item.sponsor,
    kind: item.kind,
    logoUrl: item.logoUrl,
    actionId: item.actionId,
    displayDurationSec: item.displayDurationSec,
  };
}

/** Utilise les sponsors API ou retombe sur les bandeaux statiques msdev. */
export function resolveMapAds(items: MapAd[] | undefined | null): MapAd[] {
  if (items && items.length > 0) return items;
  return MAP_ADS;
}

export function resolvePlacementAds(
  placement: SponsorPlacementFetch,
  items: MapAd[] | undefined | null
): MapAd[] {
  if (items && items.length > 0) return items;
  return placement === 'map' ? MAP_ADS : [];
}

export function handleSponsorCta(
  ad: MapAd,
  handlers?: { onCtaSalon?: () => void; onCtaLive?: () => void }
): void {
  const action = ad.actionId ?? (ad.id === 'salon' ? 'salon' : ad.id === 'live' ? 'live' : undefined);
  if (action === 'salon' && handlers?.onCtaSalon) {
    handlers.onCtaSalon();
    return;
  }
  if (action === 'live' && handlers?.onCtaLive) {
    handlers.onCtaLive();
    return;
  }
  if (ad.href) {
    window.open(ad.href, '_blank', 'noopener,noreferrer');
  }
}
