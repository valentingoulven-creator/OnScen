import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { buildMapStoryEntries, type MapStoryEntry } from '../lib/mapStoriesFeed';
import {
  areAllStoriesSeen,
  buildStoryUserStacks,
  findStackForStory,
  groupStoriesByUser,
  latestStory,
  pickInitialStory,
  pruneSeenStoryIds,
  resolveAfterStoryDeleted,
} from '../lib/storyViewerNav';
import {
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import { isMapStoriesCollapsed, setMapStoriesCollapsed } from '../lib/mapStoriesPrefs';
import { fetchStoriesBundle, invalidateStoriesCache } from '../lib/storiesApiCache';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import type { MusicReel } from '../content/reels';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import type { MapStory, NearbyPerson } from '../types';
import { MapStorySheet } from './MapStorySheet';
import { MapStoryRing, MyMapStoryRing } from './MapStoryRings';
import { StoryLivePreviewViewer } from './StoryLivePreviewViewer';
import { StoryViewer } from './StoryViewer';
import { useStoryViewerWithSponsors } from '../hooks/useStoryViewerWithSponsors';
import { StoriesRingsCarousel } from './StoriesRingsCarousel';
import { StoriesAdBanner } from './StoriesAdBanner';
import { dispatchMapOpenCreateSalon } from '../lib/mapUiEvents';

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
  | { kind: 'view'; story: MapStory; isOwn: boolean }
  | { kind: 'view_sponsor'; ad: import('../types').ReelsSponsorAd; sponsorKey: string };

export type LivePreviewState =
  | { kind: 'closed' }
  | { kind: 'open'; entry: MapStoryEntry; liveId: string };

export interface StoriesInlineBarProps {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
}

export const StoriesInlineBar = memo(function StoriesInlineBar({
  onOpenProfile,
  onOpenReel,
  onOpenLive,
  isActive,
}: StoriesInlineBarProps) {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<MapStoryEntry[]>([]);
  const [myStories, setMyStories] = useState<MapStory[]>([]);
  const [storiesByUser, setStoriesByUser] = useState<Map<string, MapStory[]>>(new Map());
  const [sheet, setSheet] = useState<StorySheetState>({ kind: 'closed' });
  const [livePreview, setLivePreview] = useState<LivePreviewState>({ kind: 'closed' });
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(isMapStoriesCollapsed);
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
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

  useEffect(() => {
    const syncPrefs = () => setPrefs(getNearbyPanelPreferences());
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    return () => {
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    };
  }, []);

  const countLabel = useMemo(() => {
    if (loading) return '…';
    return String(entries.length + (user && token ? 1 : 0));
  }, [entries.length, loading, token, user]);

  const loadStories = useCallback(async () => {
    if (!token) {
      setEntries([]);
      setMyStories([]);
      setStoriesByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      const [favRes, feedRes, livesOrNull, storiesBundle] = await Promise.all([
        api.getMyFavorites(token),
        api.getReelsFeed(token),
        api.getLives(token, { distanceFilter: false }).catch(() => null),
        fetchStoriesBundle(token),
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

      const followedEphemeral = storiesBundle.stories.filter((s) => isFollowed(s.userId));
      const byUser = groupStoriesByUser(followedEphemeral);
      setStoriesByUser(byUser);
      const mine = storiesBundle.mine;
      setMyStories(mine);

      if (user?.id) {
        const activeIds = [...followedEphemeral, ...mine].map((s) => s.id);
        setSeenStoryIds((prev) => {
          const pruned = pruneSeenStoryIds(prev, activeIds);
          if (pruned === prev) return prev;
          saveSeenStoryIds(user.id, pruned);
          return pruned;
        });
      }

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
      setMyStories([]);
      setStoriesByUser(new Map());
    } finally {
      setLoading(false);
    }
  }, [token, prefs.favoritesFirst, user?.id]);

  useEffect(() => {
    if (!isActive) return;
    void loadStories();
  }, [isActive, loadStories]);

  const openEntry = (entry: MapStoryEntry) => {
    if (entry.hasActiveStory && entry.storyId) {
      const userStories = storiesByUser.get(entry.userId);
      const story = userStories ? pickInitialStory(userStories) : undefined;
      if (story) {
        markStoryAsSeen(story.id);
        setSheet({ kind: 'view', story, isOwn: entry.userId === user?.id });
        return;
      }
    }
    if (entry.isLive && entry.liveId) {
      setLivePreview({ kind: 'open', entry, liveId: entry.liveId });
      return;
    }
    if (entry.reelId && onOpenReel) {
      onOpenReel(entry.reelId);
      return;
    }
    onOpenProfile(entry.userId);
  };

  const openMyStory = () => {
    if (myStories.length) {
      const story = pickInitialStory(myStories) ?? myStories[0]!;
      markStoryAsSeen(story.id);
      setSheet({ kind: 'view', story, isOwn: true });
    } else {
      setSheet({ kind: 'create' });
    }
  };

  const handlePublished = (story: MapStory) => {
    invalidateStoriesCache();
    setMyStories((prev) => [...prev, story].sort((a, b) => a.createdAt - b.createdAt));
    setStoriesByUser((prev) => {
      const next = new Map(prev);
      const list = [...(next.get(story.userId) ?? []), story].sort((a, b) => a.createdAt - b.createdAt);
      next.set(story.userId, list);
      return next;
    });
    void loadStories();
  };

  const myLatestStory = latestStory(myStories);

  const showEmptyGuest = !loading && entries.length === 0 && !user;
  const showEmptyFollowing = !loading && entries.length === 0 && Boolean(user && token);

  const sortedEntries = useMemo(() => {
    const unseen = entries.filter((e) => {
      if (!e.hasActiveStory) return true;
      const stack = storiesByUser.get(e.userId);
      return !stack?.length || !areAllStoriesSeen(stack, seenStoryIds);
    });
    const seen = entries.filter((e) => {
      if (!e.hasActiveStory) return false;
      const stack = storiesByUser.get(e.userId);
      return !!stack?.length && areAllStoriesSeen(stack, seenStoryIds);
    });
    return [...unseen, ...seen];
  }, [entries, seenStoryIds, storiesByUser]);

  const ringCount = useMemo(
    () => sortedEntries.length + (user && token ? 1 : 0),
    [sortedEntries.length, token, user]
  );

  const storyStacks = useMemo(
    () => buildStoryUserStacks(entries, storiesByUser, myStories),
    [entries, storiesByUser, myStories]
  );

  const viewerStack =
    sheet.kind === 'view' ? findStackForStory(storyStacks, sheet.story) : undefined;

  const {
    goNextStory,
    goPrevStory,
    canNextStory,
    canPrevStory,
    viewerStack: hookViewerStack,
    viewerStackIndex,
    sponsorAd,
  } = useStoryViewerWithSponsors(storyStacks, user?.id, sheet, setSheet, markStoryAsSeen);

  const activeViewerStack = sheet.kind === 'view' ? viewerStack : hookViewerStack;

  const handleStoryDeleted = useCallback(
    (deleted: MapStory) => {
      invalidateStoriesCache();
      setMyStories((prev) => prev.filter((s) => s.id !== deleted.id));
      setStoriesByUser((prev) => {
        const next = new Map(prev);
        const list = (next.get(deleted.userId) ?? []).filter((s) => s.id !== deleted.id);
        if (list.length) next.set(deleted.userId, list);
        else next.delete(deleted.userId);
        return next;
      });
      const nav = resolveAfterStoryDeleted(storyStacks, deleted, user?.id);
      if (nav.action === 'close') setSheet({ kind: 'closed' });
      else setSheet({ kind: 'view', story: nav.story, isOwn: nav.isOwn });
      void loadStories();
    },
    [storyStacks, user?.id, loadStories]
  );

  return (
    <>
      <div className="rounded-xl border border-[var(--ms-border)] bg-[var(--ms-surface)] overflow-hidden min-w-0">
        <div className="w-full min-w-0">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--ms-border)]/80">
            <button
              type="button"
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                setMapStoriesCollapsed(next);
              }}
              className="flex-1 flex items-center gap-1.5 min-w-0 min-h-11 text-left"
              aria-expanded={!collapsed}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
                Stories
              </span>
              <span className="text-[9px] text-[var(--ms-text-muted)]">({countLabel})</span>
              <svg
                viewBox="0 0 24 24"
                className={`w-3.5 h-3.5 text-gray-300 shrink-0 transition ${collapsed ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <StoriesAdBanner
                onCtaSalon={() => dispatchMapOpenCreateSalon()}
                onCtaLive={onOpenLive ? () => onOpenLive('') : undefined}
              />
              {loading && entries.length === 0 && !user ? (
                <p className="text-[10px] text-[var(--ms-text-muted)] text-center py-2 px-2">Chargement des stories…</p>
              ) : showEmptyGuest ? (
                <p className="text-[10px] text-[var(--ms-text-muted)] text-center py-2 px-2 leading-snug">
                  Aucune story pour le moment.
                </p>
              ) : (
                <>
                  <StoriesRingsCarousel itemCount={ringCount}>
                    {user && token ? (
                      <MyMapStoryRing
                        userId={user.id}
                        username={user.username}
                        avatarUrl={user.profilePhotos?.find(p => !!p) ?? user.avatarUrl}
                        hasActiveStory={myStories.length > 0}
                        storyImageUrl={myLatestStory?.imageUrl}
                        storyCount={myStories.length}
                        onClick={openMyStory}
                        onAddClick={() => setSheet({ kind: 'create' })}
                      />
                    ) : null}
                    {sortedEntries.map((entry) => {
                      const userStoryIds = storiesByUser.get(entry.userId)?.map((s) => s.id);
                      const stack = storiesByUser.get(entry.userId);
                      const entrySeen = stack?.length ? areAllStoriesSeen(stack, seenStoryIds) : false;
                      return (
                        <MapStoryRing
                          key={entry.userId}
                          entry={entry}
                          onClick={() => openEntry(entry)}
                          isSeen={entrySeen}
                          storyIds={userStoryIds}
                          seenStoryIds={seenStoryIds}
                        />
                      );
                    })}
                  </StoriesRingsCarousel>
                  {showEmptyFollowing ? (
                    <div className="px-3 py-2.5 text-center border-t border-[var(--ms-border)]/60">
                      <p className="text-[10px] text-gray-300 leading-snug">
                        Suivez des artistes pour voir leurs stories
                      </p>
                      <p className="mt-1 text-[9px] text-[var(--ms-text-muted)]">
                        Parcourez la carte ou les profils pour vous abonner
                      </p>
                    </div>
                  ) : null}
                </>
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

      {(sheet.kind === 'view' || sheet.kind === 'view_sponsor') ? (
        <StoryViewer
          story={sheet.kind === 'view' ? sheet.story : undefined}
          stack={activeViewerStack?.stories}
          stackIndex={viewerStackIndex}
          sponsorAd={sponsorAd}
          onClose={() => setSheet({ kind: 'closed' })}
          onNext={goNextStory}
          onPrev={goPrevStory}
          canNext={canNextStory}
          canPrev={canPrevStory}
          isOwn={sheet.kind === 'view' ? sheet.isOwn : false}
          token={token ?? undefined}
          onDeleted={sheet.kind === 'view' ? handleStoryDeleted : undefined}
        />
      ) : null}

      {token && livePreview.kind === 'open' ? (
        <StoryLivePreviewViewer
          entry={livePreview.entry}
          liveId={livePreview.liveId}
          token={token}
          onClose={() => setLivePreview({ kind: 'closed' })}
          onJoin={(id) => onOpenLive?.(id)}
        />
      ) : null}
    </>
  );
});
