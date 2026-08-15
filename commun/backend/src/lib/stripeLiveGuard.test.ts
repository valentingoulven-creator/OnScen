import { afterEach, describe, expect, it } from 'vitest';
import type { Response } from 'express';
import { rejectIfStripeTestInProduction } from './stripeLiveGuard';

function resMock(): Response & { statusCode?: number; body?: unknown } {
  const out = {
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(body: unknown) {
      out.body = body;
      return out;
    },
  } as Response & { statusCode?: number; body?: unknown };
  return out;
}

describe('rejectIfStripeTestInProduction', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('bloque sk_test_ en production', () => {
    process.env.APP_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    delete process.env.STRIPE_ALLOW_TEST_IN_PROD;
    const res = resMock();
    expect(rejectIfStripeTestInProduction(res)).toBe(true);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'STRIPE_TEST_IN_PROD' });
  });

  it('laisse passer sk_live_', () => {
    process.env.APP_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_live_example';
    const res = resMock();
    expect(rejectIfStripeTestInProduction(res)).toBe(false);
  });
});
