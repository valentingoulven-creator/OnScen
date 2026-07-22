import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNextCalendarDayKeys,
  groupFeedPostsByCalendarDays,
  mergeBrowseDayKeysForMapPosts,
  resolvePostBrowseDayKey,
} from './feedEvents';
import type { FeedPost } from '../types';

const FIXED_NOW = new Date('2026-07-20T12:00:00');

function mockEventPost(
  id: string,
  eventDates: string[]
): Pick<FeedPost, 'id' | 'eventDate' | 'eventDates' | 'upvoteCount'> {
  return {
    id,
    eventDate: eventDates[0],
    eventDates,
    upvoteCount: 0,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolvePostBrowseDayKey', () => {
  it('uses any upcoming occurrence in the day window, not only primary date', () => {
    const dayKeys = getNextCalendarDayKeys(4, FIXED_NOW);
    const tomorrow = dayKeys[1]!;
    const post = mockEventPost('e1', [
      `${dayKeys[3]!}T20:00:00`,
      `${tomorrow}T20:00:00`,
    ]);

    expect(resolvePostBrowseDayKey(post, dayKeys)).toBe(tomorrow);
  });

  it('fallbackNearestDay keeps viewport posts in a visible section', () => {
    const dayKeys = getNextCalendarDayKeys(4, FIXED_NOW);
    const far = '2026-08-01';
    const post = mockEventPost('e2', [`${far}T20:00:00`]);

    expect(resolvePostBrowseDayKey(post, dayKeys)).toBeNull();
    expect(resolvePostBrowseDayKey(post, dayKeys, { fallbackNearestDay: true })).toBe(
      dayKeys[dayKeys.length - 1]
    );
  });
});

describe('groupFeedPostsByCalendarDays', () => {
  it('places multi-date events in the section matching an in-window occurrence', () => {
    const dayKeys = getNextCalendarDayKeys(4, FIXED_NOW);
    const tomorrow = dayKeys[1]!;
    const post = mockEventPost('e1', [
      `${dayKeys[3]!}T20:00:00`,
      `${tomorrow}T20:00:00`,
    ]) as FeedPost;

    const grouped = groupFeedPostsByCalendarDays([post], dayKeys);
    const tomorrowSection = grouped.find((g) => g.dayKey === tomorrow);
    expect(tomorrowSection?.posts.some((p) => p.id === 'e1')).toBe(true);
  });
});

describe('mergeBrowseDayKeysForMapPosts', () => {
  it('adds calendar days from map posts outside the default 3-day window', () => {
    const base = getNextCalendarDayKeys(3, new Date('2026-07-22T12:00:00'));
    const francofoliesDay = '2026-07-25';
    const posts = [mockEventPost('franco', [`${francofoliesDay}T20:00:00`])];

    expect(mergeBrowseDayKeysForMapPosts(base, posts)).toContain(francofoliesDay);
  });
});
