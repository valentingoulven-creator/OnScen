import { describe, expect, it } from 'vitest';

import {
  buildSponsorPayloadFromAdminForm,
  computeDisplayDays,
  validateSponsorAdminForm,
  type SponsorAdminFormState,
} from './sponsorAdminForm';

const t = (key: string) => key;

function baseForm(overrides: Partial<SponsorAdminFormState> = {}): SponsorAdminFormState {
  return {
    name: 'Partner',
    description: 'Description du partenaire',
    logoUrl: '',
    bannerImageUrl: '/uploads/sponsors/banners/test.png',
    linkUrl: 'https://example.com',
    placement: 'map_banner',
    displayDays: '7',
    displayDurationSec: '8',
    mapVisibilityScope: 'france',
    mapTargetRegionName: '',
    mapTargetLat: '',
    mapTargetLng: '',
    startsAt: '2026-06-22T10:00',
    videoUrl: '',
    posterUrl: '',
    linkedEventPostId: '',
    ...overrides,
  };
}

describe('validateSponsorAdminForm', () => {
  it('accepts map_banner france with link and banner', () => {
    expect(validateSponsorAdminForm(baseForm(), t)).toBeNull();
  });

  it('accepts map_banner region with autocomplete coords', () => {
    expect(
      validateSponsorAdminForm(
        baseForm({
          mapVisibilityScope: 'region',
          mapTargetRegionName: 'Le Crès',
          mapTargetLat: '43.6489',
          mapTargetLng: '3.8567',
        }),
        t
      )
    ).toBeNull();
  });

  it('rejects missing link', () => {
    expect(validateSponsorAdminForm(baseForm({ linkUrl: '' }), t)).toBe(
      'admin.sponsors.validationLinkRequired'
    );
  });

  it('rejects map_banner without banner image', () => {
    expect(validateSponsorAdminForm(baseForm({ bannerImageUrl: '' }), t)).toBe(
      'admin.sponsors.validationBannerRequired'
    );
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

describe('buildSponsorPayloadFromAdminForm', () => {
  it('sets image-only map banner defaults and campaign end from display days', () => {
    const payload = buildSponsorPayloadFromAdminForm(baseForm({ displayDays: '14', displayDurationSec: '12' }));
    expect(payload.title).toBe('Partner');
    expect(payload.subtitle).toBe('Description du partenaire');
    expect(payload.bannerDisplayMode).toBe('image_only');
    expect(payload.displayDurationSec).toBe(12);
    expect(payload.linkUrl).toBe('https://example.com');
    expect(payload.startsAt).toBeDefined();
    expect(payload.endsAt).toBeDefined();
    expect(payload.endsAt! - payload.startsAt!).toBe(14 * 86_400_000);
  });
});

describe('computeDisplayDays', () => {
  it('derives days from start and end timestamps', () => {
    const start = Date.parse('2026-06-01T00:00:00');
    const end = start + 10 * 86_400_000;
    expect(computeDisplayDays(start, end)).toBe(10);
  });
});
