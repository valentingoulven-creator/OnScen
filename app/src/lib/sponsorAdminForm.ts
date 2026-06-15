import type {
  SponsorBannerDisplayMode,
  SponsorKind,
  SponsorMapVisibilityScope,
  SponsorPlacement,
} from '../types';

export type SponsorAdminFormState = {
  name: string;
  bannerImageUrl: string;
  linkUrl: string;
  placement: SponsorPlacement;
  title: string;
  subtitle: string;
  cta: string;
  bannerDisplayMode: SponsorBannerDisplayMode;
  kind: SponsorKind;
  actionId: '' | 'salon' | 'live';
  startsAt: string;
  endsAt: string;
  videoUrl: string;
  posterUrl: string;
  mapVisibilityScope: SponsorMapVisibilityScope;
  mapTargetRegionName: string;
  mapTargetLat: string;
  mapTargetLng: string;
};

function parseDatetimeLocal(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalCoordField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateSponsorAdminForm(
  form: SponsorAdminFormState,
  t: (key: string) => string
): string | null {
  const name = form.name.trim();
  if (!name) return t('admin.sponsors.validationNameRequired');

  const isMapImageOnly =
    form.placement === 'map_banner' && form.bannerDisplayMode === 'image_only';

  const title = form.title.trim();
  const subtitle = form.subtitle.trim();
  const cta = form.cta.trim();

  if (!isMapImageOnly && (!title || !subtitle || !cta)) {
    return t('admin.sponsors.validationCopyRequired');
  }
  if (isMapImageOnly && !title) {
    return t('admin.sponsors.validationTitleRequired');
  }

  const linkUrl = form.linkUrl.trim();
  const actionId =
    form.actionId === 'salon' || form.actionId === 'live' ? form.actionId : undefined;

  if (isMapImageOnly && !linkUrl && !actionId) {
    return t('admin.sponsors.validationImageOnlyLinkRequired');
  }

  if (isMapImageOnly && !form.bannerImageUrl.trim()) {
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

  if (form.placement === 'reels_sponsored' && !form.videoUrl.trim() && !form.posterUrl.trim()) {
    return t('admin.sponsors.validationReelsMediaRequired');
  }

  const startsAt = parseDatetimeLocal(form.startsAt);
  const endsAt = parseDatetimeLocal(form.endsAt);
  if (startsAt != null && endsAt != null && endsAt <= startsAt) {
    return t('admin.sponsors.validationEndAfterStart');
  }

  return null;
}
