import {
  DEFAULT_DISPLAY_DURATION_SEC,
  normalizeDisplayDurationSec,
  SPONSOR_DISPLAY_DURATION_MAX_SEC,
  SPONSOR_DISPLAY_DURATION_MIN_SEC,
} from './sponsorDisplaySpec';
import type {
  Sponsor,
  SponsorBannerDisplayMode,
  SponsorKind,
  SponsorMapVisibilityScope,
  SponsorPlacement,
} from '../types';

export const DEFAULT_SPONSOR_DISPLAY_DAYS = 7;
export const SPONSOR_DISPLAY_DAYS_MIN = 1;
export const SPONSOR_DISPLAY_DAYS_MAX = 365;

const MS_PER_DAY = 86_400_000;

export type SponsorAdminFormState = {
  name: string;
  description: string;
  bannerImageUrl: string;
  linkUrl: string;
  placement: SponsorPlacement;
  displayDays: string;
  displayDurationSec: string;
  mapVisibilityScope: SponsorMapVisibilityScope;
  mapTargetRegionName: string;
  mapTargetLat: string;
  mapTargetLng: string;
  /** Conservé pour l'édition ; défaut = maintenant à la création. */
  startsAt: string;
  videoUrl: string;
  posterUrl: string;
};

export function parseDatetimeLocal(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toDatetimeLocal(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowDatetimeLocal(): string {
  return toDatetimeLocal(Date.now());
}

export function parseDisplayDays(raw: string, fallback = DEFAULT_SPONSOR_DISPLAY_DAYS): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(SPONSOR_DISPLAY_DAYS_MAX, Math.max(SPONSOR_DISPLAY_DAYS_MIN, Math.floor(n)));
}

export function computeDisplayDays(startsAt?: number, endsAt?: number): number {
  if (endsAt == null) return DEFAULT_SPONSOR_DISPLAY_DAYS;
  const start = startsAt ?? Date.now();
  if (endsAt <= start) return DEFAULT_SPONSOR_DISPLAY_DAYS;
  return Math.max(SPONSOR_DISPLAY_DAYS_MIN, Math.round((endsAt - start) / MS_PER_DAY));
}

function parseOptionalCoordField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function emptySponsorAdminForm(placement: SponsorPlacement): SponsorAdminFormState {
  return {
    name: '',
    description: '',
    bannerImageUrl: '',
    linkUrl: '',
    placement,
    displayDays: String(DEFAULT_SPONSOR_DISPLAY_DAYS),
    displayDurationSec: String(DEFAULT_DISPLAY_DURATION_SEC),
    mapVisibilityScope: 'france',
    mapTargetRegionName: '',
    mapTargetLat: '',
    mapTargetLng: '',
    startsAt: nowDatetimeLocal(),
    videoUrl: '',
    posterUrl: '',
  };
}

export function sponsorToAdminForm(sponsor: Sponsor): SponsorAdminFormState {
  return {
    name: sponsor.name,
    description: sponsor.subtitle ?? '',
    bannerImageUrl: sponsor.bannerImageUrl ?? '',
    linkUrl: sponsor.linkUrl ?? '',
    placement: sponsor.placement,
    displayDays: String(computeDisplayDays(sponsor.startsAt, sponsor.endsAt)),
    displayDurationSec: String(
      normalizeDisplayDurationSec(sponsor.displayDurationSec, DEFAULT_DISPLAY_DURATION_SEC)
    ),
    mapVisibilityScope: sponsor.mapVisibilityScope ?? 'france',
    mapTargetRegionName: sponsor.mapTargetRegionName ?? '',
    mapTargetLat: sponsor.mapTargetLat != null ? String(sponsor.mapTargetLat) : '',
    mapTargetLng: sponsor.mapTargetLng != null ? String(sponsor.mapTargetLng) : '',
    startsAt: toDatetimeLocal(sponsor.startsAt) || nowDatetimeLocal(),
    videoUrl: sponsor.videoUrl ?? '',
    posterUrl: sponsor.posterUrl ?? '',
  };
}

export function buildSponsorPayloadFromAdminForm(form: SponsorAdminFormState): Partial<Sponsor> {
  const name = form.name.trim();
  const placement = form.placement;
  const isMap = placement === 'map_banner';
  const bannerDisplayMode: SponsorBannerDisplayMode = isMap ? 'image_only' : 'full';
  const kind: SponsorKind = 'sponsored';

  const startsAt = parseDatetimeLocal(form.startsAt) ?? Date.now();
  const displayDays = parseDisplayDays(form.displayDays);
  const endsAt = startsAt + displayDays * MS_PER_DAY;

  const description = form.description.trim();

  const payload: Partial<Sponsor> = {
    name,
    linkUrl: form.linkUrl.trim() || undefined,
    placement,
    title: name,
    subtitle: description || name,
    cta: isMap ? 'Voir' : 'En savoir plus',
    accent: isMap ? (null as unknown as Sponsor['accent']) : 'purple',
    kind,
    bannerDisplayMode,
    displayDurationSec: normalizeDisplayDurationSec(form.displayDurationSec),
    startsAt,
    endsAt,
    videoUrl: form.videoUrl.trim() || undefined,
    posterUrl: form.posterUrl.trim() || undefined,
  };

  if (isMap) {
    payload.mapVisibilityScope = form.mapVisibilityScope;
    payload.bannerImageUrl = form.bannerImageUrl.trim() || undefined;
    if (form.mapVisibilityScope === 'region') {
      payload.mapTargetRegionName = form.mapTargetRegionName.trim() || undefined;
      payload.mapTargetLat = parseOptionalCoordField(form.mapTargetLat);
      payload.mapTargetLng = parseOptionalCoordField(form.mapTargetLng);
    } else {
      payload.mapTargetRegionName = undefined;
      payload.mapTargetLat = undefined;
      payload.mapTargetLng = undefined;
    }
  }

  return payload;
}

export function validateSponsorAdminForm(
  form: SponsorAdminFormState,
  t: (key: string) => string
): string | null {
  const name = form.name.trim();
  if (!name) return t('admin.sponsors.validationNameRequired');

  if (!form.linkUrl.trim()) {
    return t('admin.sponsors.validationLinkRequired');
  }

  if (form.placement === 'map_banner' && !form.bannerImageUrl.trim()) {
    return t('admin.sponsors.validationBannerRequired');
  }

  if (form.placement === 'map_banner' && form.mapVisibilityScope === 'region') {
    if (!form.mapTargetRegionName.trim()) {
      return t('admin.sponsors.validationRegionNameRequired');
    }
    const lat = parseOptionalCoordField(form.mapTargetLat);
    const lng = parseOptionalCoordField(form.mapTargetLng);
    if (
      lat == null ||
      lng == null ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return t('admin.sponsors.validationRegionCoordsRequired');
    }
  }

  if (
    (form.placement === 'reels_sponsored' || form.placement === 'stories_sponsored') &&
    !form.videoUrl.trim() &&
    !form.posterUrl.trim()
  ) {
    return t('admin.sponsors.validationReelsMediaRequired');
  }

  const days = Number(form.displayDays);
  if (!Number.isFinite(days) || days < SPONSOR_DISPLAY_DAYS_MIN || days > SPONSOR_DISPLAY_DAYS_MAX) {
    return t('admin.sponsors.validationDisplayDays');
  }

  const sec = Number(form.displayDurationSec);
  if (
    !Number.isFinite(sec) ||
    sec < SPONSOR_DISPLAY_DURATION_MIN_SEC ||
    sec > SPONSOR_DISPLAY_DURATION_MAX_SEC
  ) {
    return t('admin.sponsors.validationDisplayDuration');
  }

  return null;
}
