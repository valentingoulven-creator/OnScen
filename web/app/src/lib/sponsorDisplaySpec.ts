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

/** Fond neutre quand aucun accent n'est défini (bandeau carte mode full). */
export const SPONSOR_NEUTRAL_BANNER_BG = 'from-[#1a1a26] to-[#0b0b0f]';

/** Bandeau carte : 90 px mobile, 96 px desktop, plafond 105 px, pleine largeur. */
export const MAP_BANNER_SHELL_CLASS =
  'w-full max-w-full h-[5.625rem] sm:h-[6rem] max-h-[6.5625rem] overflow-hidden';
export const MAP_BANNER_IMAGE_CLASS = 'w-full h-full object-cover object-center';
export const MAP_BANNER_CONTENT_CLASS =
  'relative z-10 flex items-center gap-3 px-4 py-2 pt-7 sm:pt-8 h-full min-h-0 overflow-hidden';

/** Image source recommandée (1×) et export rognage (2× retina), ratio 20:3 (= 640:96). */
export const MAP_BANNER_IMAGE_W = 640;
export const MAP_BANNER_IMAGE_H = 96;
export const MAP_BANNER_EXPORT_W = 1280;
export const MAP_BANNER_EXPORT_H = 192;
export const MAP_BANNER_CROP_VIEWPORT_W = 320;
export const MAP_BANNER_CROP_VIEWPORT_H = 48;
export const MAP_BANNER_ASPECT_RATIO = '20:3';

export function resolveAccentGradientClass(accent?: SponsorAccent): string | null {
  if (!accent) return null;
  return SPONSOR_ACCENT_GRADIENTS[accent] ?? null;
}

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
    bannerPx: `${MAP_BANNER_IMAGE_W} × ${MAP_BANNER_IMAGE_H} px (recommandé), ${MAP_BANNER_EXPORT_W} × ${MAP_BANNER_EXPORT_H} px (retina @2×)`,
    ratio: `${MAP_BANNER_ASPECT_RATIO} (pleine largeur · coque 90 px mobile, 96 px desktop, max. 105 px)`,
    noteKey: 'admin.sponsors.helpImageMapBanner',
  },
  map_sidebar_events: {
    logoPx: '— (carte événement)',
    bannerPx: '— (image de la publication événement)',
    noteKey: 'admin.sponsors.helpImageMapSidebarEvents',
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
  stories_sponsored: {
    logoPx: '64 × 64 px',
    bannerPx: '1080 × 1920 px (9:16)',
    ratio: '9:16 plein écran',
    noteKey: 'admin.sponsors.helpImageStoriesSponsored',
  },
  reels_sponsored: {
    logoPx: '64 × 64 px',
    bannerPx: '1080 × 1920 px (9:16)',
    ratio: '9:16 plein écran',
    noteKey: 'admin.sponsors.helpImageReelsSponsored',
  },
  salon_theater: {
    logoPx: '40 × 40 px',
    bannerPx: '— (bandeau texte compact)',
    noteKey: 'admin.sponsors.helpImageSalonTheater',
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
