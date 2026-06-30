import { describe, it, expect } from 'vitest';
import type { User } from '../models/schema';
import {
  getUserPublicCoords,
  refreshUserPublicCoords,
  userHasLiveGeo,
} from './locationPrivacy';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'keval',
    email: 'keval@test.com',
    passwordHash: 'hash',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    city: 'Paris',
    ...overrides,
  };
}

describe('userHasLiveGeo', () => {
  it('true when geoUpdatedAt is set', () => {
    expect(userHasLiveGeo(makeUser({ geoUpdatedAt: Date.now() }))).toBe(true);
  });

  it('false without geoUpdatedAt', () => {
    expect(userHasLiveGeo(makeUser())).toBe(false);
  });
});

describe('getUserPublicCoords', () => {
  it('uses live GPS (blurred) when geoUpdatedAt is set, not profile city', () => {
    const user = makeUser({
      latitude: 43.6108,
      longitude: 3.8767,
      geoUpdatedAt: Date.now(),
      locationPrecision: 'precise',
    });
    refreshUserPublicCoords(user);
    const pos = getUserPublicCoords(user, 'viewer');
    expect(pos).not.toBeNull();
    expect(Math.abs(pos!.lat - 43.6108)).toBeLessThan(0.001);
    expect(Math.abs(pos!.lon - 3.8767)).toBeLessThan(0.001);
  });

  it('falls back to city center when city-only and no live geo', () => {
    const user = makeUser({
      latitude: 43.6108,
      longitude: 3.8767,
      locationPrecision: 'city',
    });
    refreshUserPublicCoords(user);
    const pos = getUserPublicCoords(user, 'viewer');
    expect(pos).not.toBeNull();
    expect(Math.abs(pos!.lat - 48.8566)).toBeLessThan(0.01);
    expect(Math.abs(pos!.lon - 2.3522)).toBeLessThan(0.01);
  });

  it('prefers live GPS over city-only when geo was shared', () => {
    const user = makeUser({
      latitude: 43.6108,
      longitude: 3.8767,
      geoUpdatedAt: Date.now(),
      locationPrecision: 'city',
    });
    refreshUserPublicCoords(user);
    const pos = getUserPublicCoords(user, 'viewer');
    expect(pos).not.toBeNull();
    expect(Math.abs(pos!.lat - 43.6108)).toBeLessThan(0.001);
  });
});
