import { describe, expect, it } from 'vitest';

import { validateSponsorAdminForm, type SponsorAdminFormState } from './sponsorAdminForm';

const t = (key: string) => key;

function baseForm(overrides: Partial<SponsorAdminFormState> = {}): SponsorAdminFormState {
  return {
    name: 'Partner',
    bannerImageUrl: '',
    linkUrl: '',
    placement: 'map_banner',
    title: 'Title',
    subtitle: 'Subtitle',
    cta: 'Go',
    bannerDisplayMode: 'full',
    kind: 'promo',
    actionId: '',
    startsAt: '',
    endsAt: '',
    videoUrl: '',
    posterUrl: '',
    mapVisibilityScope: 'france',
    mapTargetRegionName: '',
    mapTargetLat: '',
    mapTargetLng: '',
    ...overrides,
  };
}

describe('validateSponsorAdminForm', () => {
  it('accepts map_banner france full mode with required copy', () => {
    expect(validateSponsorAdminForm(baseForm(), t)).toBeNull();
  });

  it('accepts map_banner region + image_only with banner and link', () => {
    expect(
      validateSponsorAdminForm(
        baseForm({
          bannerDisplayMode: 'image_only',
          bannerImageUrl: '/uploads/sponsors/banners/test.png',
          linkUrl: 'https://example.com',
          subtitle: '',
          cta: '',
          mapVisibilityScope: 'region',
          mapTargetRegionName: 'Le Crès',
          mapTargetLat: '43.6489',
          mapTargetLng: '3.8567',
        }),
        t
      )
    ).toBeNull();
  });

  it('allows empty optional schedule fields', () => {
    expect(validateSponsorAdminForm(baseForm({ startsAt: '', endsAt: '' }), t)).toBeNull();
  });

  it('rejects image_only without banner or link', () => {
    expect(
      validateSponsorAdminForm(
        baseForm({
          bannerDisplayMode: 'image_only',
          subtitle: '',
          cta: '',
        }),
        t
      )
    ).toBe('admin.sponsors.validationImageOnlyLinkRequired');

    expect(
      validateSponsorAdminForm(
        baseForm({
          bannerDisplayMode: 'image_only',
          linkUrl: 'https://example.com',
          subtitle: '',
          cta: '',
        }),
        t
      )
    ).toBe('admin.sponsors.validationBannerRequired');
  });

  it('rejects region scope without coordinates', () => {
    expect(
      validateSponsorAdminForm(
        baseForm({
          mapVisibilityScope: 'region',
          mapTargetRegionName: 'Le Crès',
        }),
        t
      )
    ).toBe('admin.sponsors.validationRegionCoordsRequired');
  });
});
