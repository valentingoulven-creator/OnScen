import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getJwtSecret, isProductionEnv } from './jwtSecret';

describe('jwtSecret', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('returns env secret when set', () => {
    process.env.JWT_SECRET = 'my-secret';
    expect(getJwtSecret()).toBe('my-secret');
  });

  it('throws in production when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.APP_ENV = 'production';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('uses dev fallback outside production', () => {
    delete process.env.JWT_SECRET;
    process.env.APP_ENV = 'msdev';
    expect(getJwtSecret()).toBe('melosong_secret_dev_fallback');
  });

  it('detects production via NODE_ENV', () => {
    process.env.NODE_ENV = 'production';
    expect(isProductionEnv()).toBe(true);
  });
});
