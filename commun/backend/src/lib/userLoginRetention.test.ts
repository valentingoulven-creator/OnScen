import { describe, expect, it, beforeEach } from 'vitest';
import { recordUserLoginDay, restoreUserLoginDays, userHasLoginInRange } from './userLoginRetention';

describe('userLoginRetention', () => {
  beforeEach(() => {
    restoreUserLoginDays(undefined);
  });

  it('records login days and detects range', () => {
    const reg = Date.parse('2026-01-01T12:00:00.000Z');
    recordUserLoginDay('u1', reg + 8 * 86_400_000);
    expect(userHasLoginInRange('u1', reg + 7 * 86_400_000, reg + 14 * 86_400_000)).toBe(true);
    expect(userHasLoginInRange('u1', reg + 28 * 86_400_000, reg + 35 * 86_400_000)).toBe(false);
  });
});
