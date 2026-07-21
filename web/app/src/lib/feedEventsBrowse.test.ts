import { describe, expect, it } from 'vitest';
import {
  getNextCalendarDayKeys,
  groupFeedPostsByCalendarDays,
  resolvePostBrowseDayKey,
} from './feedEvents';
import type { FeedPost } from '../types';

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

describe('resolvePostBrowseDayKey', () => {
  it('uses any upcoming occurrence in the day window, not only primary date', () => {
    const dayKeys = getNextCalendarDayKeys(4, new Date('2026-07-20T12:00:00'));
    const tomorrow = dayKeys[1]!;
    const post = mockEventPost('e1', [
      `${dayKeys[3]!}T20:00:00`,
      `${tomorrow}T20:00:00`,
    ]);

    expect(resolvePostBrowseDayKey(post, dayKeys)).toBe(tomorrow);
  });

  it('fallbackNearestDay keeps viewport posts in a visible section', () => {
    const dayKeys = getNextCalendarDayKeys(4, new Date('2026-07-20T12:00:00'));
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
    const dayKeys = getNextCalendarDayKeys(4, new Date('2026-07-20T12:00:00'));
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
