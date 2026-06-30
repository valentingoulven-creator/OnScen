import { describe, expect, it } from 'vitest';
import { shouldAlertForIncomingDm } from './dmMuteAlerts';

describe('shouldAlertForIncomingDm', () => {
  const muted = new Set(['user-muted']);

  it('returns false when thread with sender is open', () => {
    expect(shouldAlertForIncomingDm(muted, 'user-muted', true)).toBe(false);
    expect(shouldAlertForIncomingDm(new Set(), 'any', true)).toBe(false);
  });

  it('returns false for muted sender', () => {
    expect(shouldAlertForIncomingDm(muted, 'user-muted', false)).toBe(false);
  });

  it('returns true for non-muted sender outside open thread', () => {
    expect(shouldAlertForIncomingDm(muted, 'user-other', false)).toBe(true);
    expect(shouldAlertForIncomingDm(new Set(), 'user-other', false)).toBe(true);
  });
});
