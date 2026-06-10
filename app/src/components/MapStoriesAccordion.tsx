import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterIcon } from './FilterIcon';
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
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  setLivesGeoRadiusKm,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import {
  isMapStoriesCollapsed,
  isMapStoriesHidden,
  setMapStoriesCollapsed,
  setMapStoriesHidden,
} from '../lib/mapStoriesPrefs';
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
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import type { MusicReel } from '../content/reels';
import type { MapStory, NearbyPerson, User } from '../types';
import { MapLocationPinButton } from './MapLocationPinButton';
import { MapStorySheet } from './MapStorySheet';
import { MapStoryRing, MyMapStoryRing } from './MapStoryRings';
import { StoryViewer } from './StoryViewer';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

interface MapStoriesAccordionProps {
  nearbyPeople: NearbyPerson[];
  onOpenProfile: (person: NearbyPerson) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  /** Carte visible (onglet + vue home, pas overlay profil). */
  isActive?: boolean;
}

type SheetState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'view'; story: MapStory; isOwn: boolean };

export function MapStoriesAccordion({
  nearbyPeople,
  onOpenProfile,
  onOpenReel,
  onOpenLive,
  isActive = true,
}: MapStoriesAccordionProps) {
  const { token, user } = useAuth();
  const [hidden, setHidden] = useState(isMapStoriesHidden);
  const [collapsed, setCollapsed] = useState(isMapStoriesCollapsed);
  const [filterOpen, setFilterOpen] = useState(false);
  const [myStory, setMyStory] = useState<MapStory | null>(null);
  const [storiesByUser, setStoriesByUser] = useState<Map<string, MapStory>>(new Map());
  const [storyFeed, setStoryFeed] = useState<{
    favorites: User[];
    reels: MusicReel[];
    ephemeralStories: MapStory[];
    favoriteIds: Set<string>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' });
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [radiusKm, setRadiusKm] = useState(() => getNearbyRadiusKm());

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

  const updatePrefs = useCallback((patch: Partial<Pick<NearbyPanelPreferences, 'favoritesFirst' | 'filterByDistance'>>) => {
    setPrefs(setNearbyPanelPreferences(patch));
  }, []);

  const applyRadius = (km: number) => {
    const clamped = clampNearbyRadiusKm(km);
    const v = setNearbyPanelRadiusKm(clamped);
    setRadiusKm(v);
    setLivesGeoRadiusKm(v);
  };

  const filterActive = prefs.favoritesFirst || prefs.filterByDistance;

  const fetchStoryFeed = useCallback(async () => {
    if (!token) {
      setStoryFeed(null);
      setMyStory(null);
      setStoriesByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      const storyRadius = prefs.filterByDistance ? radiusKm : undefined;
      const [favRes, feedRes, storiesRes, mineRes] = await Promise.all([
        api.getMyFavorites(token),
        api.getReelsFeed(token),
        api.getStories(token, {
          latitude: mapGeo.latitude,
          longitude: mapGeo.longitude,
          radius: storyRadius,
        }),
        api.getMyStory(token),
      ]);
      const favoriteIds = new Set(favRes.favorites.map((f) => f.id));
      const reels = (feedRes.reels ?? [])
        .map((r) => normalizeProfileReelFromApi(r as Parameters<typeof normalizeProfileReelFromApi>[0]))
        .filter((r): r is MusicReel => r != null);

      const ephemeral = storiesRes.stories ?? [];
      const byUser = new Map<string, MapStory>();
      for (const s of ephemeral) {
        const prev = byUser.get(s.userId);
        if (!prev || s.createdAt > prev.createdAt) byUser.set(s.userId, s);
      }
      setStoriesByUser(byUser);
      setMyStory(mineRes.story);
      setStoryFeed({
        favorites: favRes.favorites,
        reels,
        ephemeralStories: ephemeral,
        favoriteIds,
      });
    } catch {
      setStoryFeed(null);
      setMyStory(null);
      setStoriesByUser(new Map());
    } finally {
      setLoading(false);
    }
  }, [token, prefs.filterByDistance, radiusKm, mapGeo.latitude, mapGeo.longitude]);

  useEffect(() => {
    void fetchStoryFeed();
  }, [fetchStoryFeed]);

  const entries = useMemo(() => {
    if (!storyFeed) return [];
    const people = nearbyPeople.filter((p) => p.id !== user?.id);
    return buildMapStoryEntries(people, storyFeed.favorites, storyFeed.reels, {
      favoritesFirst: prefs.favoritesFirst,
      favoriteIds: storyFeed.favoriteIds,
      ephemeralStories: storyFeed.ephemeralStories,
    }).filter((e) => e.userId !== user?.id);
  }, [nearbyPeople, storyFeed, prefs.favoritesFirst, user?.id]);

  const countLabel = useMemo(() => {
    if (loading) return '…';
    const base = entries.length + (user && token ? 1 : 0);
    return String(base);
  }, [entries.length, loading, token, user]);

  const storyStacks = useMemo(
    () => buildStoryUserStacks(entries, storiesByUser, myStory),
    [entries, storiesByUser, myStory]
  );

  const viewerStack =
    sheet.kind === 'view' ? findStackForStory(storyStacks, sheet.story) : undefined;
  const viewerStackIndex =
    sheet.kind === 'view' && viewerStack ? stackIndexForStory(viewerStack, sheet.story) : 0;

  const goNextStory = useCallback(() => {
    if (sheet.kind !== 'view') return;
    const next = resolveNextStory(storyStacks, sheet.story, user?.id);
    if (!next) return;
    setSheet({ kind: 'view', story: next.story, isOwn: next.isOwn });
  }, [sheet, storyStacks, user?.id]);

  const goPrevStory = useCallback(() => {
    if (sheet.kind !== 'view') return;
    const prev = resolvePrevStory(storyStacks, sheet.story, user?.id);
    if (!prev) return;
    setSheet({ kind: 'view', story: prev.story, isOwn: prev.isOwn });
  }, [sheet, storyStacks, user?.id]);

  const canNextStory =
    sheet.kind === 'view' && resolveNextStory(storyStacks, sheet.story, user?.id) != null;
  const canPrevStory =
    sheet.kind === 'view' && resolvePrevStory(storyStacks, sheet.story, user?.id) != null;

  const openEntry = (entry: MapStoryEntry) => {
    if (entry.hasActiveStory && entry.storyId) {
      const story = storiesByUser.get(entry.userId);
      if (story) {
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
    const person = nearbyPeople.find((p) => p.id === entry.userId);
    onOpenProfile(
      person ?? {
        id: entry.userId,
        username: entry.username,
        avatarUrl: entry.avatarUrl,
        isLive: entry.isLive,
      }
    );
  };

  const openMyStory = () => {
    if (myStory) {
      setSheet({ kind: 'view', story: myStory, isOwn: true });
    } else {
      setSheet({ kind: 'create' });
    }
  };

  const handlePublished = (story: MapStory) => {
    setMyStory(story);
    setStoriesByUser((prev) => new Map(prev).set(story.userId, story));
    void fetchStoryFeed();
  };

  const showEmpty = !loading && entries.length === 0 && !user;

  if (!isActive) return null;

  if (hidden) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => {
            setHidden(false);
            setMapStoriesHidden(false);
          }}
          className="px-3 py-1 rounded-full bg-[#12121a]/95 border border-[#2d2d3d] text-[10px] font-semibold text-purple-300 hover:border-purple-500/50 shadow-lg"
        >
          Afficher les stories
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1.5 w-full max-w-full">
        <div className="w-full rounded-xl bg-[#12121a]/95 border border-[#2d2d3d] shadow-lg backdrop-blur-md overflow-hidden">
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
            <button
              type="button"
              onClick={() => {
                setHidden(true);
                setMapStoriesHidden(true);
              }}
              title="Masquer les stories"
              aria-label="Masquer les stories sur la carte"
              className="p-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-[#1a1a26]"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
              </svg>
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
                <span className="text-[10px] text-gray-300">Filtrer par distance</span>
                <input
                  type="checkbox"
                  checked={prefs.filterByDistance}
                  onChange={(e) => updatePrefs({ filterByDistance: e.target.checked })}
                  className="melosong-checkbox scale-90"
                  aria-label="Filtrer les stories par distance"
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
                  Aucune story à proximité pour le moment.
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
                  {entries.map((entry) => (
                    <MapStoryRing key={entry.userId} entry={entry} onClick={() => openEntry(entry)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-full flex justify-end">
          <MapLocationPinButton isActive={isActive} />
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
