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

  it('throws in preproduction when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.APP_ENV = 'preproduction';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('uses dev fallback only under NODE_ENV=test', () => {
    delete process.env.JWT_SECRET;
    process.env.APP_ENV = 'msdev';
    process.env.NODE_ENV = 'test';
    expect(getJwtSecret()).toBe('melosong_secret_dev_fallback');
  });

  it('throws outside production when JWT_SECRET is missing and NODE_ENV is not test', () => {
    delete process.env.JWT_SECRET;
    process.env.APP_ENV = 'msdev';
    process.env.NODE_ENV = 'development';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('detects production via APP_ENV only (not NODE_ENV on staging)', () => {
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    expect(isProductionEnv()).toBe(true);
  });

  it('preproduction is not production strict', () => {
    process.env.APP_ENV = 'preproduction';
    process.env.NODE_ENV = 'production';
    expect(isProductionEnv()).toBe(false);
  });
});
