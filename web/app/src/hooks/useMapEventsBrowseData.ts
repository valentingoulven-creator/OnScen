import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { countryCodeToFlag, EVENTS_COUNTRY_FALLBACK } from '../lib/countryDisplay';
import {
  getPrimaryEventDate,
  getUpcomingUserEvents,
  groupFeedPostsByCalendarDays,
  countFeedPostsInCalendarDays,
  hasUpcomingEventDate,
  mergeBrowseDayKeysForMapPosts,
} from '../lib/feedEvents';
import { groupFeedPostsByCountryCategory } from '../lib/mapEventBrowseCategories';
import {
  filterFeedPostsByEventCriteria,
  getBrowseSheetCalendarDayKeys,
  type MapEventFilterCriteria,
} from '../lib/mapEventFilter';
import { useEventsCountry } from './useEventsCountry';
import type { FeedPost } from '../types';

export type MapEventsBrowseTab = 'around' | 'country';

export function useMapEventsBrowseData({
  enabled,
  token,
  profileCity,
  favoriteAuthorIds,
  eventsFilterOn = false,
  filterCriteria,
  eventFilterCustomized = false,
  /** Événements carte déjà filtrés par viewport (onglet Autour). */
  aroundEventPosts,
  viewerId,
  onPostChange,
}: {
  enabled: boolean;
  token: string;
  profileCity?: string;
  favoriteAuthorIds?: ReadonlySet<string>;
  eventsFilterOn?: boolean;
  filterCriteria?: MapEventFilterCriteria;
  eventFilterCustomized?: boolean;
  aroundEventPosts?: FeedPost[];
  viewerId?: string;
  onPostChange?: (postId: string, patch: Partial<FeedPost>) => void;
}) {
  const { countryCode, countryName } = useEventsCountry({ enabled, profileCity });

  const [activeTab, setActiveTab] = useState<MapEventsBrowseTab>('around');
  const [communityEventPosts, setCommunityEventPosts] = useState<FeedPost[]>([]);
  const [communityEventsLoading, setCommunityEventsLoading] = useState(false);
  const [countryEventPosts, setCountryEventPosts] = useState<FeedPost[]>([]);
  const [countryEventsLoading, setCountryEventsLoading] = useState(false);

  const loadCommunityEvents = useCallback(async () => {
    if (!token) return;
    setCommunityEventsLoading(true);
    try {
      const res = await api.getFeedPosts(token, {
        eventsOnly: true,
        userEventsOnly: true,
        limit: 50,
      });
      setCommunityEventPosts(res.posts);
    } catch {
      setCommunityEventPosts([]);
    } finally {
      setCommunityEventsLoading(false);
    }
  }, [token]);

  const loadCountryEvents = useCallback(async () => {
    if (!token) return;
    setCountryEventsLoading(true);
    try {
      const res = await api.getFeedPosts(token, {
        eventsOnly: true,
        eventCountry: countryCode,
        limit: 50,
      });
      setCountryEventPosts(res.posts);
    } catch {
      setCountryEventPosts([]);
    } finally {
      setCountryEventsLoading(false);
    }
  }, [token, countryCode]);

  useEffect(() => {
    if (!enabled || !token || aroundEventPosts !== undefined) return;
    void loadCommunityEvents();
  }, [enabled, token, loadCommunityEvents, aroundEventPosts]);

  useEffect(() => {
    if (!enabled || !token) return;
    void loadCountryEvents();
  }, [enabled, token, loadCountryEvents]);

  const communityEvents = useMemo(() => {
    if (aroundEventPosts !== undefined) {
      return aroundEventPosts;
    }
    const upcoming = getUpcomingUserEvents(communityEventPosts, { favoriteAuthorIds });
    if (!eventsFilterOn || !filterCriteria || !eventFilterCustomized) return upcoming;
    return filterFeedPostsByEventCriteria(upcoming, filterCriteria, { viewerId });
  }, [
    aroundEventPosts,
    communityEventPosts,
    favoriteAuthorIds,
    eventsFilterOn,
    eventFilterCustomized,
    filterCriteria,
    viewerId,
  ]);

  const countryUpcoming = useMemo(() => {
    let upcoming = countryEventPosts
      .filter((p) => p.isEvent && hasUpcomingEventDate(p))
      .sort(
        (a, b) =>
          new Date(getPrimaryEventDate(a)!).getTime() - new Date(getPrimaryEventDate(b)!).getTime()
      );
    if (aroundEventPosts !== undefined) {
      const visibleIds = new Set(aroundEventPosts.map((post) => post.id));
      upcoming = upcoming.filter((post) => visibleIds.has(post.id));
    }
    if (!eventsFilterOn || !filterCriteria || !eventFilterCustomized) return upcoming;
    return filterFeedPostsByEventCriteria(upcoming, filterCriteria, { viewerId });
  }, [
    countryEventPosts,
    aroundEventPosts,
    eventsFilterOn,
    eventFilterCustomized,
    filterCriteria,
    viewerId,
  ]);

  const displayCountryCode = countryCode ?? EVENTS_COUNTRY_FALLBACK.code;
  const displayCountryName = countryName ?? EVENTS_COUNTRY_FALLBACK.name;
  const countrySectionEmoji = countryCodeToFlag(displayCountryCode);

  const activePosts = activeTab === 'around' ? communityEvents : countryUpcoming;
  const activeLoading = activeTab === 'around' ? communityEventsLoading : countryEventsLoading;

  const browseDayKeys = useMemo(() => {
    const useFilterDays = eventsFilterOn && eventFilterCustomized && filterCriteria;
    const base = getBrowseSheetCalendarDayKeys(
      useFilterDays ? filterCriteria : undefined,
      Boolean(useFilterDays)
    );
    if (!eventFilterCustomized || aroundEventPosts === undefined) return base;
    return mergeBrowseDayKeysForMapPosts(base, aroundEventPosts);
  }, [filterCriteria, eventsFilterOn, eventFilterCustomized, aroundEventPosts]);

  const aroundBrowseDayOpts = useMemo(
    () =>
      eventFilterCustomized && aroundEventPosts !== undefined
        ? { fallbackNearestDay: true }
        : undefined,
    [eventFilterCustomized, aroundEventPosts]
  );

  const eventsByDay = useMemo(
    () =>
      activeTab === 'around'
        ? groupFeedPostsByCalendarDays(communityEvents, browseDayKeys, aroundBrowseDayOpts)
        : groupFeedPostsByCalendarDays(countryUpcoming, browseDayKeys),
    [activeTab, communityEvents, countryUpcoming, browseDayKeys, aroundBrowseDayOpts]
  );

  const countryEventsByCategory = useMemo(() => {
    const inWindow = groupFeedPostsByCalendarDays(countryUpcoming, browseDayKeys)
      .flatMap((g) => g.posts);
    return groupFeedPostsByCountryCategory(inWindow);
  }, [countryUpcoming, browseDayKeys]);

  /** Badges onglets : fenêtre jour (3 jours par défaut ; plage filtre si sheet appliquée). */
  const communityEventsVisibleCount = useMemo(
    () => countFeedPostsInCalendarDays(communityEvents, browseDayKeys),
    [communityEvents, browseDayKeys]
  );
  const countryEventsVisibleCount = useMemo(
    () => countFeedPostsInCalendarDays(countryUpcoming, browseDayKeys),
    [countryUpcoming, browseDayKeys]
  );

  const sectionEmoji = activeTab === 'around' ? '📍' : countrySectionEmoji;

  const handlePostChange = useCallback(
    (postId: string, patch: Partial<FeedPost>) => {
      onPostChange?.(postId, patch);
      setCommunityEventPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...patch } : p))
      );
      setCountryEventPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...patch } : p))
      );
    },
    [onPostChange]
  );

  useEffect(() => {
    if (!enabled) return;
    if (aroundEventPosts !== undefined && communityEvents.length > 0) {
      setActiveTab('around');
      return;
    }
    if (communityEventsVisibleCount > 0) {
      setActiveTab('around');
      return;
    }
    if (countryEventsVisibleCount > 0) setActiveTab('country');
  }, [
    enabled,
    aroundEventPosts,
    communityEvents.length,
    communityEventsVisibleCount,
    countryEventsVisibleCount,
  ]);

  return {
    activeTab,
    setActiveTab,
    communityEvents,
    countryUpcoming,
    communityEventsVisibleCount,
    countryEventsVisibleCount,
    activePosts,
    activeLoading,
    eventsByDay,
    countryEventsByCategory,
    sectionEmoji,
    displayCountryName,
    countrySectionEmoji,
    handlePostChange,
  };
}
