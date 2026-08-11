import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionStartup } from './productionStartup';

const TOTP_KEY = 'a'.repeat(64);
const OPS_TOKEN = 'ops-health-token-minimum-32-characters-long';

function setProductionEnv(): void {
  process.env.APP_ENV = 'production';
  process.env.JWT_SECRET = 'prod-jwt-secret';
  process.env.ENCRYPTION_KEY = 'prod-encryption-key-distinct';
  process.env.CORS_ORIGIN = 'https://onscen.com';
  process.env.DATABASE_URL = 'postgres://localhost/test';
  process.env.SIGHTENGINE_API_USER = 'se-user';
  process.env.SIGHTENGINE_API_SECRET = 'se-secret';
  process.env.TOTP_ENCRYPTION_KEY = TOTP_KEY;
  process.env.OPS_HEALTH_TOKEN = OPS_TOKEN;
  process.env.SENTRY_DSN = 'https://test@test.ingest.sentry.io/1';
  process.env.ACRCLOUD_ACCESS_KEY = 'acr-key';
  process.env.ACRCLOUD_ACCESS_SECRET = 'acr-secret';
}

describe('assertProductionStartup', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('no-op outside production', () => {
    process.env.APP_ENV = 'development';
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.CORS_ORIGIN;
    expect(() => assertProductionStartup()).not.toThrow();
  });

  it('throws in production when JWT_SECRET is missing', () => {
    setProductionEnv();
    delete process.env.JWT_SECRET;
    expect(() => assertProductionStartup()).toThrow(/JWT_SECRET/);
  });

  it('throws in production when CORS_ORIGIN is missing', () => {
    setProductionEnv();
    delete process.env.CORS_ORIGIN;
    expect(() => assertProductionStartup()).toThrow(/CORS_ORIGIN/);
  });

  it('throws when SKIP_EMAIL_VERIFICATION is enabled in production', () => {
    setProductionEnv();
    process.env.SKIP_EMAIL_VERIFICATION = 'true';
    expect(() => assertProductionStartup()).toThrow(/SKIP_EMAIL_VERIFICATION/);
  });

  it('throws when ENCRYPTION_KEY is missing in production', () => {
    setProductionEnv();
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertProductionStartup()).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when ENCRYPTION_KEY equals JWT_SECRET', () => {
    setProductionEnv();
    process.env.ENCRYPTION_KEY = process.env.JWT_SECRET!;
    expect(() => assertProductionStartup()).toThrow(/ENCRYPTION_KEY must differ/);
  });

  it('throws when TOTP_ENCRYPTION_KEY is missing', () => {
    setProductionEnv();
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => assertProductionStartup()).toThrow(/TOTP_ENCRYPTION_KEY/);
  });

  it('throws when OPS_HEALTH_TOKEN is missing', () => {
    setProductionEnv();
    delete process.env.OPS_HEALTH_TOKEN;
    expect(() => assertProductionStartup()).toThrow(/OPS_HEALTH_TOKEN/);
  });

  it('throws when Sightengine is missing in production', () => {
    setProductionEnv();
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
    expect(() => assertProductionStartup()).toThrow(/SIGHTENGINE/);
  });

  it('throws when PM2 multi-instance without REDIS_URL', () => {
    setProductionEnv();
    process.env.PM2_INSTANCES = '2';
    delete process.env.REDIS_URL;
    expect(() => assertProductionStartup()).toThrow(/REDIS_URL/);
  });

  it('warns when ACRCloud is missing in production', () => {
    setProductionEnv();
    delete process.env.ACRCLOUD_ACCESS_KEY;
    delete process.env.ACRCLOUD_ACCESS_SECRET;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => assertProductionStartup()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ACRCloud'));
    warn.mockRestore();
  });

  it('throws when SENTRY_DSN is missing in production', () => {
    setProductionEnv();
    delete process.env.SENTRY_DSN;
    expect(() => assertProductionStartup()).toThrow(/SENTRY_DSN/);
  });
});
