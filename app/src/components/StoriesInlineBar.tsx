import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { buildMapStoryEntries, type MapStoryEntry } from '../lib/mapStoriesFeed';
import {
  buildStoryUserStacks,
  findStackForStory,
  resolveNextStory,
  resolvePrevStory,
  stackIndexForStory,
} from '../lib/storyViewerNav';
import {
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  setNearbyPanelPreferences,
  setNearbyPanelRadiusKm,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import {
  clampNearbyRadiusKm,
  getNearbyRadiusKm,
  NEARBY_RADIUS_MAX,
  NEARBY_RADIUS_MIN,
  SETTINGS_CHANGED_EVENT,
} from '../lib/settings';
import {
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  setLivesGeoRadiusKm,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { isMapStoriesCollapsed, setMapStoriesCollapsed } from '../lib/mapStoriesPrefs';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import type { MusicReel } from '../content/reels';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import type { MapStory, NearbyPerson } from '../types';
import { MapStorySheet } from './MapStorySheet';
import { MapStoryRing, MyMapStoryRing } from './MapStoryRings';
import { StoryViewer } from './StoryViewer';
import { FilterIcon } from './FilterIcon';

function loadSeenStoryIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`soundy_seen_stories_${userId}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeenStoryIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`soundy_seen_stories_${userId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export type StorySheetState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'view'; story: MapStory; isOwn: boolean };

export interface StoriesInlineBarProps {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
}

export function StoriesInlineBar({
  onOpenProfile,
  onOpenReel,
  onOpenLive,
  isActive,
}: StoriesInlineBarProps) {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<MapStoryEntry[]>([]);
  const [myStory, setMyStory] = useState<MapStory | null>(null);
  const [storiesByUser, setStoriesByUser] = useState<Map<string, MapStory>>(new Map());
  const [sheet, setSheet] = useState<StorySheetState>({ kind: 'closed' });
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(isMapStoriesCollapsed);
  const [filterOpen, setFilterOpen] = useState(false);
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [radiusKm, setRadiusKm] = useState(() => getNearbyRadiusKm());
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(() =>
    user?.id ? loadSeenStoryIds(user.id) : new Set()
  );

  const markStoryAsSeen = useCallback(
    (storyId: string) => {
      if (!user?.id) return;
      setSeenStoryIds((prev) => {
        if (prev.has(storyId)) return prev;
        const next = new Set(prev);
        next.add(storyId);
        saveSeenStoryIds(user.id, next);
        return next;
      });
    },
    [user?.id]
  );

  const updatePrefs = useCallback(
    (patch: Partial<Pick<NearbyPanelPreferences, 'favoritesFirst' | 'filterByDistance'>>) => {
      setPrefs(setNearbyPanelPreferences(patch));
    },
    []
  );

  const applyRadius = (km: number) => {
    const clamped = clampNearbyRadiusKm(km);
    const v = setNearbyPanelRadiusKm(clamped);
    setRadiusKm(v);
    setLivesGeoRadiusKm(v);
  };

  useEffect(() => {
    const syncPrefs = () => setPrefs(getNearbyPanelPreferences());
    const syncGeo = () => setMapGeo(getLivesGeo());
    const syncRadius = () => setRadiusKm(getNearbyRadiusKm());
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncRadius);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncRadius);
    return () => {
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncRadius);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncRadius);
    };
  }, []);

  const filterActive = prefs.favoritesFirst || prefs.filterByDistance;

  const countLabel = useMemo(() => {
    if (loading) return '…';
    return String(entries.length + (user && token ? 1 : 0));
  }, [entries.length, loading, token, user]);

  const loadStories = useCallback(async () => {
    if (!token) {
      setEntries([]);
      setMyStory(null);
      setStoriesByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      const storyRadius = prefs.filterByDistance ? radiusKm : undefined;
      const [favRes, feedRes, livesOrNull, storiesRes, mineRes] = await Promise.all([
        api.getMyFavorites(token),
        api.getReelsFeed(token),
        api.getLives(token, { distanceFilter: false }).catch(() => null),
        api.getStories(token, {
          latitude: mapGeo.latitude,
          longitude: mapGeo.longitude,
          radius: storyRadius,
        }),
        api.getMyStory(token),
      ]);
      const favoriteIds = new Set(favRes.favorites.map((f) => f.id));
      const isFollowed = (userId: string) => favoriteIds.has(userId);

      const userInfoById = new Map<string, { username: string; avatarUrl?: string }>(
        favRes.favorites.map((f) => [f.id, { username: f.username, avatarUrl: f.avatarUrl }])
      );

      type RawReel = MusicReel & { authorUsername?: string; authorAvatarUrl?: string };
      const rawReels = feedRes.reels as RawReel[];
      for (const raw of rawReels) {
        const aid = raw.authorId?.trim();
        if (aid && !userInfoById.has(aid) && raw.authorUsername) {
          userInfoById.set(aid, { username: raw.authorUsername, avatarUrl: raw.authorAvatarUrl });
        }
      }

      const reels = rawReels
        .map((r) => normalizeProfileReelFromApi(r as Parameters<typeof normalizeProfileReelFromApi>[0]))
        .filter((r): r is MusicReel => r != null);

      const syntheticIds = new Set<string>();
      const syntheticPeople: NearbyPerson[] = [];

      for (const live of livesOrNull?.lives ?? []) {
        if (!live.isActive || !isFollowed(live.hostId)) continue;
        syntheticIds.add(live.hostId);
        syntheticPeople.push({
          id: live.hostId,
          username: live.hostName,
          isLive: true,
          liveId: live.id,
          liveViewersCount: live.viewersCount,
        });
      }

      for (const reel of reels) {
        const aid = reel.authorId?.trim();
        if (!aid || syntheticIds.has(aid) || !isFollowed(aid)) continue;
        const info = userInfoById.get(aid);
        if (!info) continue;
        syntheticIds.add(aid);
        syntheticPeople.push({ id: aid, username: info.username, avatarUrl: info.avatarUrl });
      }

      const followedEphemeral = (storiesRes.stories ?? []).filter((s) => isFollowed(s.userId));
      const byUser = new Map<string, MapStory>();
      for (const s of followedEphemeral) {
        const prev = byUser.get(s.userId);
        if (!prev || s.createdAt > prev.createdAt) byUser.set(s.userId, s);
      }
      setStoriesByUser(byUser);
      setMyStory(mineRes.story);

      const filteredPeople = syntheticPeople.filter((p) => p.id !== user?.id);
      setEntries(
        buildMapStoryEntries(filteredPeople, favRes.favorites, reels, {
          favoritesFirst: prefs.favoritesFirst,
          favoriteIds,
          ephemeralStories: followedEphemeral,
        })
          .filter((e) => e.userId !== user?.id && isFollowed(e.userId))
      );
    } catch {
      setEntries([]);
      setMyStory(null);
      setStoriesByUser(new Map());
    } finally {
      setLoading(false);
    }
  }, [token, prefs.favoritesFirst, prefs.filterByDistance, radiusKm, mapGeo.latitude, mapGeo.longitude, user?.id]);

  useEffect(() => {
    if (!isActive) return;
    void loadStories();
  }, [isActive, loadStories]);

  const openEntry = (entry: MapStoryEntry) => {
    if (entry.hasActiveStory && entry.storyId) {
      const story = storiesByUser.get(entry.userId);
      if (story) {
        markStoryAsSeen(story.id);
        setSheet({ kind: 'view', story, isOwn: entry.userId === user?.id });
        return;
      }
    }
    if (entry.isLive && entry.liveId && onOpenLive) {
      onOpenLive(entry.liveId);
      return;
    }
    if (entry.reelId && onOpenReel) {
      onOpenReel(entry.reelId);
      return;
    }
    onOpenProfile(entry.userId);
  };

  const openMyStory = () => {
    if (myStory) {
      markStoryAsSeen(myStory.id);
      setSheet({ kind: 'view', story: myStory, isOwn: true });
    } else {
      setSheet({ kind: 'create' });
    }
  };

  const handlePublished = (story: MapStory) => {
    setMyStory(story);
    setStoriesByUser((prev) => new Map(prev).set(story.userId, story));
    void loadStories();
  };

  const showEmpty = !loading && entries.length === 0 && !user;

  const sortedEntries = useMemo(() => {
    const unseen = entries.filter((e) => !e.storyId || !seenStoryIds.has(e.storyId));
    const seen = entries.filter((e) => e.storyId && seenStoryIds.has(e.storyId));
    return [...unseen, ...seen];
  }, [entries, seenStoryIds]);

  const storyStacks = useMemo(
    () => buildStoryUserStacks(sortedEntries, storiesByUser, myStory),
    [sortedEntries, storiesByUser, myStory]
  );

  const viewerStack =
    sheet.kind === 'view' ? findStackForStory(storyStacks, sheet.story) : undefined;
  const viewerStackIndex =
    sheet.kind === 'view' && viewerStack ? stackIndexForStory(viewerStack, sheet.story) : 0;

  const goNextStory = useCallback(() => {
    if (sheet.kind !== 'view') return;
    const next = resolveNextStory(storyStacks, sheet.story, user?.id);
    if (!next) return;
    markStoryAsSeen(next.story.id);
    setSheet({ kind: 'view', story: next.story, isOwn: next.isOwn });
  }, [sheet, storyStacks, user?.id, markStoryAsSeen]);

  const goPrevStory = useCallback(() => {
    if (sheet.kind !== 'view') return;
    const prev = resolvePrevStory(storyStacks, sheet.story, user?.id);
    if (!prev) return;
    markStoryAsSeen(prev.story.id);
    setSheet({ kind: 'view', story: prev.story, isOwn: prev.isOwn });
  }, [sheet, storyStacks, user?.id, markStoryAsSeen]);

  const canNextStory =
    sheet.kind === 'view' && resolveNextStory(storyStacks, sheet.story, user?.id) != null;
  const canPrevStory =
    sheet.kind === 'view' && resolvePrevStory(storyStacks, sheet.story, user?.id) != null;

  return (
    <>
      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a] overflow-hidden min-w-0">
        <div className="w-full min-w-0">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#2d2d3d]/80">
            <button
              type="button"
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                setMapStoriesCollapsed(next);
              }}
              className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
              aria-expanded={!collapsed}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
                Stories
              </span>
              <span className="text-[9px] text-gray-500">({countLabel})</span>
              <svg
                viewBox="0 0 24 24"
                className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition ${collapsed ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              title="Filtrer les stories (favoris et distance)"
              aria-label="Filtrer les stories par favoris et distance"
              aria-expanded={filterOpen}
              className={`p-1 rounded-lg shrink-0 transition ${
                filterOpen || filterActive
                  ? 'text-purple-300 bg-purple-900/30 hover:bg-purple-900/40'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a26]'
              }`}
            >
              <FilterIcon className="w-5 h-5" />
            </button>
          </div>

          {filterOpen && (
            <div className="px-2.5 pb-2.5 pt-0 border-b border-[#2d2d3d]/80 space-y-2 max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[10px] text-gray-300">Favoris en premier</span>
                <input
                  type="checkbox"
                  checked={prefs.favoritesFirst}
                  onChange={(e) => updatePrefs({ favoritesFirst: e.target.checked })}
                  className="melosong-checkbox scale-90"
                  aria-label="Afficher les favoris en premier dans les stories"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[10px] text-gray-300">Voir autour de moi</span>
                <input
                  type="checkbox"
                  checked={prefs.filterByDistance}
                  onChange={(e) => updatePrefs({ filterByDistance: e.target.checked })}
                  className="melosong-checkbox scale-90"
                  aria-label="Voir les stories autour de moi"
                />
              </label>

              {prefs.filterByDistance && (
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">Rayon</span>
                    <span className="text-purple-400 font-bold">{radiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min={NEARBY_RADIUS_MIN}
                    max={NEARBY_RADIUS_MAX}
                    step={1}
                    value={radiusKm}
                    onChange={(e) => applyRadius(Number(e.target.value))}
                    className="w-full accent-purple-500 h-1.5"
                    aria-label="Rayon en kilomètres pour les stories"
                  />
                  <p className="text-[9px] text-gray-600 mt-1">
                    Stories des personnes dans ~{radiusKm} km autour de {mapGeo.label}.
                  </p>
                </div>
              )}
            </div>
          )}

          {!collapsed && (
            <div className="min-w-0">
              {loading && entries.length === 0 && !user ? (
                <p className="text-[10px] text-gray-500 text-center py-2 px-2">Chargement des stories…</p>
              ) : showEmpty ? (
                <p className="text-[10px] text-gray-500 text-center py-2 px-2 leading-snug">
                  Aucune story pour le moment.
                </p>
              ) : (
                <div className="stories-rings-carousel flex flex-nowrap gap-2 pb-1 -mx-2 px-2">
                  {user && token ? (
                    <MyMapStoryRing
                      userId={user.id}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      hasActiveStory={!!myStory}
                      storyImageUrl={myStory?.imageUrl}
                      onClick={openMyStory}
                      onAddClick={() => setSheet({ kind: 'create' })}
                    />
                  ) : null}
                  {sortedEntries.map((entry) => (
                    <MapStoryRing key={entry.userId} entry={entry} onClick={() => openEntry(entry)} isSeen={!!entry.storyId && seenStoryIds.has(entry.storyId)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {token && sheet.kind === 'create' ? (
        <MapStorySheet
          token={token}
          onClose={() => setSheet({ kind: 'closed' })}
          onPublished={handlePublished}
        />
      ) : null}

      {sheet.kind === 'view' && viewerStack ? (
        <StoryViewer
          story={sheet.story}
          stack={viewerStack.stories}
          stackIndex={viewerStackIndex}
          onClose={() => setSheet({ kind: 'closed' })}
          onNext={goNextStory}
          onPrev={goPrevStory}
          canNext={canNextStory}
          canPrev={canPrevStory}
        />
      ) : null}
    </>
  );
}
