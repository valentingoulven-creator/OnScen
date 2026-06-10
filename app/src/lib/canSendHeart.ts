import { CREATOR_MONETIZATION_MIN_AGE, computeAgeFromBirthDate } from './profileAge';
import type { AccountStatus, RelationshipStatus } from '../types';

export const HEART_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export type HeartEligibilityUser = {
  accountStatus?: AccountStatus;
  accountValidated?: boolean;
  meetsHeartAge?: boolean;
  age?: number;
  birthDate?: string;
  relationshipStatus?: RelationshipStatus;
};

export type HeartBlockReasonKey =
  | 'login'
  | 'viewerNotValidated'
  | 'profileNotValidated'
  | 'viewerUnderAge'
  | 'profileUnderAge'
  | 'viewerNotSingle'
  | 'profileNotSingle';

export function isAccountValidated(
  user: Pick<HeartEligibilityUser, 'accountStatus' | 'accountValidated'> | null | undefined
): boolean {
  if (!user) return false;
  if (user.accountValidated === true) return true;
  if (user.accountValidated === false) return false;
  if (user.accountStatus === 'pending' || user.accountStatus === 'blocked') return false;
  return true;
}

export function userMeetsHeartAge(
  user: Pick<HeartEligibilityUser, 'meetsHeartAge' | 'age' | 'birthDate'> | null | undefined
): boolean {
  if (!user) return false;
  if (user.meetsHeartAge === true) return true;
  if (typeof user.age === 'number') return user.age >= HEART_MIN_AGE;
  if (user.birthDate) {
    const age = computeAgeFromBirthDate(user.birthDate);
    return age != null && age >= HEART_MIN_AGE;
  }
  if (user.meetsHeartAge === false) return false;
  return false;
}

/** @deprecated Use userMeetsHeartAge */
export const profileMeetsHeartAge = userMeetsHeartAge;

export function isSingleForHeart(
  user: Pick<HeartEligibilityUser, 'relationshipStatus'> | null | undefined
): boolean {
  return user?.relationshipStatus === 'celibataire';
}

export function canSendHeart(
  viewer: HeartEligibilityUser | null | undefined,
  profile: HeartEligibilityUser | null | undefined
): boolean {
  if (!viewer || !profile) return false;
  if (!isAccountValidated(viewer)) return false;
  if (!isAccountValidated(profile)) return false;
  if (!userMeetsHeartAge(viewer)) return false;
  if (!userMeetsHeartAge(profile)) return false;
  if (!isSingleForHeart(viewer)) return false;
  if (!isSingleForHeart(profile)) return false;
  return true;
}

export function heartBlockReasonKeys(
  viewer: HeartEligibilityUser | null | undefined,
  profile: HeartEligibilityUser | null | undefined
): HeartBlockReasonKey[] {
  const keys: HeartBlockReasonKey[] = [];
  if (!viewer) {
    keys.push('login');
    return keys;
  }
  if (!isAccountValidated(viewer)) keys.push('viewerNotValidated');
  if (!profile) return keys;
  if (!isAccountValidated(profile)) keys.push('profileNotValidated');
  if (!userMeetsHeartAge(viewer)) keys.push('viewerUnderAge');
  if (!userMeetsHeartAge(profile)) keys.push('profileUnderAge');
  if (!isSingleForHeart(viewer)) keys.push('viewerNotSingle');
  if (!isSingleForHeart(profile)) keys.push('profileNotSingle');
  return keys;
}

const HEART_BLOCK_MESSAGES: Record<HeartBlockReasonKey, string> = {
  login: 'Connectez-vous pour envoyer un cœur.',
  viewerNotValidated: 'Votre compte doit être validé pour envoyer un cœur.',
  profileNotValidated: 'Ce profil n’est pas encore validé.',
  viewerUnderAge: 'Vous devez avoir au moins 18 ans pour envoyer un cœur.',
  profileUnderAge: 'Cette personne doit avoir au moins 18 ans.',
  viewerNotSingle: 'Indiquez être célibataire sur votre profil pour envoyer un cœur.',
  profileNotSingle: 'Cette personne doit indiquer être célibataire sur son profil.',
};

export function heartDisabledReason(
  viewer: HeartEligibilityUser | null | undefined,
  profile: HeartEligibilityUser | null | undefined
): string | null {
  const keys = heartBlockReasonKeys(viewer, profile);
  if (keys.length === 0) return null;
  return HEART_BLOCK_MESSAGES[keys[0]];
}
