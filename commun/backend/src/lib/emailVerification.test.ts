import { describe, expect, it } from 'vitest';
import { db, type User } from '../models/schema';
import { issueVerificationToken } from './emailVerification';

function makeUser(): User {
  return {
    id: 'u-verify-test',
    email: 'verify@test.local',
    username: 'verifytest',
    passwordHash: 'hash',
    accountStatus: 'active',
    lastSeenAt: Date.now(),
    meloCoins: 0,
    isGhostMode: false,
    emailVerified: false,
  };
}

describe('issueVerificationToken', () => {
  it('stores a 24h token and builds a verify-email URL', () => {
    const user = makeUser();
    db.users.set(user.id, user);
    const before = Date.now();
    const { token, url } = issueVerificationToken(user);
    expect(token).toHaveLength(64);
    expect(url).toContain(`/verify-email?token=${token}`);
    expect(user.verificationToken).toBe(token);
    expect(user.verificationTokenExpiry).toBeGreaterThanOrEqual(before + 23 * 60 * 60 * 1000);
    expect(db.users.get(user.id)?.verificationToken).toBe(token);
  });
});
