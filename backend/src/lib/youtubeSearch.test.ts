import { describe, expect, it } from 'vitest';
import { isCompleteYoutubeSearchResult } from './youtubeSearch';

describe('isCompleteYoutubeSearchResult', () => {
  const base = {
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  };

  it('accepts results with real title and artist', () => {
    expect(isCompleteYoutubeSearchResult(base)).toBe(true);
  });

  it('rejects generic placeholder titles', () => {
    expect(isCompleteYoutubeSearchResult({ ...base, title: 'Vidéo YouTube' })).toBe(false);
    expect(isCompleteYoutubeSearchResult({ ...base, title: 'Sans titre' })).toBe(false);
    expect(isCompleteYoutubeSearchResult({ ...base, title: '' })).toBe(false);
  });
});
