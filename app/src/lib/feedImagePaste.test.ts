import { describe, expect, it } from 'vitest';
import { FEED_IMAGE_MAX_DATA_CHARS } from './feedImagePaste';

describe('feedImagePaste', () => {
  it('exports a max payload size aligned with backend', () => {
    expect(FEED_IMAGE_MAX_DATA_CHARS).toBe(400_000);
  });
});
