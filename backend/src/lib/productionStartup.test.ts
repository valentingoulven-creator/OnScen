import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionStartup } from './productionStartup';

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
    process.env.APP_ENV = 'production';
    delete process.env.JWT_SECRET;
    process.env.CORS_ORIGIN = 'https://getsoundy.com';
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    process.env.SIGHTENGINE_API_USER = 'se-user';
    process.env.SIGHTENGINE_API_SECRET = 'se-secret';
    expect(() => assertProductionStartup()).toThrow(/JWT_SECRET/);
  });

  it('throws in production when CORS_ORIGIN is missing', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    delete process.env.CORS_ORIGIN;
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    process.env.SIGHTENGINE_API_USER = 'se-user';
    process.env.SIGHTENGINE_API_SECRET = 'se-secret';
    expect(() => assertProductionStartup()).toThrow(/CORS_ORIGIN/);
  });

  it('throws when SKIP_EMAIL_VERIFICATION is enabled in production', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.CORS_ORIGIN = 'https://getsoundy.com';
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    process.env.SKIP_EMAIL_VERIFICATION = 'true';
    expect(() => assertProductionStartup()).toThrow(/SKIP_EMAIL_VERIFICATION/);
  });

  it('throws when ENCRYPTION_KEY is missing in production', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.CORS_ORIGIN = 'https://getsoundy.com';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertProductionStartup()).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when Sightengine is missing in production', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.CORS_ORIGIN = 'https://getsoundy.com';
    process.env.ENCRYPTION_KEY = 'test-key';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
    expect(() => assertProductionStartup()).toThrow(/SIGHTENGINE/);
  });
});
