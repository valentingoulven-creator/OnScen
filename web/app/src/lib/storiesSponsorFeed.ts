import type { ReelsSponsorAd } from '../types';
import type { StoryUserStack } from './storyViewerNav';

export const DEFAULT_STORIES_SPONSOR_EVERY_N = 4;

export type StoriesSponsorConfig = {
  storiesSponsorEnabled: boolean;
  storiesSponsorEveryN: number;
};

export const DEFAULT_STORIES_SPONSOR_CONFIG: StoriesSponsorConfig = {
  storiesSponsorEnabled: true,
  storiesSponsorEveryN: DEFAULT_STORIES_SPONSOR_EVERY_N,
};

export type StoryViewerTimelineItem =
  | {
      kind: 'story';
      story: import('../types').MapStory;
      stack: StoryUserStack;
      stackIndex: number;
      isOwn: boolean;
    }
  | { kind: 'sponsor'; ad: ReelsSponsorAd; key: string };

export function storiesSponsorDisplayKey(ad: ReelsSponsorAd, insertIndex: number): string {
  return `sponsor:${ad.id}:${insertIndex}`;
}

export function normalizeStoriesSponsorEveryN(
  raw: unknown,
  fallback = DEFAULT_STORIES_SPONSOR_EVERY_N
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function flattenStoryStacks(
  stacks: StoryUserStack[],
  viewerUserId?: string
): Extract<StoryViewerTimelineItem, { kind: 'story' }>[] {
  const items: Extract<StoryViewerTimelineItem, { kind: 'story' }>[] = [];
  for (const stack of stacks) {
    stack.stories.forEach((story, stackIndex) => {
      items.push({
        kind: 'story',
        story,
        stack,
        stackIndex,
        isOwn: story.userId === viewerUserId,
      });
    });
  }
  return items;
}

/** Insère une pub sponsorisée tous les N segments story (comme les reels). */
export function buildStoryViewerTimeline(
  stacks: StoryUserStack[],
  ads: ReelsSponsorAd[],
  config: StoriesSponsorConfig,
  viewerUserId?: string
): StoryViewerTimelineItem[] {
  const stories = flattenStoryStacks(stacks, viewerUserId);
  if (!config.storiesSponsorEnabled || ads.length === 0 || stories.length === 0) {
    return stories;
  }

  const everyN = normalizeStoriesSponsorEveryN(config.storiesSponsorEveryN);
  const result: StoryViewerTimelineItem[] = [];
  let adIndex = 0;
  let organicSinceLastSponsor = 0;
  let sponsorInsertIndex = 0;

  for (const storyItem of stories) {
    result.push(storyItem);
    organicSinceLastSponsor += 1;

    if (organicSinceLastSponsor >= everyN) {
      const ad = ads[adIndex % ads.length]!;
      result.push({
        kind: 'sponsor',
        ad,
        key: storiesSponsorDisplayKey(ad, sponsorInsertIndex),
      });
      adIndex += 1;
      sponsorInsertIndex += 1;
      organicSinceLastSponsor = 0;
    }
  }

  return result;
}

export function timelineIndexForStory(
  timeline: StoryViewerTimelineItem[],
  storyId: string
): number {
  return timeline.findIndex((item) => item.kind === 'story' && item.story.id === storyId);
}

export function timelineIndexForSponsorKey(
  timeline: StoryViewerTimelineItem[],
  sponsorKey: string
): number {
  return timeline.findIndex((item) => item.kind === 'sponsor' && item.key === sponsorKey);
}
