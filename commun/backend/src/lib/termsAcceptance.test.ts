import { describe, expect, it } from 'vitest';
import type { User } from '../models/schema';
import { CURRENT_TERMS_VERSION } from './legalConstants';
import { acceptCurrentTerms, userNeedsTermsReacceptance } from './termsAcceptance';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'a@test.local',
    username: 'user1',
    passwordHash: 'hash',
    role: 'listener',
    accountStatus: 'active',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('termsAcceptance', () => {
  it('requires reacceptance when version missing', () => {
    expect(userNeedsTermsReacceptance(makeUser())).toBe(true);
  });

  it('requires reacceptance when version outdated', () => {
    expect(userNeedsTermsReacceptance(makeUser({ acceptedTermsVersion: '2020-01-01' }))).toBe(true);
  });

  it('accepts current version', () => {
    expect(
      userNeedsTermsReacceptance(makeUser({ acceptedTermsVersion: CURRENT_TERMS_VERSION }))
    ).toBe(false);
  });

  it('acceptCurrentTerms updates user fields', () => {
    const user = makeUser();
    acceptCurrentTerms(user);
    expect(user.acceptedTermsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(user.acceptedTermsAt).toBeTypeOf('number');
  });
});
