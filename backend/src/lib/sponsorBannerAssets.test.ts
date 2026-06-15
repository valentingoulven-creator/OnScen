import { describe, expect, it } from 'vitest';

import {
  isValidSponsorBannerUrl,
  saveSponsorBannerFromDataUrl,
} from './sponsorBannerAssets';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('sponsorBannerAssets', () => {
  it('accepts https and uploaded banner paths', () => {
    expect(isValidSponsorBannerUrl('https://example.com/banner.jpg')).toBe(true);
    expect(isValidSponsorBannerUrl('/uploads/sponsors/banners/abc123.jpg')).toBe(true);
    expect(isValidSponsorBannerUrl(TINY_PNG)).toBe(true);
    expect(isValidSponsorBannerUrl('/uploads/sponsors/logo.jpg')).toBe(false);
    expect(isValidSponsorBannerUrl('http://insecure.example/banner.png')).toBe(false);
  });

  it('saves data URL to banners uploads path', () => {
    const url = saveSponsorBannerFromDataUrl(TINY_PNG);
    expect(url).toMatch(/^\/uploads\/sponsors\/banners\/[a-f0-9]+\.png$/);
    expect(isValidSponsorBannerUrl(url)).toBe(true);
  });
});
