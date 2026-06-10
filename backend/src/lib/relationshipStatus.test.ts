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

  it('accepte autre avec texte personnalisé', () => {
    const user = makeUser();
    const result = applyRelationshipSettings(user, {
      relationshipStatus: 'autre',
      relationshipStatusCustom: '  Compliqué  ',
    });
    expect(result).toEqual({ ok: true });
    expect(user.relationshipStatus).toBe('autre');
    expect(user.relationshipStatusCustom).toBe('Compliqué');
  });

  it('refuse autre sans texte', () => {
    const user = makeUser();
    const result = applyRelationshipSettings(user, {
      relationshipStatus: 'autre',
      relationshipStatusCustom: '   ',
    });
    expect(result.ok).toBe(false);
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

  it('conserve autre avec texte custom', () => {
    const user = makeUser({ relationshipStatus: 'autre', relationshipStatusCustom: 'Polyamour' });
    expect(migrateUserRelationshipStatus(user)).toBe(false);
    expect(user.relationshipStatus).toBe('autre');
    expect(user.relationshipStatusCustom).toBe('Polyamour');
  });
});

describe('publicProfile relationship autre', () => {
  it('expose relationshipStatusCustom aux visiteurs', () => {
    const user = makeUser({
      relationshipStatus: 'autre',
      relationshipStatusCustom: 'C\'est compliqué',
    });
    const view = publicProfile(user, false, 'other');
    expect(view.relationshipStatus).toBe('autre');
    expect(view.relationshipStatusCustom).toBe('C\'est compliqué');
  });
});

describe('VALID_RELATIONSHIP_STATUSES', () => {
  it('inclut autre', () => {
    expect(VALID_RELATIONSHIP_STATUSES).toContain('autre');
  });
});
