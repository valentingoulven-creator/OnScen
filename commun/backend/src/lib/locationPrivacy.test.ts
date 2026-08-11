import { describe, it, expect } from 'vitest';
import type { User } from '../models/schema';
import {
  applyPrivacySettings,
  enforceMinorGeoPolicy,
  getUserPublicCoords,
  refreshUserPublicCoords,
  userHasLiveGeo,
  userRequiresCityOnlyGeo,
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

describe('enforceMinorGeoPolicy', () => {
  it('forces city precision and removes live GPS for 15yo', () => {
    const user = makeUser({
      birthDate: '2010-06-15',
      city: 'Lyon',
      locationPrecision: 'precise',
      geoUpdatedAt: Date.now(),
      latitude: 48.8,
      longitude: 2.3,
    });
    expect(userRequiresCityOnlyGeo(user)).toBe(true);
    enforceMinorGeoPolicy(user);
    expect(user.locationPrecision).toBe('city');
    expect(user.geoUpdatedAt).toBeUndefined();
    expect(user.latitude).toBeCloseTo(45.764, 1);
    expect(user.longitude).toBeCloseTo(4.8357, 1);
  });
});

describe('applyPrivacySettings minor geo', () => {
  it('rejects precise mode for minors', () => {
    const user = makeUser({ birthDate: '2010-01-01', city: 'Paris' });
    applyPrivacySettings(user, { locationPrecision: 'precise' });
    expect(user.locationPrecision).toBe('city');
    expect(user.latitude).toBeCloseTo(48.8566, 2);
  });
});

describe('comptes à âge inconnu (legacy, sans birthDate/age)', () => {
  // Cf. commun/docs/audit/2026-08-11/03-postgis.md §3.2 : ~95 % des comptes actifs prod (08-2026) n'ont
  // ni birthDate ni age. Un âge inconnu ne doit PAS être traité comme mineur pour
  // la géo (sinon leur précision géo est dégradée silencieusement en masse) —
  // seuls les mineurs *confirmés* (âge connu < 18) sont restreints.
  it('n\'est pas considéré mineur pour la géo (pas de restriction city-only)', () => {
    const user = makeUser({ city: 'Lyon' });
    expect(userRequiresCityOnlyGeo(user)).toBe(false);
  });

  it('conserve un mode précis existant sans le forcer en city-only', () => {
    const user = makeUser({
      city: 'Lyon',
      locationPrecision: 'precise',
      geoUpdatedAt: Date.now(),
      latitude: 45.75,
      longitude: 4.85,
    });
    enforceMinorGeoPolicy(user);
    expect(user.locationPrecision).toBe('precise');
    expect(user.geoUpdatedAt).toBeDefined();
  });

  it('accepte le passage en mode précis via applyPrivacySettings', () => {
    const user = makeUser({ city: 'Paris' });
    applyPrivacySettings(user, { locationPrecision: 'precise' });
    expect(user.locationPrecision).toBe('precise');
  });
});
