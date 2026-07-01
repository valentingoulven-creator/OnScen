import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchVideosViaDataApi } from './youtubeDataApi';
import { YoutubeDataApiError } from './youtubeApiErrors';
import { __resetYoutubeSearchQuotaForTests, SEARCH_LIST_DAILY_LIMIT, SEARCH_LIST_RESERVE } from './youtubeQuotaBudget';

describe('searchVideosViaDataApi — protection quota search.list', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    __resetYoutubeSearchQuotaForTests(0);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.YOUTUBE_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('bloque un nouvel appel search.list sans toucher au réseau une fois le budget quasi épuisé', async () => {
    __resetYoutubeSearchQuotaForTests(SEARCH_LIST_DAILY_LIMIT - SEARCH_LIST_RESERVE);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(searchVideosViaDataApi(`unique-query-${Date.now()}`, 'fake-token')).rejects.toBeInstanceOf(
      YoutubeDataApiError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
