import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type UserComposition } from '../models/schema';
import {
  getWeeklyCompositionPlayCounts,
  recordCompositionPlay,
} from './compositionPlays';
import { getWeekStart } from './weeklyVotes';

describe('compositionPlays', () => {
  const weekStart = getWeekStart();
  const now = weekStart + 60_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    db.compositions.length = 0;
    db.compositionPlays.length = 0;
    db.compositions.push({
      id: 'comp_1',
      userId: 'artist',
      title: 'Track',
      fileUrl: '/a.mp3',
      createdAt: now,
    } satisfies UserComposition);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts plays for the current week only', () => {
    recordCompositionPlay('comp_1', 'fan_a');
    vi.setSystemTime(now + 120_000);
    recordCompositionPlay('comp_1', 'fan_b');

    const counts = getWeeklyCompositionPlayCounts();
    expect(counts.get('comp_1')).toBe(2);
  });

  it('throttles duplicate plays from the same listener within 60s', () => {
    recordCompositionPlay('comp_1', 'fan_a');
    recordCompositionPlay('comp_1', 'fan_a');

    const counts = getWeeklyCompositionPlayCounts();
    expect(counts.get('comp_1')).toBe(1);
  });
});
