/** Aligné sur backend ageGates.ts (GEO_PRECISE_MIN_AGE). */
import {
  computeAgeFromBirthDate,
  CREATOR_MONETIZATION_MIN_AGE,
  MIN_PROFILE_AGE,
} from './profileAge';

export const GEO_PRECISE_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export type GeoAgeProfile = { birthDate?: string; age?: number } | null | undefined;

export function resolveViewerAge(profile: GeoAgeProfile): number | null {
  if (!profile) return null;
  if (profile.birthDate?.trim()) {
    return computeAgeFromBirthDate(profile.birthDate.trim());
  }
  if (typeof profile.age === 'number') return profile.age;
  return null;
}

/** 18+ : géolocalisation précise autorisée (avec consentement utilisateur). */
export function canUsePreciseGeo(profile: GeoAgeProfile): boolean {
  const age = resolveViewerAge(profile);
  return age != null && age >= GEO_PRECISE_MIN_AGE;
}

/** 13–17 : géo limitée (ville / rayon flou), pas de GPS précis. */
export function isGeoMinor(profile: GeoAgeProfile): boolean {
  const age = resolveViewerAge(profile);
  return age != null && age >= MIN_PROFILE_AGE && age < GEO_PRECISE_MIN_AGE;
}
