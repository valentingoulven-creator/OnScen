import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken, isTurnstileRequired } from './turnstile';

describe('turnstile', () => {
  const env = process.env;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('skip verification when not required (msdev)', async () => {
    process.env.APP_ENV = 'msdev';
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(isTurnstileRequired()).toBe(false);
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(true);
  });

  it('rejects empty token when required', async () => {
    process.env.TURNSTILE_REQUIRED = '1';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.APP_ENV = 'production';
    await expect(verifyTurnstileToken('')).resolves.toBe(false);
  });

  it('accepts token when siteverify returns success', async () => {
    process.env.TURNSTILE_REQUIRED = '1';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    process.env.APP_ENV = 'production';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);
    await expect(verifyTurnstileToken('tok')).resolves.toBe(true);
  });
});
