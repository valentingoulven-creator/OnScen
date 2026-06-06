import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatFeedTimestamp } from './feedTime';

describe('formatFeedTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche l’heure pour le jour courant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T15:30:00'));
    const ts = new Date('2026-06-04T10:00:00').getTime();
    const out = formatFeedTimestamp(ts);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it('affiche la date pour un autre jour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T15:30:00'));
    const ts = new Date('2026-06-01T10:00:00').getTime();
    const out = formatFeedTimestamp(ts);
    expect(out.toLowerCase()).toContain('juin');
  });
});
