import { describe, expect, it } from 'vitest';
import {
  getFeedPostImageUrls,
  getFeedPostNonYoutubeImageUrls,
  parseYoutubeThumbnailVideoId,
  resolveFeedPostNativeVideoUrl,
  resolveFeedPostYoutubeVideoId,
} from './feedPostMedia';

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

describe('parseYoutubeThumbnailVideoId', () => {
  it('extracts id from img.youtube.com thumbnail', () => {
    expect(parseYoutubeThumbnailVideoId('https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg')).toBe(
      'fJ9rUzIMcZQ'
    );
  });

  it('extracts id from i.ytimg.com thumbnail', () => {
    expect(parseYoutubeThumbnailVideoId('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('returns null for regular images', () => {
    expect(parseYoutubeThumbnailVideoId('https://example.com/photo.jpg')).toBeNull();
  });
});

describe('resolveFeedPostYoutubeVideoId', () => {
  it('resolves from YouTube thumbnail in imageUrl', () => {
    expect(
      resolveFeedPostYoutubeVideoId({
        imageUrl: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
      })
    ).toBe('fJ9rUzIMcZQ');
  });

  it('prefers videoUrl when it is a YouTube link', () => {
    expect(
      resolveFeedPostYoutubeVideoId({
        videoUrl: 'https://www.youtube.com/watch?v=abc123_-xyz',
        imageUrl: 'https://img.youtube.com/vi/other000000/hqdefault.jpg',
      })
    ).toBe('abc123_-xyz');
  });
});

describe('getFeedPostNonYoutubeImageUrls', () => {
  it('filters out YouTube thumbnails', () => {
    expect(
      getFeedPostNonYoutubeImageUrls({
        imageUrls: [
          'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
          'https://cdn.example.com/photo.jpg',
        ],
      })
    ).toEqual(['https://cdn.example.com/photo.jpg']);
  });
});

describe('resolveFeedPostNativeVideoUrl', () => {
  it('returns native video url', () => {
    expect(resolveFeedPostNativeVideoUrl({ videoUrl: 'https://cdn.example.com/clip.mp4' })).toBe(
      'https://cdn.example.com/clip.mp4'
    );
  });

  it('excludes YouTube links', () => {
    expect(
      resolveFeedPostNativeVideoUrl({ videoUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ' })
    ).toBeNull();
  });
});
