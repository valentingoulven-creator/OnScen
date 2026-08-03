import { describe, expect, it } from 'vitest';
import type { MapStory } from '../types';
import {
  STORY_VIEW_DURATION_MS,
  STORY_LIVE_PREVIEW_DURATION_MS,
  areAllStoriesSeen,
  pickInitialStory,
  pruneSeenStoryIds,
  resolveAfterLivePreview,
  resolveBeforeLivePreview,
  resolveAfterStoryDeleted,
  resolveNextAfterLastStorySegment,
  sortStoriesChronological,
} from './storyViewerNav';
import type { MapStoryEntry } from './mapStoriesFeed';

function story(id: string, createdAt: number): MapStory {
  return {
    id,
    userId: 'u1',
    createdAt,
    expiresAt: createdAt + 86_400_000,
    author: { id: 'u1', username: 'Alice' },
  };
}

describe('pickInitialStory', () => {
  it('returns oldest story for rewatch from the beginning', () => {
    const stories = [story('s3', 300), story('s1', 100), story('s2', 200)];
    expect(pickInitialStory(stories)?.id).toBe('s1');
  });

  it('returns first story even when all were already seen locally', () => {
    const stories = [story('s1', 100), story('s2', 200)];
    expect(pickInitialStory(stories)?.id).toBe('s1');
  });
});

describe('areAllStoriesSeen', () => {
  it('is true only when every story id is in the seen set', () => {
    const stories = [story('s1', 1), story('s2', 2)];
    expect(areAllStoriesSeen(stories, new Set(['s1']))).toBe(false);
    expect(areAllStoriesSeen(stories, new Set(['s1', 's2']))).toBe(true);
  });
});

describe('pruneSeenStoryIds', () => {
  it('drops expired story ids from local seen state', () => {
    const seen = new Set(['s1', 's2', 'gone']);
    const pruned = pruneSeenStoryIds(seen, ['s1', 's2']);
    expect([...pruned]).toEqual(['s1', 's2']);
  });

  it('returns same set reference when nothing to prune', () => {
    const seen = new Set(['s1']);
    expect(pruneSeenStoryIds(seen, ['s1'])).toBe(seen);
  });
});

describe('STORY_VIEW_DURATION_MS', () => {
  it('is 5 seconds for auto-advance timer', () => {
    expect(STORY_VIEW_DURATION_MS).toBe(5000);
  });
});

describe('STORY_LIVE_PREVIEW_DURATION_MS', () => {
  it('is 10 seconds before auto-advance from live preview', () => {
    expect(STORY_LIVE_PREVIEW_DURATION_MS).toBe(10_000);
  });
});

describe('resolveAfterLivePreview', () => {
  const entry = (userId: string, opts: Partial<MapStoryEntry> = {}): MapStoryEntry => ({
    userId,
    username: userId,
    isFavorite: false,
    ...opts,
  });

  it('opens same user stories after live when available', () => {
    const current = entry('a', { isLive: true, liveId: 'live-a', hasActiveStory: true, storyId: 's1' });
    const list = [current, entry('b', { hasActiveStory: true, storyId: 's2' })];
    expect(resolveAfterLivePreview(list, current)).toEqual({ type: 'story', entry: current });
  });

  it('skips to next ring story when current has no story', () => {
    const current = entry('a', { isLive: true, liveId: 'live-a' });
    const next = entry('b', { hasActiveStory: true, storyId: 's2' });
    expect(resolveAfterLivePreview([current, next], current)).toEqual({ type: 'story', entry: next });
  });

  it('closes when no following ring', () => {
    const current = entry('a', { isLive: true, liveId: 'live-a' });
    expect(resolveAfterLivePreview([current], current)).toEqual({ type: 'close' });
  });
});

describe('resolveBeforeLivePreview', () => {
  const entry = (userId: string, opts: Partial<MapStoryEntry> = {}): MapStoryEntry => ({
    userId,
    username: userId,
    isFavorite: false,
    ...opts,
  });

  it('returns previous ring with story', () => {
    const prev = entry('a', { hasActiveStory: true, storyId: 's1' });
    const current = entry('b', { isLive: true, liveId: 'live-b' });
    expect(resolveBeforeLivePreview([prev, current], current)).toEqual({ type: 'story', entry: prev });
  });
});

describe('sortStoriesChronological', () => {
  it('orders oldest to newest', () => {
    const sorted = sortStoriesChronological([story('b', 2), story('a', 1), story('c', 3)]);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('resolveNextAfterLastStorySegment', () => {
  const entry = (userId: string, opts: Partial<MapStoryEntry> = {}): MapStoryEntry => ({
    userId,
    username: userId,
    isFavorite: false,
    ...opts,
  });

  it('returns live-only ring after last story when it sits between story authors', () => {
    const entries = [
      entry('a', { hasActiveStory: true, storyId: 's-a' }),
      entry('b', { isLive: true, liveId: 'live-b' }),
      entry('c', { hasActiveStory: true, storyId: 's-c' }),
    ];
    const storiesByUser = new Map([
      ['a', [story('s-a', 1)]],
      ['c', [{ ...story('s-c', 2), userId: 'c' }]],
    ]);
    const next = resolveNextAfterLastStorySegment(entries, storiesByUser, 'a');
    expect(next).toEqual({
      kind: 'live',
      entry: entries[1],
      liveId: 'live-b',
    });
  });
});

describe('resolveAfterStoryDeleted', () => {
  it('shows next story in same stack when available', () => {
    const s1 = story('s1', 1);
    const s2 = { ...story('s2', 2), userId: 'u1' };
    const stacks = [{ userId: 'u1', stories: [s1, s2] }];
    const nav = resolveAfterStoryDeleted(stacks, s1, 'u1');
    expect(nav.action).toBe('view');
    if (nav.action === 'view') expect(nav.story.id).toBe('s2');
  });

  it('closes when last story is deleted', () => {
    const s1 = story('s1', 1);
    const stacks = [{ userId: 'u1', stories: [s1] }];
    expect(resolveAfterStoryDeleted(stacks, s1, 'u1')).toEqual({ action: 'close' });
  });
});
