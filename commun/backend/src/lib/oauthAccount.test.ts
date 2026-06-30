import { describe, expect, it } from 'vitest';
import { isOAuthOnlyPasswordHash } from './oauthAccount';

describe('isOAuthOnlyPasswordHash', () => {
  it('detects oauth placeholder hashes', () => {
    expect(isOAuthOnlyPasswordHash('oauth_google_abc123')).toBe(true);
    expect(isOAuthOnlyPasswordHash('oauth_facebook_deadbeef')).toBe(true);
  });

  it('rejects bcrypt hashes', () => {
    expect(isOAuthOnlyPasswordHash('$2a$10$abcdefghijklmnopqrstuv')).toBe(false);
  });
});
