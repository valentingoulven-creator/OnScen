import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { db, type User } from '../models/schema';
import {
  authenticateJWT,
  signTokenForUser,
  verifyAuthToken,
} from './auth';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-email-gate',
    email: 'gate@test.local',
    username: 'gateuser',
    passwordHash: 'hash',
    role: 'listener',
    accountStatus: 'active',
    emailVerified: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as Response & { statusCode: number; body: unknown };
  return res;
}

describe('authenticateJWT email verification', () => {
  const userId = 'u-email-gate';

  beforeEach(() => {
    db.users.set(userId, makeUser());
  });

  afterEach(() => {
    db.users.delete(userId);
  });

  it('rejects unverified users with email_not_verified', () => {
    const user = makeUser({ emailVerified: false });
    db.users.set(userId, user);
    const token = signTokenForUser(user);
    const req = {
      headers: { 'x-auth-token': token },
      cookies: {},
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticateJWT(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'email_not_verified' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows verified users', () => {
    const user = makeUser({ emailVerified: true });
    db.users.set(userId, user);
    const token = signTokenForUser(user);
    const req = {
      headers: { 'x-auth-token': token },
      cookies: {},
    } as unknown as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('verifyAuthToken returns null for unverified users', () => {
    const user = makeUser({ emailVerified: false });
    db.users.set(userId, user);
    expect(verifyAuthToken(signTokenForUser(user))).toBeNull();
  });
});
