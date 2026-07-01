import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCompleteYoutubeSearchResult, searchYoutube } from './youtubeSearch';

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

describe('searchYoutube — lien collé avec oEmbed en échec', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renvoie un résultat minimal basé sur le videoId extrait, sans retomber sur search.list', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 }) as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // oEmbed échoue (1 seul appel réseau) et on ne tente PAS de fallback search.list avec
    // le texte brut de l'URL — aucun autre appel réseau ne doit avoir eu lieu.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('oembed');
    expect(results).toEqual([
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Vidéo YouTube',
        artist: 'YouTube',
        thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ]);
  });
});
