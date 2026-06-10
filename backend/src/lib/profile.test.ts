import { describe, it, expect } from 'vitest';
import type { User } from '../models/schema';
import {
  applyAgeSettings,
  computeAgeFromBirthDate,
  isBirthDateHiddenOnProfile,
  parseAgeInput,
  parseBirthDateInput,
  publicProfile,
  MIN_PROFILE_AGE,
  MAX_PROFILE_AGE,
} from './profile';
import { userMeetsLiveAge } from './ageGates';

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

describe('parseBirthDateInput', () => {
  it('accepte une date ISO valide dans la plage d’âge', () => {
    const birthDate = '2000-06-15';
    expect(parseBirthDateInput(birthDate)).toEqual({ ok: true, value: birthDate });
    expect(computeAgeFromBirthDate(birthDate)).toBeGreaterThanOrEqual(MIN_PROFILE_AGE);
  });

  it('efface avec null ou chaîne vide', () => {
    expect(parseBirthDateInput(null)).toEqual({ ok: true, value: null });
    expect(parseBirthDateInput('')).toEqual({ ok: true, value: null });
  });

  it('refuse une date future ou invalide', () => {
    expect(parseBirthDateInput('2099-01-01').ok).toBe(false);
    expect(parseBirthDateInput('2020-13-01').ok).toBe(false);
    expect(parseBirthDateInput('abc').ok).toBe(false);
  });
});

describe('applyAgeSettings birthDate', () => {
  it('dérive age depuis birthDate', () => {
    const user = makeUser();
    const birthDate = '1995-03-20';
    const result = applyAgeSettings(user, { birthDate });
    expect(result).toEqual({ ok: true });
    expect(user.birthDate).toBe(birthDate);
    expect(user.age).toBe(computeAgeFromBirthDate(birthDate));
  });

  it('efface birthDate et age avec null', () => {
    const user = makeUser({ birthDate: '1995-03-20', age: 30 });
    const result = applyAgeSettings(user, { birthDate: null });
    expect(result).toEqual({ ok: true });
    expect(user.birthDate).toBeUndefined();
    expect(user.age).toBeUndefined();
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
  it('expose birthDate au propriétaire toujours', () => {
    const user = makeUser({ birthDate: '1990-01-01', age: 35, hideBirthDateOnProfile: true });
    expect(publicProfile(user, true, user.id).birthDate).toBe('1990-01-01');
    expect(publicProfile(user, true, user.id).hideBirthDateOnProfile).toBe(true);
  });

  it('masque birthDate et age aux visiteurs si hideBirthDateOnProfile', () => {
    const user = makeUser({ birthDate: '1990-01-01', age: 35, hideBirthDateOnProfile: true });
    const view = publicProfile(user, false, 'other');
    expect(view.birthDate).toBeUndefined();
    expect(view.age).toBeUndefined();
  });

  it('expose age (pas birthDate) aux visiteurs si non masqué', () => {
    const user = makeUser({ birthDate: '1990-01-01', age: 35, hideBirthDateOnProfile: false });
    const view = publicProfile(user, false, 'other');
    expect(view.birthDate).toBeUndefined();
    expect(view.age).toBe(computeAgeFromBirthDate('1990-01-01'));
  });

  it('rétrocompat showAge true ⇒ age visible (pas birthDate)', () => {
    const user = makeUser({ birthDate: '1990-01-01', age: 35, showAge: true });
    expect(isBirthDateHiddenOnProfile(user)).toBe(false);
    const view = publicProfile(user, false, 'other');
    expect(view.birthDate).toBeUndefined();
    expect(view.age).toBe(computeAgeFromBirthDate('1990-01-01'));
  });

  it('sync hideBirthDateOnProfile depuis showAge', () => {
    const user = makeUser();
    applyAgeSettings(user, { showAge: true });
    expect(user.hideBirthDateOnProfile).toBe(false);
    applyAgeSettings(user, { hideBirthDateOnProfile: true });
    expect(user.showAge).toBe(false);
  });

  it('expose age au propriétaire même si showAge false (legacy sans birthDate)', () => {
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

  it('expose monetizationEligible sans révéler l’âge', () => {
    const minor = makeUser({ age: 16, showAge: false });
    const adult = makeUser({ age: 20, showAge: false });
    expect(publicProfile(minor, false, 'other').monetizationEligible).toBe(false);
    expect(publicProfile(minor, false, 'other').age).toBeUndefined();
    expect(publicProfile(adult, false, 'other').monetizationEligible).toBe(true);
    expect(publicProfile(adult, false, 'other').age).toBeUndefined();
  });

  it('expose meetsHeartAge aux visiteurs sans révéler birthDate ni age', () => {
    const adult = makeUser({
      birthDate: '1990-01-01',
      hideBirthDateOnProfile: true,
      relationshipStatus: 'celibataire',
    });
    delete adult.age;
    const view = publicProfile(adult, false, 'other');
    expect(view.birthDate).toBeUndefined();
    expect(view.age).toBeUndefined();
    expect(view.meetsHeartAge).toBe(true);
  });

  it('meetsHeartAge false si mineur même avec âge masqué', () => {
    const minor = makeUser({
      birthDate: '2012-06-01',
      hideBirthDateOnProfile: true,
    });
    delete minor.age;
    const view = publicProfile(minor, false, 'other');
    expect(view.meetsHeartAge).toBe(false);
  });
});

describe('userMeetsLiveAge', () => {
  it('autorise 16 ans et plus', () => {
    expect(userMeetsLiveAge(15)).toBe(false);
    expect(userMeetsLiveAge(16)).toBe(true);
  });
});
