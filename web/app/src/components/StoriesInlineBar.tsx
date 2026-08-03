import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { buildMapStoryEntries, filterMapStoryEntriesToFollowing, type MapStoryEntry } from '../lib/mapStoriesFeed';
import {
  areAllStoriesSeen,
  buildStoryUserStacks,
  findStackForStory,
  groupStoriesByUser,
  latestStory,
  pickInitialStory,
  pruneSeenStoryIds,
  resolveAfterLivePreview,
  resolveBeforeLivePreview,
  resolveAfterStoryDeleted,
  resolveNextAfterLastStorySegment,
  stackIndexForStory,
} from '../lib/storyViewerNav';
import {
  getNearbyPanelPreferences,
  NEARBY_PANEL_CHANGED_EVENT,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import { fetchStoriesBundle, invalidateStoriesCache } from '../lib/storiesApiCache';
import {
  buildActiveLiveByHost,
} from '../lib/mapLiveEndSync';
import { pickFollowedActiveLives } from '../lib/followedLives';
import { purgeEndedLiveFromStoryEntries } from '../lib/mapStoriesFeed';
import { getSocket } from '../lib/socket';
import { normalizeProfileReelFromApi } from '../content/reelsFeed';
import type { MusicReel } from '../content/reels';
import type { MapStory, NearbyPerson } from '../types';
import { MapStorySheet } from './MapStorySheet';
import { MapStoryRing, MyMapStoryRing, StoryCreateRing } from './MapStoryRings';
import { StoryLivePreviewViewer } from './StoryLivePreviewViewer';
import { StorySalonPreviewViewer } from './StorySalonPreviewViewer';
import { StoryViewer } from './StoryViewer';
import { useStoryViewerWithSponsors } from '../hooks/useStoryViewerWithSponsors';
import { StoriesRingsCarousel } from './StoriesRingsCarousel';

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

type SalonPreviewState =
  | { kind: 'closed' }
  | { kind: 'open'; entry: MapStoryEntry; salonId: string };

export interface StoriesInlineBarProps {
  onOpenProfile: (userId: string) => void;
  onOpenReel?: (reelId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string) => void;
  onOpenLive?: (liveId: string) => void;
  isActive: boolean;
}

export const StoriesInlineBar = memo(function StoriesInlineBar({
  onOpenProfile,
  onOpenReel,
  onOpenSalon,
  onOpenLive,
  isActive,
}: StoriesInlineBarProps) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<MapStoryEntry[]>([]);
  const [myStories, setMyStories] = useState<MapStory[]>([]);
  const [storiesByUser, setStoriesByUser] = useState<Map<string, MapStory[]>>(new Map());
  const [sheet, setSheet] = useState<StorySheetState>({ kind: 'closed' });
  const [livePreview, setLivePreview] = useState<LivePreviewState>({ kind: 'closed' });
  const [salonPreview, setSalonPreview] = useState<SalonPreviewState>({ kind: 'closed' });
  const [loading, setLoading] = useState(false);
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

  const loadStories = useCallback(async () => {
    if (!token) {
      setEntries([]);
      setMyStories([]);
      setStoriesByUser(new Map());
      return;
    }
    setLoading(true);
    try {
      const [favRes, feedRes, followingRes, livesOrNull, salonsOrNull, storiesBundle] =
        await Promise.all([
        api.getMyFavorites(token),
        api.getReelsFeed(token),
        api.getMyFollowing(token),
        api.getLives(token, { distanceFilter: false }).catch(() => null),
        api.listSalons(token).catch(() => ({ salons: [] as import('../types').Salon[] })),
        fetchStoriesBundle(token),
      ]);
      const favoriteIds = new Set(favRes.favorites.map((f) => f.id));
      const followingIds = new Set(followingRes.followingIds);
      const isFollowingUser = (userId: string) => followingIds.has(userId);

      const userInfoById = new Map<string, { username: string; avatarUrl?: string }>(
        favRes.favorites.map((f) => [f.id, { username: f.username, avatarUrl: f.avatarUrl }])
      );
      for (const u of followingRes.following) {
        userInfoById.set(u.id, { username: u.username, avatarUrl: u.avatarUrl });
      }

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
      const followedActiveLives = pickFollowedActiveLives(
        livesOrNull?.lives ?? [],
        followingIds
      );
      const activeLiveByHost = buildActiveLiveByHost(followedActiveLives, { storyRingOnly: false });

      for (const live of followedActiveLives) {
        if (syntheticIds.has(live.hostId)) continue;
        syntheticIds.add(live.hostId);
        if (live.hostName?.trim()) {
          userInfoById.set(live.hostId, {
            username: live.hostName,
            avatarUrl: live.hostAvatarUrl,
          });
        }
        syntheticPeople.push({
          id: live.hostId,
          username: live.hostName,
          avatarUrl: live.hostAvatarUrl,
          isLive: true,
          liveId: live.id,
          liveViewersCount: live.viewersCount,
        });
      }

      for (const salon of salonsOrNull.salons) {
        if (!isFollowingUser(salon.hostId)) continue;
        if (salon.isLive) continue;
        if (syntheticIds.has(salon.hostId)) continue;
        syntheticIds.add(salon.hostId);
        const host = followingRes.following.find((u) => u.id === salon.hostId);
        userInfoById.set(salon.hostId, {
          username: host?.username ?? salon.hostName,
          avatarUrl: host?.avatarUrl ?? salon.hostAvatarUrl,
        });
        syntheticPeople.push({
          id: salon.hostId,
          username: host?.username ?? salon.hostName,
          avatarUrl: host?.avatarUrl ?? salon.hostAvatarUrl,
          salonId: salon.id,
          salonTitle: salon.title,
        });
      }

      for (const reel of reels) {
        const aid = reel.authorId?.trim();
        if (!aid || syntheticIds.has(aid) || !isFollowingUser(aid)) continue;
        const info = userInfoById.get(aid);
        if (!info) continue;
        syntheticIds.add(aid);
        syntheticPeople.push({ id: aid, username: info.username, avatarUrl: info.avatarUrl });
      }

      // Fil Accueil : stories des comptes suivis uniquement (pas toutes les stories publiques).
      const ephemeralStories = storiesBundle.stories.filter((s) => isFollowingUser(s.userId));
      const byUser = groupStoriesByUser(ephemeralStories);
      setStoriesByUser(byUser);
      const mine = storiesBundle.mine;
      setMyStories(mine);

      if (user?.id) {
        const activeIds = [...ephemeralStories, ...mine].map((s) => s.id);
        setSeenStoryIds((prev) => {
          const pruned = pruneSeenStoryIds(prev, activeIds);
          if (pruned === prev) return prev;
          saveSeenStoryIds(user.id, pruned);
          return pruned;
        });
      }

      const filteredPeople = syntheticPeople.filter((p) => p.id !== user?.id);
      const followedProfiles = followingRes.following.filter((u) => u.id !== user?.id);
      setEntries(
        filterMapStoryEntriesToFollowing(
          buildMapStoryEntries(filteredPeople, followedProfiles, reels, {
            favoritesFirst: prefs.favoritesFirst,
            favoriteIds,
            ephemeralStories,
            activeLiveByHost,
          }),
          followingIds,
          user?.id
        )
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

  useEffect(() => {
    if (!isActive || !token) return;
    const socket = getSocket();
    if (!socket) return;
    const onLiveEnded = (payload: { liveId?: string; hostId?: string }) => {
      const endedId = payload?.liveId;
      const hostId = payload?.hostId;
      if (!endedId && !hostId) return;
      setEntries((prev) => purgeEndedLiveFromStoryEntries(prev, endedId ?? '', hostId));
    };
    socket.on('live_ended', onLiveEnded);
    return () => {
      socket.off('live_ended', onLiveEnded);
    };
  }, [isActive, token]);

  const openEntry = useCallback(
    (entry: MapStoryEntry) => {
      if (entry.isLive && entry.liveId) {
        setSheet({ kind: 'closed' });
        setLivePreview({ kind: 'open', entry, liveId: entry.liveId });
        return;
      }
      if (
        entry.salonId &&
        !entry.isLive &&
        !entry.hasActiveStory &&
        !entry.reelId
      ) {
        setLivePreview({ kind: 'closed' });
        setSheet({ kind: 'closed' });
        setSalonPreview({ kind: 'open', entry, salonId: entry.salonId });
        return;
      }
      if (entry.hasActiveStory && entry.storyId) {
        const userStories = storiesByUser.get(entry.userId);
        const story = userStories ? pickInitialStory(userStories) : undefined;
        if (story) {
          markStoryAsSeen(story.id);
          setLivePreview({ kind: 'closed' });
          setSheet({ kind: 'view', story, isOwn: entry.userId === user?.id });
          return;
        }
      }
      if (entry.reelId && onOpenReel) {
        onOpenReel(entry.reelId);
        return;
      }
      onOpenProfile(entry.userId);
    },
    [storiesByUser, markStoryAsSeen, user?.id, onOpenReel, onOpenProfile]
  );

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

  const advanceAfterLivePreview = useCallback(() => {
    setLivePreview((prev) => {
      if (prev.kind !== 'open') return prev;
      const current = prev.entry;
      const action = resolveAfterLivePreview(sortedEntries, current);
      if (action.type === 'close') {
        return { kind: 'closed' };
      }
      if (action.type === 'story') {
        const userStories = storiesByUser.get(action.entry.userId);
        const story = userStories ? pickInitialStory(userStories) : undefined;
        if (story) {
          markStoryAsSeen(story.id);
          setSheet({ kind: 'view', story, isOwn: action.entry.userId === user?.id });
        }
        return { kind: 'closed' };
      }
      return { kind: 'open', entry: action.entry, liveId: action.entry.liveId! };
    });
  }, [sortedEntries, storiesByUser, markStoryAsSeen, user?.id]);

  const retreatBeforeLivePreview = useCallback(() => {
    setLivePreview((prev) => {
      if (prev.kind !== 'open') return prev;
      const current = prev.entry;
      const action = resolveBeforeLivePreview(sortedEntries, current);
      if (action.type === 'close') {
        return { kind: 'closed' };
      }
      if (action.type === 'story') {
        const userStories = storiesByUser.get(action.entry.userId);
        const story = userStories ? pickInitialStory(userStories) : undefined;
        if (story) {
          markStoryAsSeen(story.id);
          setSheet({ kind: 'view', story, isOwn: action.entry.userId === user?.id });
        }
        return { kind: 'closed' };
      }
      return { kind: 'open', entry: action.entry, liveId: action.entry.liveId! };
    });
  }, [sortedEntries, storiesByUser, markStoryAsSeen, user?.id]);

  const livePreviewNav = useMemo(() => {
    if (livePreview.kind !== 'open') {
      return { canNext: false, canPrev: false };
    }
    const entry = livePreview.entry;
    return {
      canNext: resolveAfterLivePreview(sortedEntries, entry).type !== 'close',
      canPrev: resolveBeforeLivePreview(sortedEntries, entry).type !== 'close',
    };
  }, [livePreview, sortedEntries]);

  const ringCount = useMemo(
    () => sortedEntries.length + (user && token ? 1 : 0),
    [sortedEntries.length, token, user]
  );

  const openCreate = useCallback(() => setSheet({ kind: 'create' }), []);

  const storyStacks = useMemo(
    () => buildStoryUserStacks(entries, storiesByUser, myStories),
    [entries, storiesByUser, myStories]
  );

  const viewerStack =
    sheet.kind === 'view' ? findStackForStory(storyStacks, sheet.story) : undefined;

  const {
    goNextStory: hookGoNextStory,
    goPrevStory: hookGoPrevStory,
    canNextStory: hookCanNextStory,
    canPrevStory: hookCanPrevStory,
    viewerStack: hookViewerStack,
    viewerStackIndex,
    sponsorAd,
  } = useStoryViewerWithSponsors(storyStacks, user?.id, sheet, setSheet, markStoryAsSeen);

  const goNextStory = useCallback(() => {
    if (sheet.kind === 'view_sponsor') {
      hookGoNextStory();
      return;
    }
    if (sheet.kind !== 'view') return;

    const stack = findStackForStory(storyStacks, sheet.story);
    const segIdx = stack ? stackIndexForStory(stack, sheet.story) : 0;
    if (stack && segIdx < stack.stories.length - 1) {
      hookGoNextStory();
      return;
    }

    const carouselNext = resolveNextAfterLastStorySegment(
      sortedEntries,
      storiesByUser,
      sheet.story.userId,
      user?.id
    );
    if (carouselNext?.kind === 'live') {
      markStoryAsSeen(sheet.story.id);
      setSheet({ kind: 'closed' });
      setLivePreview({ kind: 'open', entry: carouselNext.entry, liveId: carouselNext.liveId });
      return;
    }
    if (carouselNext?.kind === 'story') {
      markStoryAsSeen(carouselNext.story.id);
      setSheet({ kind: 'view', story: carouselNext.story, isOwn: carouselNext.isOwn });
      return;
    }

    hookGoNextStory();
  }, [
    sheet,
    storyStacks,
    sortedEntries,
    storiesByUser,
    user?.id,
    hookGoNextStory,
    markStoryAsSeen,
    setSheet,
  ]);

  const canNextStory = useMemo(() => {
    if (sheet.kind === 'view_sponsor') return hookCanNextStory;
    if (sheet.kind !== 'view') return false;

    const stack = findStackForStory(storyStacks, sheet.story);
    const segIdx = stack ? stackIndexForStory(stack, sheet.story) : 0;
    if (stack && segIdx < stack.stories.length - 1) return hookCanNextStory;

    return (
      resolveNextAfterLastStorySegment(
        sortedEntries,
        storiesByUser,
        sheet.story.userId,
        user?.id
      ) != null || hookCanNextStory
    );
  }, [sheet, storyStacks, sortedEntries, storiesByUser, user?.id, hookCanNextStory]);

  const goPrevStory = hookGoPrevStory;
  const canPrevStory = hookCanPrevStory;

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
        <div className="w-full min-w-0 min-h-0">
          {loading && entries.length === 0 && !user ? (
              <p className="text-[10px] text-[var(--ms-text-muted)] text-center py-3 px-3">
                {t('stories.rail.loading')}
              </p>
            ) : showEmptyGuest ? (
              <p className="text-[10px] text-[var(--ms-text-muted)] text-center py-3 px-3 leading-snug">
                {t('stories.rail.emptyGuest')}
              </p>
            ) : (
              <>
                <StoriesRingsCarousel itemCount={ringCount}>
                  {user && token ? (
                    myStories.length > 0 ? (
                      <MyMapStoryRing
                        userId={user.id}
                        username={user.username}
                        avatarUrl={user.profilePhotos?.find((p) => !!p) ?? user.avatarUrl}
                        hasActiveStory
                        storyImageUrl={myLatestStory?.imageUrl}
                        storyCount={myStories.length}
                        viewLabel={t('stories.rail.myStory')}
                        addLabel={t('stories.rail.addShort')}
                        onClick={openMyStory}
                        onAddClick={openCreate}
                      />
                    ) : (
                      <StoryCreateRing
                        userId={user.id}
                        username={user.username}
                        avatarUrl={user.profilePhotos?.find((p) => !!p) ?? user.avatarUrl}
                        label={t('stories.rail.create')}
                        onClick={openCreate}
                      />
                    )
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
              </>
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
          stack={
            activeViewerStack?.stories ??
            (sheet.kind === 'view' ? [sheet.story] : undefined)
          }
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
          onPreviewElapsed={advanceAfterLivePreview}
          onNext={advanceAfterLivePreview}
          canNext={livePreviewNav.canNext}
          onPrev={retreatBeforeLivePreview}
          canPrev={livePreviewNav.canPrev}
        />
      ) : null}

      {token && salonPreview.kind === 'open' ? (
        <StorySalonPreviewViewer
          entry={salonPreview.entry}
          salonId={salonPreview.salonId}
          token={token}
          onClose={() => setSalonPreview({ kind: 'closed' })}
          onJoin={(id, title) => onOpenSalon?.(id, title)}
        />
      ) : null}
    </>
  );
});
