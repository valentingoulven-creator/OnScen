import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { mapApiItemToReelsSponsorAd } from '../lib/reelsSponsorFeed';
import {
  buildStoryViewerTimeline,
  DEFAULT_STORIES_SPONSOR_CONFIG,
  timelineIndexForSponsorKey,
  timelineIndexForStory,
  type StoriesSponsorConfig,
  type StoryViewerTimelineItem,
} from '../lib/storiesSponsorFeed';
import type { MapStory } from '../types';
import type { StoryUserStack } from '../lib/storyViewerNav';
import { findStackForStory, resolveNextStory, resolvePrevStory, stackIndexForStory } from '../lib/storyViewerNav';
import type { ReelsSponsorAd } from '../types';

export type StoryViewerSheetState =
  | { kind: 'closed' }
  | { kind: 'view'; story: MapStory; isOwn: boolean }
  | { kind: 'view_sponsor'; ad: ReelsSponsorAd; sponsorKey: string };

/** État visionneur élargi (ex. « create » sur la carte). */
export type StoryViewerSheetStateLike = StoryViewerSheetState | { kind: 'create' };

export function useStoryViewerWithSponsors(
  storyStacks: StoryUserStack[],
  viewerUserId: string | undefined,
  sheet: StoryViewerSheetStateLike,
  setSheet: (next: StoryViewerSheetState) => void,
  markStoryAsSeen: (storyId: string) => void
) {
  const [sponsorAds, setSponsorAds] = useState<ReelsSponsorAd[]>([]);
  const [sponsorConfig, setSponsorConfig] = useState<StoriesSponsorConfig>(
    DEFAULT_STORIES_SPONSOR_CONFIG
  );
  const frozenStacksRef = useRef<StoryUserStack[] | null>(null);

  const isViewing = sheet.kind === 'view' || sheet.kind === 'view_sponsor';

  useEffect(() => {
    if (!isViewing) {
      frozenStacksRef.current = null;
      return;
    }
    if (frozenStacksRef.current === null) {
      frozenStacksRef.current = storyStacks;
    }
  }, [isViewing, storyStacks]);

  const navStacks =
    isViewing && frozenStacksRef.current && frozenStacksRef.current.length > 0
      ? frozenStacksRef.current
      : storyStacks;

  useEffect(() => {
    let cancelled = false;
    void api
      .getStoriesViewerSponsors()
      .then((res) => {
        if (cancelled) return;
        setSponsorAds(res.items.map(mapApiItemToReelsSponsorAd));
        setSponsorConfig({
          storiesSponsorEnabled: res.config.storiesSponsorEnabled,
          storiesSponsorEveryN: res.config.storiesSponsorEveryN,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setSponsorAds([]);
          setSponsorConfig(DEFAULT_STORIES_SPONSOR_CONFIG);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = useMemo(
    () => buildStoryViewerTimeline(navStacks, sponsorAds, sponsorConfig, viewerUserId),
    [navStacks, sponsorAds, sponsorConfig, viewerUserId]
  );

  const currentTimelineIndex = useMemo(() => {
    if (sheet.kind === 'view') return timelineIndexForStory(timeline, sheet.story.id);
    if (sheet.kind === 'view_sponsor') return timelineIndexForSponsorKey(timeline, sheet.sponsorKey);
    return -1;
  }, [sheet, timeline]);

  const applyTimelineItem = useCallback(
    (item: StoryViewerTimelineItem) => {
      if (item.kind === 'story') {
        markStoryAsSeen(item.story.id);
        setSheet({ kind: 'view', story: item.story, isOwn: item.isOwn });
        return;
      }
      setSheet({ kind: 'view_sponsor', ad: item.ad, sponsorKey: item.key });
    },
    [markStoryAsSeen, setSheet]
  );

  const goNextStory = useCallback(() => {
    if (sheet.kind !== 'view' && sheet.kind !== 'view_sponsor') return;
    const idx = currentTimelineIndex;
    if (idx >= 0 && idx < timeline.length - 1) {
      applyTimelineItem(timeline[idx + 1]!);
      return;
    }
    if (sheet.kind === 'view') {
      const next = resolveNextStory(navStacks, sheet.story, viewerUserId);
      if (next) {
        markStoryAsSeen(next.story.id);
        setSheet({ kind: 'view', story: next.story, isOwn: next.isOwn });
      }
    }
  }, [
    sheet,
    currentTimelineIndex,
    timeline,
    applyTimelineItem,
    navStacks,
    viewerUserId,
    markStoryAsSeen,
    setSheet,
  ]);

  const goPrevStory = useCallback(() => {
    if (sheet.kind !== 'view' && sheet.kind !== 'view_sponsor') return;
    const idx = currentTimelineIndex;
    if (idx > 0) {
      applyTimelineItem(timeline[idx - 1]!);
      return;
    }
    if (sheet.kind === 'view') {
      const prev = resolvePrevStory(navStacks, sheet.story, viewerUserId);
      if (prev) {
        markStoryAsSeen(prev.story.id);
        setSheet({ kind: 'view', story: prev.story, isOwn: prev.isOwn });
      }
    }
  }, [
    sheet,
    currentTimelineIndex,
    timeline,
    applyTimelineItem,
    navStacks,
    viewerUserId,
    markStoryAsSeen,
    setSheet,
  ]);

  const canNextStory =
    (sheet.kind === 'view' || sheet.kind === 'view_sponsor') &&
    (currentTimelineIndex >= 0
      ? currentTimelineIndex < timeline.length - 1
      : sheet.kind === 'view' && resolveNextStory(navStacks, sheet.story, viewerUserId) != null);

  const canPrevStory =
    (sheet.kind === 'view' || sheet.kind === 'view_sponsor') &&
    (currentTimelineIndex > 0 ||
      (sheet.kind === 'view' && resolvePrevStory(navStacks, sheet.story, viewerUserId) != null));

  const viewerStack =
    sheet.kind === 'view' ? findStackForStory(navStacks, sheet.story) : undefined;
  const viewerStackIndex =
    sheet.kind === 'view' && viewerStack ? stackIndexForStory(viewerStack, sheet.story) : 0;

  return {
    goNextStory,
    goPrevStory,
    canNextStory,
    canPrevStory,
    viewerStack,
    viewerStackIndex,
    sponsorAd: sheet.kind === 'view_sponsor' ? sheet.ad : undefined,
  };
}
