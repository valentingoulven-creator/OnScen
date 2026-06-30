import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStoriesBundle, invalidateStoriesCache } from './storiesApiCache';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    getStories: vi.fn(),
    getMyStory: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

afterEach(() => {
  invalidateStoriesCache();
  vi.clearAllMocks();
});

describe('fetchStoriesBundle', () => {
  it('déduplique les appels parallèles avec la même clé', async () => {
    mockedApi.getStories.mockResolvedValue({ stories: [{ id: 's1' } as never] });
    mockedApi.getMyStory.mockResolvedValue({ story: null, stories: [{ id: 'm1' } as never] });

    const [a, b] = await Promise.all([
      fetchStoriesBundle('token-a'),
      fetchStoriesBundle('token-a'),
    ]);

    expect(a.stories).toHaveLength(1);
    expect(b.mine).toHaveLength(1);
    expect(mockedApi.getStories).toHaveBeenCalledTimes(1);
    expect(mockedApi.getMyStory).toHaveBeenCalledTimes(1);
  });

  it('utilise le cache TTL pour un second appel séquentiel', async () => {
    mockedApi.getStories.mockResolvedValue({ stories: [] });
    mockedApi.getMyStory.mockResolvedValue({ story: { id: 'm1' } as never, stories: [] });

    await fetchStoriesBundle('token-b');
    await fetchStoriesBundle('token-b');

    expect(mockedApi.getStories).toHaveBeenCalledTimes(1);
    expect(mockedApi.getMyStory).toHaveBeenCalledTimes(1);
  });
});
