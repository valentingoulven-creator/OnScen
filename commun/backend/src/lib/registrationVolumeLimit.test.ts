import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./alertNotifier', () => ({
  sendMonitoringAlert: vi.fn(),
}));

import {
  assertRegistrationVolumeAllowed,
  resetRegistrationVolumeForTests,
} from './registrationVolumeLimit';

describe('registrationVolumeLimit', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.APP_ENV = 'production';
    delete process.env.MSENV;
    process.env.REGISTRATION_DAILY_CAP = '3';
    process.env.REGISTRATION_HOURLY_IP_CAP = '2';
    resetRegistrationVolumeForTests();
  });

  afterEach(() => {
    process.env = { ...env };
    resetRegistrationVolumeForTests();
  });

  it('skips in msdev', async () => {
    process.env.APP_ENV = 'msdev';
    for (let i = 0; i < 20; i++) {
      expect((await assertRegistrationVolumeAllowed('1.1.1.1')).ok).toBe(true);
    }
  });

  it('caps per IP per hour', async () => {
    expect((await assertRegistrationVolumeAllowed('8.8.8.8')).ok).toBe(true);
    expect((await assertRegistrationVolumeAllowed('8.8.8.8')).ok).toBe(true);
    const blocked = await assertRegistrationVolumeAllowed('8.8.8.8');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(429);
  });

  it('caps daily volume across IPs', async () => {
    expect((await assertRegistrationVolumeAllowed('1.0.0.1')).ok).toBe(true);
    expect((await assertRegistrationVolumeAllowed('1.0.0.2')).ok).toBe(true);
    expect((await assertRegistrationVolumeAllowed('1.0.0.3')).ok).toBe(true);
    const blocked = await assertRegistrationVolumeAllowed('1.0.0.4');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(429);
  });
});
