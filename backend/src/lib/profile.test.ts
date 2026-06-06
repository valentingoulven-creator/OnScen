import { describe, it, expect } from 'vitest';
import type { User } from '../models/schema';
import {
  applyAgeSettings,
  parseAgeInput,
  publicProfile,
  MIN_PROFILE_AGE,
  MAX_PROFILE_AGE,
} from './profile';

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

describe('parseAgeInput', () => {
  it('accepte un entier dans la plage 13–120', () => {
    expect(parseAgeInput(28)).toEqual({ ok: true, value: 28 });
    expect(parseAgeInput('42')).toEqual({ ok: true, value: 42 });
    expect(parseAgeInput(MIN_PROFILE_AGE)).toEqual({ ok: true, value: MIN_PROFILE_AGE });
    expect(parseAgeInput(MAX_PROFILE_AGE)).toEqual({ ok: true, value: MAX_PROFILE_AGE });
  });

  it('efface avec null ou chaîne vide', () => {
    expect(parseAgeInput(null)).toEqual({ ok: true, value: null });
    expect(parseAgeInput('')).toEqual({ ok: true, value: null });
  });

  it('refuse les valeurs hors plage ou non entières', () => {
    expect(parseAgeInput(12).ok).toBe(false);
    expect(parseAgeInput(121).ok).toBe(false);
    expect(parseAgeInput(28.5).ok).toBe(false);
    expect(parseAgeInput('abc').ok).toBe(false);
  });
});

describe('applyAgeSettings', () => {
  it('met à jour age et showAge', () => {
    const user = makeUser();
    const result = applyAgeSettings(user, { age: 30, showAge: true });
    expect(result).toEqual({ ok: true });
    expect(user.age).toBe(30);
    expect(user.showAge).toBe(true);
  });

  it('efface age avec null', () => {
    const user = makeUser({ age: 25, showAge: true });
    const result = applyAgeSettings(user, { age: null });
    expect(result).toEqual({ ok: true });
    expect(user.age).toBeUndefined();
  });

  it('refuse showAge non booléen', () => {
    const user = makeUser();
    const result = applyAgeSettings(user, { showAge: 'yes' });
    expect(result.ok).toBe(false);
  });
});

describe('publicProfile age privacy', () => {
  it('expose age au propriétaire même si showAge false', () => {
    const user = makeUser({ age: 28, showAge: false });
    const view = publicProfile(user, true, user.id);
    expect(view.age).toBe(28);
    expect(view.showAge).toBe(false);
  });

  it('masque age aux visiteurs si showAge false', () => {
    const user = makeUser({ age: 28, showAge: false });
    const view = publicProfile(user, false, 'other');
    expect(view.age).toBeUndefined();
    expect(view.showAge).toBeUndefined();
  });

  it('expose age aux visiteurs si showAge true', () => {
    const user = makeUser({ age: 28, showAge: true });
    const view = publicProfile(user, false, 'other');
    expect(view.age).toBe(28);
    expect(view.showAge).toBeUndefined();
  });
});
