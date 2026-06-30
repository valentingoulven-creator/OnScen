import { describe, expect, it } from 'vitest';
import { isLoginBlocked, recordLoginFailure, clearLoginFailures } from './loginAttemptLimit';

describe('loginAttemptLimit', () => {
  it('blocks after repeated failures', async () => {
    const email = `test_${Date.now()}@example.com`;
    for (let i = 0; i < 10; i++) {
      await recordLoginFailure(email);
    }
    expect(await isLoginBlocked(email)).toBe(true);
    await clearLoginFailures(email);
    expect(await isLoginBlocked(email)).toBe(false);
  });
});
