import { describe, expect, it } from 'vitest';
import { getFeedPostImageUrls } from './feedPostMedia';

describe('getFeedPostImageUrls', () => {
  it('returns imageUrls when present', () => {
    expect(getFeedPostImageUrls({ imageUrl: 'a', imageUrls: ['b', 'c'] })).toEqual(['b', 'c']);
  });

  it('falls back to imageUrl', () => {
    expect(getFeedPostImageUrls({ imageUrl: 'https://example.com/x.jpg' })).toEqual([
      'https://example.com/x.jpg',
    ]);
  });
});
