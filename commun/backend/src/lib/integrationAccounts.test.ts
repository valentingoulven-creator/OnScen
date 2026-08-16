import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ONSCEN_OPERATOR_EMAIL,
  googleProjectNumberFromClientId,
  livekitProjectFromUrl,
  parseAngleEmail,
  resolveProviderAccount,
  resolveStripeAccountSync,
} from './integrationAccounts';

describe('parseAngleEmail / googleProjectNumberFromClientId / livekitProjectFromUrl', () => {
  it('extracts email from Resend FROM header', () => {
    expect(parseAngleEmail('OnScen <onboarding@resend.dev>')).toBe('onboarding@resend.dev');
    expect(parseAngleEmail('mailto:contact@onscen.com')).toBe('contact@onscen.com');
    expect(parseAngleEmail('valentin.goulven@gmail.com')).toBe('valentin.goulven@gmail.com');
  });

  it('reads Google Cloud project number from OAuth client id', () => {
    expect(googleProjectNumberFromClientId('522947046161-xxxx.apps.googleusercontent.com')).toBe(
      '522947046161'
    );
    expect(googleProjectNumberFromClientId('')).toBeNull();
  });

  it('reads LiveKit project slug from wss URL', () => {
    expect(livekitProjectFromUrl('wss://soundy-k1bb3zfz.livekit.cloud')).toBe('soundy-k1bb3zfz');
    expect(livekitProjectFromUrl('')).toBeNull();
  });
});

describe('resolveProviderAccount', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns null when the provider has no key', () => {
    expect(resolveProviderAccount('facebook_instagram')).toBeNull();
    expect(resolveProviderAccount('sightengine')).toBeNull();
  });

  it('resolves Google Cloud project + operator email', () => {
    process.env.GOOGLE_CLIENT_ID = '522947046161-xxxx.apps.googleusercontent.com';
    const account = resolveProviderAccount('google_oauth');
    expect(account?.email).toBe(ONSCEN_OPERATOR_EMAIL);
    expect(account?.project).toBe('522947046161');
    expect(account?.source).toBe('derived');
  });

  it('resolves LiveKit project from URL', () => {
    process.env.LIVEKIT_URL = 'wss://soundy-k1bb3zfz.livekit.cloud';
    const account = resolveProviderAccount('livekit');
    expect(account?.project).toBe('soundy-k1bb3zfz');
    expect(account?.email).toBe(ONSCEN_OPERATOR_EMAIL);
  });

  it('resolves Resend sandbox FROM', () => {
    process.env.RESEND_FROM = 'OnScen <onboarding@resend.dev>';
    const account = resolveProviderAccount('resend_email');
    expect(account?.email).toBe('onboarding@resend.dev');
    expect(account?.name).toMatch(/sandbox/i);
  });
});

describe('resolveStripeAccountSync', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns null without a Stripe key', () => {
    expect(resolveStripeAccountSync()).toBeNull();
  });

  it('returns operator email for a test key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc1234567890123';
    const account = resolveStripeAccountSync();
    expect(account?.email).toBe(ONSCEN_OPERATOR_EMAIL);
    expect(account?.name).toMatch(/test/i);
    expect(account?.source).toBe('declared');
  });
});
