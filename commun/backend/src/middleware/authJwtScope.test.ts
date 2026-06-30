import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { db } from '../models/schema';
import type { User } from '../models/schema';
import {
  isRestrictedJwtScope,
  verifyAuthToken,
  signTokenForUser,
} from '../middleware/auth';

function makeUser(): User {
  return {
    id: 'u-scope-test',
    email: 'scope@test.local',
    username: 'scopetest',
    passwordHash: 'hash',
    role: 'listener',
    accountStatus: 'active',
    createdAt: Date.now(),
  };
}

describe('JWT scope', () => {
  it('treats missing scope as full session', () => {
    expect(isRestrictedJwtScope(undefined)).toBe(false);
    expect(isRestrictedJwtScope('full')).toBe(false);
  });

  it('rejects 2fa_pending scope on verifyAuthToken', () => {
    const user = makeUser();
    db.users.set(user.id, user);
    const secret = process.env.JWT_SECRET || 'melosong_secret_dev_fallback';
    const pending = jwt.sign(
      { id: user.id, username: user.username, scope: '2fa_pending' },
      secret,
      { expiresIn: '5m' }
    );
    expect(verifyAuthToken(pending)).toBeNull();
    expect(verifyAuthToken(signTokenForUser(user))?.id).toBe(user.id);
    db.users.delete(user.id);
  });
});
