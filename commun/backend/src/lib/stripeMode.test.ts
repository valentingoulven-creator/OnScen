import { afterEach, describe, expect, it } from 'vitest';
import { getStripeKeyMode } from './stripeMode';

describe('getStripeKeyMode', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('disabled si absent', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getStripeKeyMode()).toBe('disabled');
  });

  it('test vs live via préfixe', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    expect(getStripeKeyMode()).toBe('test');
    process.env.STRIPE_SECRET_KEY = 'sk_live_placeholder';
    expect(getStripeKeyMode()).toBe('live');
  });
});
