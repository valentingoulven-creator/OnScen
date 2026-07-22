import { describe, expect, it } from 'vitest';
import { EXTERNAL_SECRET_PROVIDERS, EXTERNAL_SECRET_WHITELIST, getFieldDef, getProviderDef } from './externalSecretsRegistry';

/** Variables "cœur système" qui ne doivent JAMAIS être éditables via ce moteur. */
const CORE_SYSTEM_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'OPS_HEALTH_TOKEN',
  'TOTP_ENCRYPTION_KEY',
  'PROD_ADMIN_EMAIL',
  'PROD_ADMIN_PASSWORD',
  'PROD_ADMIN_USERNAME',
  'REDIS_URL',
  'APP_ENV',
  'PORT',
  'HOST',
  'CORS_ORIGIN',
  'WEB_APP_URL',
  // Stripe reste géré par son propre module dédié (stripeConfigAdmin.ts).
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

describe('EXTERNAL_SECRET_WHITELIST', () => {
  it('never contains a core system variable', () => {
    for (const key of CORE_SYSTEM_VARS) {
      expect(EXTERNAL_SECRET_WHITELIST.has(key)).toBe(false);
    }
  });

  it('contains every field key declared in the registry', () => {
    for (const provider of EXTERNAL_SECRET_PROVIDERS) {
      for (const field of provider.fields) {
        expect(EXTERNAL_SECRET_WHITELIST.has(field.key)).toBe(true);
      }
    }
  });

  it('has no duplicate env var key across providers', () => {
    const allKeys = EXTERNAL_SECRET_PROVIDERS.flatMap((p) => p.fields.map((f) => f.key));
    expect(allKeys.length).toBe(new Set(allKeys).size);
  });
});

describe('EXTERNAL_SECRET_PROVIDERS integrity', () => {
  it('has no duplicate provider id', () => {
    const ids = EXTERNAL_SECRET_PROVIDERS.map((p) => p.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('has at least one field per provider', () => {
    for (const provider of EXTERNAL_SECRET_PROVIDERS) {
      expect(provider.fields.length).toBeGreaterThan(0);
    }
  });
});

describe('getProviderDef / getFieldDef', () => {
  it('resolves a known provider by id', () => {
    expect(getProviderDef('livekit')?.id).toBe('livekit');
  });

  it('returns undefined for an unknown provider', () => {
    expect(getProviderDef('not-a-provider')).toBeUndefined();
  });

  it('resolves a known field by key within a provider', () => {
    const provider = getProviderDef('livekit')!;
    expect(getFieldDef(provider, 'LIVEKIT_API_SECRET')?.kind).toBe('secret');
  });

  it('returns undefined for a field key not owned by that provider', () => {
    const provider = getProviderDef('livekit')!;
    expect(getFieldDef(provider, 'STRIPE_SECRET_KEY')).toBeUndefined();
  });
});
