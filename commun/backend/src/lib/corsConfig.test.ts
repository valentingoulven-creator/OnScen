import { afterEach, describe, expect, it } from 'vitest';
import { resolveCorsOrigin } from './corsConfig';

describe('resolveCorsOrigin', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('allows * in msdev', () => {
    process.env.APP_ENV = 'msdev';
    delete process.env.CORS_ORIGIN;
    expect(resolveCorsOrigin()).toBe('*');
  });

  it('throws in production when CORS_ORIGIN is missing', () => {
    process.env.APP_ENV = 'production';
    delete process.env.NODE_ENV;
    delete process.env.CORS_ORIGIN;
    expect(() => resolveCorsOrigin()).toThrow(/CORS_ORIGIN/);
  });

  it('returns configured origins in production', () => {
    process.env.APP_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://onscen.com, https://www.onscen.com';
    expect(resolveCorsOrigin()).toEqual(['https://onscen.com', 'https://www.onscen.com']);
  });

  it('allows * in development when CORS_ORIGIN is missing', () => {
    process.env.APP_ENV = 'development';
    delete process.env.NODE_ENV;
    delete process.env.CORS_ORIGIN;
    expect(resolveCorsOrigin()).toBe('*');
  });
});
