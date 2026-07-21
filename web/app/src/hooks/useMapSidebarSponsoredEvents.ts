import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { FeedPost } from '../types';
import { MAP_SIDEBAR_SPONSO_REFRESH_EVENT } from '../lib/mapUiEvents';

/** Événements sponsorisés (carrousel sidebar carte), gérés depuis l’admin Sponsors. */
export function useMapSidebarSponsoredEvents(token: string | null) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setPosts([]);
      return;
    }
    setLoading(true);
    try {
      const r = await api.getMapSidebarEventSponsors(token);
      setPosts(r.posts ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => {
      void refresh();
    };
    window.addEventListener(MAP_SIDEBAR_SPONSO_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MAP_SIDEBAR_SPONSO_REFRESH_EVENT, onRefresh);
  }, [refresh]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  return { posts, loading, refresh, patchPost };
}
