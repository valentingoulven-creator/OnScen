import { describe, expect, it } from 'vitest';
import {
  isValidYoutubeVideoId,
  parseMusicLink,
  parseYoutubePlaylistId,
  resolveYoutubePlaylistId,
} from './musicLinks';

describe('parseMusicLink (youtube)', () => {
  it('extracts id from watch URL', () => {
    expect(parseMusicLink('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      trackId: 'dQw4w9WgXcQ',
    });
  });

  it('accepts bare video id (6+ chars)', () => {
    expect(parseMusicLink('youtube', 'dQw4w9WgXcQ')).toEqual({ trackId: 'dQw4w9WgXcQ' });
  });

  it('rejects short search terms like artist names', () => {
    expect(parseMusicLink('youtube', 'gims')).toBeNull();
    expect(parseMusicLink('youtube', 'abc')).toBeNull();
    expect(isValidYoutubeVideoId('gims')).toBe(false);
  });
});

describe('parseYoutubePlaylistId', () => {
  it('extracts list id from playlist URL', () => {
    expect(
      parseYoutubePlaylistId('https://www.youtube.com/playlist?list=PL4fGSIoZAXrht3x3hSL-hVZMeiqXqQ-9')
    ).toBe('PL4fGSIoZAXrht3x3hSL-hVZMeiqXqQ-9');
  });

  it('extracts list id from watch URL with list param', () => {
    expect(
      parseYoutubePlaylistId('https://www.youtube.com/watch?v=abc123&list=PLabc123xyz')
    ).toBe('PLabc123xyz');
  });

  it('accepts bare PL id', () => {
    expect(parseYoutubePlaylistId('PLabc123xyz')).toBe('PLabc123xyz');
  });
});

describe('resolveYoutubePlaylistId', () => {
  it('resolves pasted playlist URLs for load-playlist', () => {
    const url = 'https://youtube.com/playlist?list=PL4fGSIoZAXrht3x3hSL-hVZMeiqXqQ-9';
    expect(resolveYoutubePlaylistId(url)).toBe('PL4fGSIoZAXrht3x3hSL-hVZMeiqXqQ-9');
  });

  it('returns null for invalid refs', () => {
    expect(resolveYoutubePlaylistId('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(resolveYoutubePlaylistId('not-a-playlist')).toBeNull();
  });
});
