import { describe, expect, it } from 'vitest';

import {
  isValidSponsorLogoUrl,
  saveSponsorLogoFromDataUrl,
} from './sponsorLogoAssets';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('sponsorLogoAssets', () => {
  it('accepts https and uploaded paths', () => {
    expect(isValidSponsorLogoUrl('https://example.com/logo.png')).toBe(true);
    expect(isValidSponsorLogoUrl('/uploads/sponsors/abc123.jpg')).toBe(true);
    expect(isValidSponsorLogoUrl(TINY_PNG)).toBe(true);
    expect(isValidSponsorLogoUrl('http://insecure.example/logo.png')).toBe(false);
  });

  it('saves data URL to uploads path', () => {
    const url = saveSponsorLogoFromDataUrl(TINY_PNG);
    expect(url).toMatch(/^\/uploads\/sponsors\/[a-f0-9]+\.png$/);
    expect(isValidSponsorLogoUrl(url)).toBe(true);
  });
});
