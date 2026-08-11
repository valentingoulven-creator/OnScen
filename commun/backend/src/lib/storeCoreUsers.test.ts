import { describe, expect, it, vi } from 'vitest';
import { filterValidUsers, isValidUserRecord } from './storeCore';
import type { User } from '../models/schema';

function makeValidUser(overrides: Partial<User> & { id: string; email: string }): User {
  return {
    username: overrides.username ?? overrides.email.split('@')[0],
    passwordHash: 'hash',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

describe('filterValidUsers', () => {
  it('charge 9 utilisateurs valides et ignore 1 invalide (donor-test)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validUsers = Array.from({ length: 9 }, (_, i) =>
      makeValidUser({ id: `user_ok_${i}`, email: `user${i}@example.com` })
    );
    const donorTest = {
      id: 'user_stripe_donor_test',
      username: 'DonorTest',
      email: 'donor-test@onscen.com',
      age: 25,
      memberSince: 1700000000000,
    };
    const { valid, skippedIds } = filterValidUsers([...validUsers, donorTest]);
    expect(valid).toHaveLength(9);
    expect(skippedIds).toEqual(['user_stripe_donor_test']);
    expect(isValidUserRecord(donorTest)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('donor-test@onscen.com')
    );
    warn.mockRestore();
  });

  it('rejette les ids dupliqués', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const u1 = makeValidUser({ id: 'user_dup', email: 'a@example.com' });
    const u2 = makeValidUser({ id: 'user_dup', email: 'b@example.com' });
    const { valid, skippedIds } = filterValidUsers([u1, u2]);
    expect(valid).toHaveLength(1);
    expect(skippedIds).toEqual(['user_dup']);
    warn.mockRestore();
  });
});
