import { describe, it, expect } from 'vitest';
import {
  CREATOR_MONETIZATION_MIN_AGE,
  MIN_LIVE_AGE,
  creatorMeetsMonetizationAge,
  userMeetsLiveAge,
} from './ageGates';

describe('ageGates', () => {
  it('exige 16 ans minimum pour lancer un live', () => {
    expect(userMeetsLiveAge(15)).toBe(false);
    expect(userMeetsLiveAge(MIN_LIVE_AGE)).toBe(true);
    expect(userMeetsLiveAge(undefined)).toBe(false);
  });

  it('exige 18 ans minimum pour la monétisation créateur', () => {
    expect(creatorMeetsMonetizationAge(17)).toBe(false);
    expect(creatorMeetsMonetizationAge(CREATOR_MONETIZATION_MIN_AGE)).toBe(true);
    expect(creatorMeetsMonetizationAge(undefined)).toBe(false);
  });
});
