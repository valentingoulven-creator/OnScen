import { describe, expect, it } from 'vitest';
import type { MapStory } from '../types';
import {
  STORY_VIEW_DURATION_MS,
  areAllStoriesSeen,
  pickInitialStory,
  pruneSeenStoryIds,
  sortStoriesChronological,
} from './storyViewerNav';

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

describe('sortStoriesChronological', () => {
  it('orders oldest to newest', () => {
    const sorted = sortStoriesChronological([story('b', 2), story('a', 1), story('c', 3)]);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});
