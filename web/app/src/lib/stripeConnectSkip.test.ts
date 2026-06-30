import { describe, expect, it, vi } from 'vitest';

import { canBypassStripeConnect, isStripeConnectSkipped } from './stripeConnectSkip';

describe('canBypassStripeConnect', () => {
  it('autorise le contournement en msdev', () => {
    vi.stubEnv('VITE_APP_ENV', 'msdev');
    expect(canBypassStripeConnect()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe('isStripeConnectSkipped', () => {
  it('retourne true en msdev sans flag session', () => {
    vi.stubEnv('VITE_APP_ENV', 'msdev');
    expect(isStripeConnectSkipped()).toBe(true);
    vi.unstubAllEnvs();
  });
});
