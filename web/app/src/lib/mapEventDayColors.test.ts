import { describe, expect, it } from 'vitest';
import {
  getBrowseSectionDayColor,
  getDefaultMapEventBrowseDayKeys,
  getMapEventBrowseDayIndex,
  getMapEventDayColor,
  getMapEventDayIndexFromIso,
  MAP_EVENT_BROWSE_SECTION_COLORS,
  resolveClusterMapPinSponsored,
  resolveEventMapPinHtml,
  resolveMapEventMarkerPinColor,
  resolveMapEventPinColor,
} from './mapEventDayColors';
import { getNextCalendarDayKeys, MAP_EVENTS_BROWSE_DAY_COUNT } from './feedEvents';

describe('mapEventDayColors', () => {
  const from = new Date('2026-07-20T12:00:00');
  const dayKeys = getNextCalendarDayKeys(MAP_EVENTS_BROWSE_DAY_COUNT, from);

  it('assigns browse day index from calendar day key', () => {
    expect(dayKeys).toHaveLength(MAP_EVENTS_BROWSE_DAY_COUNT);
    expect(getMapEventBrowseDayIndex(dayKeys[0]!, from)).toBe(0);
    expect(getMapEventBrowseDayIndex(dayKeys[1]!, from)).toBe(1);
    expect(getMapEventBrowseDayIndex(dayKeys[2]!, from)).toBe(2);
    expect(getMapEventBrowseDayIndex('2026-07-24', from)).toBe(-1);
  });

  it('maps day index to green blue orange violet', () => {
    expect(getMapEventDayColor(0)).toBe('#22c55e');
    expect(getMapEventDayColor(1)).toBe('#3b82f6');
    expect(getMapEventDayColor(2)).toBe('#f97316');
    expect(getMapEventDayColor(3)).toBe('#8b5cf6');
  });

  it('cycles distinct browse section colors beyond the default map window', () => {
    expect(getBrowseSectionDayColor(0)).toBe('#22c55e');
    expect(getBrowseSectionDayColor(3)).toBe('#8b5cf6');
    expect(getBrowseSectionDayColor(4)).toBe('#a855f7');
    expect(getBrowseSectionDayColor(5)).not.toBe(getBrowseSectionDayColor(4));
  });

  it('never uses black for out-of-window day keys', () => {
    const color = resolveMapEventPinColor('2026-08-15', dayKeys);
    expect(color).not.toBe('#171717');
    expect(MAP_EVENT_BROWSE_SECTION_COLORS as readonly string[]).toContain(color);
  });

  it('resolves map pin color from browse day keys', () => {
    const keys = ['2026-07-22', '2026-07-23', '2026-07-29'];
    expect(resolveMapEventPinColor('2026-07-29', keys)).toBe(getBrowseSectionDayColor(2));
    expect(resolveMapEventPinColor('2026-07-29', keys)).toBe('#f97316');
  });

  it('uses in-window occurrence for marker pin color, not primary date only', () => {
    const keys = getDefaultMapEventBrowseDayKeys(new Date('2026-07-22T12:00:00'));
    const tomorrow = keys[1]!;
    const marker = {
      eventDate: `${keys[2] ?? '2026-07-24'}T20:00:00`,
      eventDates: [`${keys[2] ?? '2026-07-24'}T20:00:00`, `${tomorrow}T20:00:00`],
    };
    expect(resolveMapEventMarkerPinColor(marker, keys)).toBe(getBrowseSectionDayColor(1));
  });

  it('derives day index from event iso', () => {
    expect(getMapEventDayIndexFromIso(`${dayKeys[0]!}T18:00:00`, from)).toBe(0);
    expect(getMapEventDayIndexFromIso(`${dayKeys[2]!}T18:00:00`, from)).toBe(2);
  });

  it('uses sparkle pin html for sponsored events', () => {
    const html = resolveEventMapPinHtml({ dayIndex: 0, isSponsored: true });
    expect(html).toContain('event-sponso-pin');
    expect(html).toContain('✨');
  });

  it('detects sponsored cluster for single sponsored marker', () => {
    expect(
      resolveClusterMapPinSponsored({
        events: [{ id: 'a', latitude: 1, longitude: 2, title: 'A', isSponsored: true }],
      })
    ).toBe(true);
    expect(
      resolveClusterMapPinSponsored({
        events: [{ id: 'a', latitude: 1, longitude: 2, title: 'A' }],
      })
    ).toBe(false);
  });
});
