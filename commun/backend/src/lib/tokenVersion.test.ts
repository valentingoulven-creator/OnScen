import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { db } from '../models/schema';
import type { User } from '../models/schema';
import { bumpUserTokenVersion, getUserTokenVersion } from './tokenVersion';
import { signTokenForUser, verifyAuthToken } from '../middleware/auth';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-tv-test',
    email: 'tv@test.local',
    username: 'tvtest',
    passwordHash: 'hash',
    role: 'listener',
    accountStatus: 'active',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('tokenVersion', () => {
  it('defaults missing tokenVersion to 0', () => {
    const user = makeUser();
    expect(getUserTokenVersion(user)).toBe(0);
  });

  it('bumps tokenVersion on user', () => {
    const user = makeUser({ tokenVersion: 2 });
    expect(bumpUserTokenVersion(user)).toBe(3);
    expect(user.tokenVersion).toBe(3);
  });

  it('invalidates JWT after bump', () => {
    const user = makeUser();
    db.users.set(user.id, user);
    const token = signTokenForUser(user);
    expect(verifyAuthToken(token)?.id).toBe(user.id);

    bumpUserTokenVersion(user);
    db.users.set(user.id, user);
    expect(verifyAuthToken(token)).toBeNull();
  });

  it('accepts legacy tokens without tv when user version is 0', () => {
    const user = makeUser();
    db.users.set(user.id, user);
    const secret = process.env.JWT_SECRET || 'melosong_secret_dev_fallback';
    const legacy = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '1h' });
    expect(verifyAuthToken(legacy)?.id).toBe(user.id);
  });
});
