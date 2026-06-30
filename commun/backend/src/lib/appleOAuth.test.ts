import { describe, expect, it, vi, afterEach } from 'vitest';
import { isAppleOAuthConfigured, parseAppleUserName } from './appleOAuth';

describe('appleOAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isAppleOAuthConfigured returns false when env incomplete', () => {
    expect(isAppleOAuthConfigured()).toBe(false);
  });

  it('isAppleOAuthConfigured returns true when all env vars set', () => {
    vi.stubEnv('APPLE_CLIENT_ID', 'com.soundy.app.service');
    vi.stubEnv('APPLE_TEAM_ID', 'TEAM123');
    vi.stubEnv('APPLE_KEY_ID', 'KEY123');
    vi.stubEnv('APPLE_CALLBACK_URL', 'https://getsoundy.com/api/auth/apple/callback');
    vi.stubEnv(
      'APPLE_PRIVATE_KEY',
      '-----BEGIN PRIVATE KEY-----\\nMOCK\\n-----END PRIVATE KEY-----'
    );
    expect(isAppleOAuthConfigured()).toBe(true);
  });

  it('parseAppleUserName extracts first and last name', () => {
    const raw = JSON.stringify({ name: { firstName: 'Valentin', lastName: 'Goulven' } });
    expect(parseAppleUserName(raw)).toBe('Valentin Goulven');
  });

  it('parseAppleUserName returns empty for invalid JSON', () => {
    expect(parseAppleUserName('not-json')).toBe('');
    expect(parseAppleUserName(undefined)).toBe('');
  });
});
