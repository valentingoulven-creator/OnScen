import { describe, it, expect } from 'vitest';
import type { User } from '../models/schema';
import { applyRelationshipSettings, VALID_RELATIONSHIP_STATUSES } from './relationshipStatus';
import { migrateUserRelationshipStatus, publicProfile } from './profile';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'tester',
    email: 'test@example.com',
    passwordHash: 'hash',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

describe('applyRelationshipSettings', () => {
  it('accepte celibataire et en_couple', () => {
    const user = makeUser({ relationshipStatusCustom: 'old' });
    expect(applyRelationshipSettings(user, { relationshipStatus: 'celibataire' })).toEqual({
      ok: true,
    });
    expect(user.relationshipStatus).toBe('celibataire');
    expect(user.relationshipStatusCustom).toBeUndefined();

    applyRelationshipSettings(user, { relationshipStatus: 'en_couple' });
    expect(user.relationshipStatus).toBe('en_couple');
  });

  it('efface autre et texte custom', () => {
    const user = makeUser({
      relationshipStatus: 'autre',
      relationshipStatusCustom: 'Compliqué',
    });
    expect(
      applyRelationshipSettings(user, {
        relationshipStatus: 'autre',
        relationshipStatusCustom: '  Compliqué  ',
      })
    ).toEqual({ ok: true });
    expect(user.relationshipStatus).toBeUndefined();
    expect(user.relationshipStatusCustom).toBeUndefined();
  });

  it('efface la situation', () => {
    const user = makeUser({
      relationshipStatus: 'autre',
      relationshipStatusCustom: 'Test',
    });
    applyRelationshipSettings(user, { relationshipStatus: null });
    expect(user.relationshipStatus).toBeUndefined();
    expect(user.relationshipStatusCustom).toBeUndefined();
  });
});

describe('migrateUserRelationshipStatus', () => {
  it('supprime autre sans texte custom', () => {
    const user = makeUser({ relationshipStatus: 'autre' });
    expect(migrateUserRelationshipStatus(user)).toBe(true);
    expect(user.relationshipStatus).toBeUndefined();
  });

  it('supprime autre avec texte custom', () => {
    const user = makeUser({ relationshipStatus: 'autre', relationshipStatusCustom: 'Polyamour' });
    expect(migrateUserRelationshipStatus(user)).toBe(true);
    expect(user.relationshipStatus).toBeUndefined();
    expect(user.relationshipStatusCustom).toBeUndefined();
  });
});

describe('publicProfile relationship autre', () => {
  it('n expose plus autre après migration', () => {
    const user = makeUser({
      relationshipStatus: 'autre',
      relationshipStatusCustom: 'C\'est compliqué',
    });
    migrateUserRelationshipStatus(user);
    const view = publicProfile(user, false, 'other');
    expect(view.relationshipStatus).toBeUndefined();
    expect(view.relationshipStatusCustom).toBeUndefined();
  });
});

describe('VALID_RELATIONSHIP_STATUSES', () => {
  it('n inclut plus autre', () => {
    expect(VALID_RELATIONSHIP_STATUSES).not.toContain('autre');
    expect(VALID_RELATIONSHIP_STATUSES).toEqual(['celibataire', 'en_couple']);
  });
});
