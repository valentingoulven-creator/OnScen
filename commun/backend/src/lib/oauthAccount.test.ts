import { describe, expect, it } from 'vitest';
import { clearPasswordChangeRequiredForOAuthLogin, isOAuthOnlyPasswordHash } from './oauthAccount';

describe('isOAuthOnlyPasswordHash', () => {
  it('detects oauth placeholder hashes', () => {
    expect(isOAuthOnlyPasswordHash('oauth_google_abc123')).toBe(true);
    expect(isOAuthOnlyPasswordHash('oauth_facebook_deadbeef')).toBe(true);
  });

  it('rejects bcrypt hashes', () => {
    expect(isOAuthOnlyPasswordHash('$2a$10$abcdefghijklmnopqrstuv')).toBe(false);
  });
});

describe('clearPasswordChangeRequiredForOAuthLogin', () => {
  it('clears mustChangePassword when set', () => {
    const user = { mustChangePassword: true };
    clearPasswordChangeRequiredForOAuthLogin(user);
    expect(user.mustChangePassword).toBe(false);
  });

  it('no-op when flag absent', () => {
    const user = {};
    clearPasswordChangeRequiredForOAuthLogin(user);
    expect(user.mustChangePassword).toBeUndefined();
  });
});
