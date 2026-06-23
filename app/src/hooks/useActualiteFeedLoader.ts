import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fetchStoriesBundle } from '../lib/storiesApiCache';
import { groupStoriesByUser } from '../lib/storyViewerNav';
import type { FeedPost, MapStory } from '../types';

export function useActualiteFeedLoader(
  token: string | null,
  isActive: boolean,
  showNews: boolean
) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedStoriesByUser, setFeedStoriesByUser] = useState<Map<string, MapStory[]>>(new Map());

  const loadFeedStories = useCallback(async () => {
    if (!token) {
      setFeedStoriesByUser(new Map());
      return;
    }
    try {
      const bundle = await fetchStoriesBundle(token);
      const allStories = [...bundle.stories];
      for (const s of bundle.mine) {
        if (!allStories.some((x) => x.id === s.id)) allStories.push(s);
      }
      setFeedStoriesByUser(groupStoriesByUser(allStories));
    } catch {
      setFeedStoriesByUser(new Map());
    }
  }, [token]);

  const loadFeed = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [feedRes] = await Promise.all([
          api.getFeedPosts(token, { limit: 50, followingOnly: true }),
          loadFeedStories(),
        ]);
        setPosts(feedRes.posts);
      } catch {
        setError('Impossible de charger le fil.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, loadFeedStories]
  );

  useEffect(() => {
    if (!isActive || !token || showNews) return;
    void loadFeed();
  }, [isActive, token, showNews, loadFeed]);

  return {
    posts,
    setPosts,
    loading,
    refreshing,
    error,
    setError,
    loadFeed,
    loadFeedStories,
    feedStoriesByUser,
    setFeedStoriesByUser,
  };
}
