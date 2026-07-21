import { describe, expect, it } from 'vitest';
import {
  getMapEventBrowseDayIndex,
  getMapEventDayColor,
  getMapEventDayIndexFromIso,
} from './mapEventDayColors';
import { getNextCalendarDayKeys, MAP_EVENTS_BROWSE_DAY_COUNT } from './feedEvents';

describe('mapEventDayColors', () => {
  const from = new Date('2026-07-20T12:00:00');
  const dayKeys = getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, from);

  it('assigns browse day index from calendar day key', () => {
    expect(getMapEventBrowseDayIndex(dayKeys[0]!, from)).toBe(0);
    expect(getMapEventBrowseDayIndex(dayKeys[1]!, from)).toBe(1);
    expect(getMapEventBrowseDayIndex(dayKeys[2]!, from)).toBe(2);
    expect(getMapEventBrowseDayIndex(dayKeys[3]!, from)).toBe(3);
  });

  it('maps day index to green blue orange black', () => {
    expect(getMapEventDayColor(0)).toBe('#22c55e');
    expect(getMapEventDayColor(1)).toBe('#3b82f6');
    expect(getMapEventDayColor(2)).toBe('#f97316');
    expect(getMapEventDayColor(3)).toBe('#171717');
  });

  it('derives day index from event iso', () => {
    expect(getMapEventDayIndexFromIso(`${dayKeys[0]!}T18:00:00`, from)).toBe(0);
    expect(getMapEventDayIndexFromIso(`${dayKeys[2]!}T18:00:00`, from)).toBe(2);
  });
});
