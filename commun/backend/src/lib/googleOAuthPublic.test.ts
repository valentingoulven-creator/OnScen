import { afterEach, describe, expect, it } from 'vitest';
import { isGoogleOAuthPubliclyEnabled } from './googleOAuthPublic';

describe('isGoogleOAuthPubliclyEnabled', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('reste coupé en production sans opt-in', () => {
    process.env.APP_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'https://onscen.com/api/auth/google/callback';
    delete process.env.GOOGLE_OAUTH_PROD_ENABLED;
    expect(isGoogleOAuthPubliclyEnabled()).toBe(false);
  });

  it('s’active en production avec GOOGLE_OAUTH_PROD_ENABLED=1', () => {
    process.env.APP_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'https://onscen.com/api/auth/google/callback';
    process.env.GOOGLE_OAUTH_PROD_ENABLED = '1';
    expect(isGoogleOAuthPubliclyEnabled()).toBe(true);
  });

  it('reste disponible hors prod si les clés sont là', () => {
    process.env.APP_ENV = 'msdev';
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4080/api/auth/google/callback';
    expect(isGoogleOAuthPubliclyEnabled()).toBe(true);
  });
});
