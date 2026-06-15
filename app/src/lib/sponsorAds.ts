import { MAP_ADS, type MapAd } from '../content/ads';
import { isInMapBounds, type MapBounds } from './mapMarkerVisibility';

import type { MapAdItem } from '../types';

export type SponsorPlacementFetch = 'map' | 'feed' | 'stories';

export type MapSponsorViewport = {
  lat?: number;
  lng?: number;
  zoom?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

/** Marge optionnelle sur les bounds viewport (degrés) pour les villes en bord de carte. */
export const MAP_SPONSOR_BOUNDS_PADDING_DEG = 0.01;

/** Aligné sur backend/src/lib/sponsors.ts */
export const MAP_REGION_MIN_ZOOM = 8;

export function mapApiAdToMapAd(item: MapAdItem): MapAd {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    cta: item.cta,
    href: item.href,
    accent: item.accent,
    bannerDisplayMode: item.bannerDisplayMode,
    sponsor: item.sponsor,
    kind: item.kind,
    logoUrl: item.logoUrl,
    bannerImageUrl: item.bannerImageUrl,
    actionId: item.actionId,
    displayDurationSec: item.displayDurationSec,
  };
}

/** Filtre client des bandeaux carte (repli statique msdev). */
export function filterMapAdsByViewport(
  ads: MapAd[],
  viewport?: MapSponsorViewport | null
): MapAd[] {
  return ads.filter((ad) => isMapAdVisibleOnViewport(ad, viewport));
}

function parseViewportBounds(viewport?: MapSponsorViewport | null): MapBounds | null {
  if (!viewport) return null;
  const { north, south, east, west } = viewport;
  if (
    north == null ||
    south == null ||
    east == null ||
    west == null ||
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    return null;
  }
  return { north, south, east, west };
}

function expandViewportBounds(bounds: MapBounds): MapBounds {
  const pad = MAP_SPONSOR_BOUNDS_PADDING_DEG;
  return {
    north: bounds.north + pad,
    south: bounds.south - pad,
    east: bounds.east + pad,
    west: bounds.west - pad,
  };
}

function isMapAdVisibleOnViewport(ad: MapAd, viewport?: MapSponsorViewport | null): boolean {
  const scope = ad.mapVisibilityScope ?? 'france';
  if (scope === 'france') return true;

  const zoom = viewport?.zoom;
  if (zoom == null || !Number.isFinite(zoom) || zoom < MAP_REGION_MIN_ZOOM) {
    return false;
  }

  const bounds = parseViewportBounds(viewport);
  if (!bounds) return false;

  const lat = ad.mapTargetLat;
  const lng = ad.mapTargetLng;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return isInMapBounds(lat, lng, expandViewportBounds(bounds));
}

/**
 * Utilise les sponsors API ou retombe sur les bandeaux statiques msdev.
 * - `items === []` : réponse API vide (ex. tous désactivés) → pas de repli.
 * - `items == null` : erreur / chargement → repli filtré par viewport.
 */
export function resolveMapAds(
  items: MapAd[] | undefined | null,
  viewport?: MapSponsorViewport | null
): MapAd[] {
  if (items && items.length > 0) return items;
  if (Array.isArray(items) && items.length === 0) return [];
  return filterMapAdsByViewport(MAP_ADS, viewport);
}

export function resolvePlacementAds(
  placement: SponsorPlacementFetch,
  items: MapAd[] | undefined | null,
  viewport?: MapSponsorViewport | null
): MapAd[] {
  if (items && items.length > 0) return items;
  if (Array.isArray(items) && items.length === 0) return [];
  return placement === 'map' ? filterMapAdsByViewport(MAP_ADS, viewport) : [];
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
