import { describe, expect, it } from 'vitest';
import { canUploadSponsorAsset } from './sponsorUploadAuth';

describe('canUploadSponsorAsset', () => {
  it('allows upload when session is ready and not uploading', () => {
    expect(canUploadSponsorAsset(true, false)).toBe(true);
  });

  it('blocks when session is missing', () => {
    expect(canUploadSponsorAsset(false, false)).toBe(false);
  });

  it('blocks while uploading', () => {
    expect(canUploadSponsorAsset(true, true)).toBe(false);
  });
});
