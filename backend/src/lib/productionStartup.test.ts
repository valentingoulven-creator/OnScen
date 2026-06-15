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
    expect(() => assertProductionStartup()).toThrow(/JWT_SECRET/);
  });

  it('throws in production when CORS_ORIGIN is missing', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    delete process.env.CORS_ORIGIN;
    expect(() => assertProductionStartup()).toThrow(/CORS_ORIGIN/);
  });

  it('warns when DATABASE_URL is missing in production', () => {
    process.env.APP_ENV = 'production';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.CORS_ORIGIN = 'https://getsoundy.com';
    delete process.env.DATABASE_URL;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    assertProductionStartup();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
  });
});
