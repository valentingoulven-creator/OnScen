import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { filterFeedPostsByEventCountry } from '../lib/feedEventCountry';
import type { FeedPost } from '../types';
import { MAP_SIDEBAR_SPONSO_REFRESH_EVENT } from '../lib/mapUiEvents';
import { useEventsCountry } from './useEventsCountry';

type UseMapSidebarSponsoredEventsOptions = {
  profileCity?: string;
  /** Filtre par pays utilisateur (géoloc / ville profil) — défaut true. */
  filterByCountry?: boolean;
};

/** Événements sponsorisés (carrousel sidebar carte), gérés depuis l’admin Sponsors. */
export function useMapSidebarSponsoredEvents(
  token: string | null,
  options: UseMapSidebarSponsoredEventsOptions = {}
) {
  const { profileCity, filterByCountry = true } = options;
  const { countryCode } = useEventsCountry({
    enabled: Boolean(token) && filterByCountry,
    profileCity,
  });
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

  const visiblePosts = useMemo(() => {
    if (!filterByCountry) return posts;
    return filterFeedPostsByEventCountry(posts, countryCode);
  }, [posts, filterByCountry, countryCode]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  return { posts: visiblePosts, loading, refresh, patchPost };
}
