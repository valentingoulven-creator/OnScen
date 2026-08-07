import { useCallback, useEffect, useRef, useState } from 'react';
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
  const postsRef = useRef(posts);
  postsRef.current = posts;
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

  const loadMoreFollowing = useCallback(async (): Promise<number> => {
    if (!token) return 0;
    const prev = postsRef.current;
    if (prev.length === 0) return 0;
    const oldest = Math.min(...prev.map((p) => p.createdAt));
    try {
      const feedRes = await api.getFeedPosts(token, {
        limit: 50,
        followingOnly: true,
        before: oldest,
      });
      let added = 0;
      setPosts((current) => {
        const ids = new Set(current.map((p) => p.id));
        const merged = [...current];
        for (const p of feedRes.posts) {
          if (!ids.has(p.id)) {
            merged.push(p);
            added += 1;
          }
        }
        merged.sort((a, b) => b.createdAt - a.createdAt);
        return merged;
      });
      return added;
    } catch {
      return 0;
    }
  }, [token]);

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
    loadMoreFollowing,
    loadFeedStories,
    feedStoriesByUser,
    setFeedStoriesByUser,
  };
}
