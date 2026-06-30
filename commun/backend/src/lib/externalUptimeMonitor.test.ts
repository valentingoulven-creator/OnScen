import { describe, expect, it, vi, afterEach } from 'vitest';
import { stopExternalUptimeMonitorForTests } from './externalUptimeMonitor';

describe('externalUptimeMonitor', () => {
  afterEach(() => {
    stopExternalUptimeMonitorForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('startExternalUptimeMonitor no-op outside deployed env', async () => {
    process.env.APP_ENV = 'development';
    const { startExternalUptimeMonitor } = await import('./externalUptimeMonitor');
    expect(() => startExternalUptimeMonitor()).not.toThrow();
  });
});
