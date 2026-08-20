import { describe, it, expect, vi } from 'vitest';
import {
  CREATOR_MONETIZATION_MIN_AGE,
  MIN_LIVE_AGE,
  creatorMeetsMonetizationAge,
  creatorMeetsMonetizationAgeFromProfile,
  resolveUserAge,
  userMeetsLiveAge,
  userMeetsLiveAgeFromProfile,
  userMeetsMonetizationAgeFromProfile,
} from './ageGates';

describe('ageGates', () => {
  it('exige 18 ans minimum pour lancer un live', () => {
    expect(userMeetsLiveAge(15)).toBe(false);
    expect(userMeetsLiveAge(MIN_LIVE_AGE)).toBe(true);
    expect(userMeetsLiveAge(undefined)).toBe(false);
  });

  it('exige 18 ans minimum pour la monétisation créateur', () => {
    expect(creatorMeetsMonetizationAge(17)).toBe(false);
    expect(creatorMeetsMonetizationAge(CREATOR_MONETIZATION_MIN_AGE)).toBe(true);
    expect(creatorMeetsMonetizationAge(undefined)).toBe(false);
  });

  it('dérive l\'âge depuis birthDate pour les gates live et monétisation', () => {
    const ref = new Date(2026, 5, 26);
    vi.useFakeTimers();
    vi.setSystemTime(ref);
    const user17 = { birthDate: '2008-06-27' };
    const user18 = { birthDate: '2008-06-25' };
    expect(resolveUserAge(user17, ref)).toBe(17);
    expect(userMeetsLiveAgeFromProfile(user17)).toBe(false);
    expect(userMeetsMonetizationAgeFromProfile(user17)).toBe(false);
    expect(userMeetsMonetizationAgeFromProfile(user18)).toBe(true);
    expect(creatorMeetsMonetizationAgeFromProfile({ age: 16, birthDate: '2000-01-01' })).toBe(true);
    vi.useRealTimers();
  });
});
