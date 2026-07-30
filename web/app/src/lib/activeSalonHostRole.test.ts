import { describe, expect, it } from 'vitest';
import { resolveActiveSalonHostRole } from './activeSalonHostRole';

describe('resolveActiveSalonHostRole', () => {
  const salonId = 'salon-y';
  const hostId = 'user-host';
  const listenerId = 'user-listener';

  it('uses salon.hostId when salon is loaded (listener)', () => {
    expect(
      resolveActiveSalonHostRole({
        salon: { hostId },
        userId: listenerId,
        salonId,
        sessionIsHost: true,
        userHostedSalonId: salonId,
      })
    ).toBe(false);
  });

  it('uses salon.hostId when salon is loaded (host)', () => {
    expect(
      resolveActiveSalonHostRole({
        salon: { hostId },
        userId: hostId,
        salonId,
        sessionIsHost: false,
      })
    ).toBe(true);
  });

  it('respects explicit sessionIsHost=false before salon load', () => {
    expect(
      resolveActiveSalonHostRole({
        salon: null,
        userId: listenerId,
        salonId,
        sessionIsHost: false,
        userHostedSalonId: salonId,
      })
    ).toBe(false);
  });

  it('falls back to userHostedSalonId when session hint is absent', () => {
    expect(
      resolveActiveSalonHostRole({
        salon: null,
        userId: hostId,
        salonId,
        userHostedSalonId: salonId,
      })
    ).toBe(true);

    expect(
      resolveActiveSalonHostRole({
        salon: null,
        userId: listenerId,
        salonId,
        userHostedSalonId: 'other-salon',
      })
    ).toBe(false);
  });
});
