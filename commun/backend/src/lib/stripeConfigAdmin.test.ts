import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyStripeConfig,
  getStripeConfigStatus,
  maskStripeSecret,
  validateStripeConfigInput,
} from './stripeConfigAdmin';

describe('maskStripeSecret', () => {
  it('masks a secret key keeping prefix + last 4 chars', () => {
    expect(maskStripeSecret('sk_live_abcdefgh1234')).toBe('sk_live_••••1234');
  });

  it('masks a webhook secret', () => {
    expect(maskStripeSecret('whsec_abcdefgh5678')).toBe('whsec_••••5678');
  });

  it('returns null for empty/undefined values', () => {
    expect(maskStripeSecret(undefined)).toBeNull();
    expect(maskStripeSecret('')).toBeNull();
    expect(maskStripeSecret('   ')).toBeNull();
  });
});

describe('validateStripeConfigInput', () => {
  it('accepts a valid matching live pair', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'sk_live_abc1234567890123',
      publishableKey: 'pk_live_abc1234567890123',
      webhookSecret: 'whsec_abc1234567890123',
    });
    expect(errors).toEqual([]);
  });

  it('accepts a valid matching test pair without webhook secret', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'sk_test_abc1234567890123',
      publishableKey: 'pk_test_abc1234567890123',
    });
    expect(errors).toEqual([]);
  });

  it('rejects an invalid secret key format', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'not-a-key',
      publishableKey: 'pk_live_abc1234567890123',
    });
    expect(errors.some((e) => e.field === 'secretKey')).toBe(true);
  });

  it('rejects an invalid publishable key format', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'sk_live_abc1234567890123',
      publishableKey: 'not-a-key',
    });
    expect(errors.some((e) => e.field === 'publishableKey')).toBe(true);
  });

  it('rejects an invalid webhook secret format', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'sk_live_abc1234567890123',
      publishableKey: 'pk_live_abc1234567890123',
      webhookSecret: 'bad-secret',
    });
    expect(errors.some((e) => e.field === 'webhookSecret')).toBe(true);
  });

  it('rejects mismatched modes (live secret + test publishable)', () => {
    const errors = validateStripeConfigInput({
      secretKey: 'sk_live_abc1234567890123',
      publishableKey: 'pk_test_abc1234567890123',
    });
    expect(errors.some((e) => e.field === 'mode')).toBe(true);
  });
});

describe('getStripeConfigStatus / applyStripeConfig', () => {
  const envBackup = { ...process.env };
  const tmpFiles: string[] = [];

  function tmpEnvPath(content: string): string {
    const file = path.join(os.tmpdir(), `soundy-stripe-config-test-${Date.now()}-${Math.random()}.env`);
    fs.writeFileSync(file, content);
    tmpFiles.push(file);
    return file;
  }

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    for (const file of tmpFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it('reports unconfigured status when no key is set', () => {
    const status = getStripeConfigStatus();
    expect(status.configured).toBe(false);
    expect(status.mode).toBe('unknown');
    expect(status.secretKeyMasked).toBeNull();
  });

  it('reports masked test mode status matching prodSaasStatus alert scenario', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc1234567890123';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc1234567890123';
    const status = getStripeConfigStatus();
    expect(status.configured).toBe(true);
    expect(status.mode).toBe('test');
    expect(status.secretKeyMasked).toBe('sk_test_••••0123');
    expect(status.publishableKeyMasked).toBe('pk_test_••••0123');
  });

  it('rejects apply when the resolved .env file does not exist', () => {
    const missingPath = path.join(os.tmpdir(), `soundy-missing-${Date.now()}.env`);
    expect(() =>
      applyStripeConfig(
        { secretKey: 'sk_live_abc1234567890123', publishableKey: 'pk_live_abc1234567890123' },
        { envPathOverride: missingPath }
      )
    ).toThrow(/introuvable/);
  });

  it('persists the live key to the .env file and updates process.env immediately (hot reload, no restart)', () => {
    const envPath = tmpEnvPath(['DATABASE_URL=postgres://x', 'STRIPE_SECRET_KEY=sk_test_old12345678901', ''].join('\n'));

    const status = applyStripeConfig(
      {
        secretKey: 'sk_live_newvalue1234567',
        publishableKey: 'pk_live_newvalue1234567',
        webhookSecret: 'whsec_newvalue1234567',
      },
      { envPathOverride: envPath }
    );

    expect(status.mode).toBe('live');
    expect(status.secretKeyMasked).toBe('sk_live_••••4567');
    expect(status.webhookSecretConfigured).toBe(true);
    expect(status.hotReload).toBe(true);

    // Persisted to disk.
    const fileContent = fs.readFileSync(envPath, 'utf8');
    expect(fileContent).toContain('STRIPE_SECRET_KEY=sk_live_newvalue1234567');
    expect(fileContent).toContain('STRIPE_PUBLISHABLE_KEY=pk_live_newvalue1234567');
    expect(fileContent).toContain('STRIPE_WEBHOOK_SECRET=whsec_newvalue1234567');
    expect(fileContent).toContain('DATABASE_URL=postgres://x');

    // Applied immediately to the running process (no restart needed).
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_live_newvalue1234567');
    expect(process.env.STRIPE_PUBLISHABLE_KEY).toBe('pk_live_newvalue1234567');
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe('whsec_newvalue1234567');
  });
});
