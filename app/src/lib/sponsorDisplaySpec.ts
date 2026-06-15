import type { SponsorAccent, SponsorKind, SponsorPlacement } from '../types';

/** Durée par défaut du carrousel bandeau carte (MapAdBanner ROTATE_MS). */
export const DEFAULT_DISPLAY_DURATION_SEC = 8;
export const DEFAULT_DISPLAY_DURATION_MS = DEFAULT_DISPLAY_DURATION_SEC * 1000;

export const SPONSOR_DISPLAY_DURATION_MIN_SEC = 3;
export const SPONSOR_DISPLAY_DURATION_MAX_SEC = 60;

export const SPONSOR_ACCENT_GRADIENTS: Record<SponsorAccent, string> = {
  purple: 'from-purple-600/90 via-violet-700/80 to-purple-900/90',
  pink: 'from-pink-600/90 via-fuchsia-700/80 to-purple-900/90',
  amber: 'from-amber-500/90 via-orange-600/80 to-amber-900/90',
  cyan: 'from-cyan-600/90 via-teal-600/80 to-indigo-900/90',
  rose: 'from-rose-600/90 via-pink-700/80 to-purple-900/90',
};

export type SponsorImageSpec = {
  logoPx: string;
  bannerPx?: string;
  ratio?: string;
  noteKey: string;
};

/** Dimensions recommandées dérivées du CSS réel (MapAdBanner + admin). */
export const SPONSOR_IMAGE_SPECS: Record<SponsorPlacement, SponsorImageSpec> = {
  map_banner: {
    logoPx: '80 × 80 px',
    bannerPx: '360 × 90 px min. (mobile), 640 × 96 px min. (≥640 px)',
    ratio: '4:1 environ (pleine largeur, hauteur min. 90–96 px)',
    noteKey: 'admin.sponsors.helpImageMapBanner',
  },
  feed_inline: {
    logoPx: '48 × 48 px',
    bannerPx: '343 × 120 px',
    ratio: '≈ 2,9:1',
    noteKey: 'admin.sponsors.helpImageFeedInline',
  },
  stories_banner: {
    logoPx: '32 × 32 px',
    bannerPx: '390 × 56 px',
    ratio: '≈ 7:1',
    noteKey: 'admin.sponsors.helpImageStoriesBanner',
  },
  reels_sponsored: {
    logoPx: '64 × 64 px',
    bannerPx: '1080 × 1920 px (9:16)',
    ratio: '9:16 plein écran',
    noteKey: 'admin.sponsors.helpImageReelsSponsored',
  },
};

export function normalizeDisplayDurationSec(raw: unknown, fallback = DEFAULT_DISPLAY_DURATION_SEC): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    SPONSOR_DISPLAY_DURATION_MAX_SEC,
    Math.max(SPONSOR_DISPLAY_DURATION_MIN_SEC, Math.floor(n))
  );
}

export function getDisplayDurationMs(displayDurationSec?: number): number {
  return normalizeDisplayDurationSec(displayDurationSec) * 1000;
}

export function sponsorKindBadgeLabel(kind: SponsorKind): string {
  return kind === 'sponsored' ? 'Sponsorisé' : 'Promo';
}
