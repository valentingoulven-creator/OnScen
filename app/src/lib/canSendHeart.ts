import { CREATOR_MONETIZATION_MIN_AGE } from './profileAge';
import type { AccountStatus, RelationshipStatus } from '../types';

export const HEART_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export type HeartEligibilityUser = {
  accountStatus?: AccountStatus;
  accountValidated?: boolean;
  meetsHeartAge?: boolean;
  age?: number;
  relationshipStatus?: RelationshipStatus;
};

export function isAccountValidated(
  user: Pick<HeartEligibilityUser, 'accountStatus' | 'accountValidated'> | null | undefined
): boolean {
  if (!user) return false;
  if (user.accountValidated === true) return true;
  if (user.accountValidated === false) return false;
  if (user.accountStatus === 'pending' || user.accountStatus === 'blocked') return false;
  return true;
}

export function profileMeetsHeartAge(
  profile: Pick<HeartEligibilityUser, 'meetsHeartAge' | 'age'> | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.meetsHeartAge === true) return true;
  if (profile.meetsHeartAge === false) return false;
  return typeof profile.age === 'number' && profile.age >= HEART_MIN_AGE;
}

export function canSendHeart(
  viewer: HeartEligibilityUser | null | undefined,
  profile: HeartEligibilityUser | null | undefined
): boolean {
  if (!viewer || !profile) return false;
  if (!isAccountValidated(viewer)) return false;
  if (!isAccountValidated(profile)) return false;
  if (!profileMeetsHeartAge(profile)) return false;
  if (profile.relationshipStatus !== 'celibataire') return false;
  return true;
}

export function heartDisabledReason(
  viewer: HeartEligibilityUser | null | undefined,
  profile: HeartEligibilityUser | null | undefined
): string | null {
  if (!viewer) return 'Connectez-vous pour envoyer un cœur.';
  if (!isAccountValidated(viewer)) {
    return 'Votre compte doit être validé pour envoyer un cœur.';
  }
  if (!profile) return null;
  if (!isAccountValidated(profile)) {
    return 'Ce profil n’est pas encore validé.';
  }
  if (!profileMeetsHeartAge(profile)) {
    return 'Cette personne doit avoir au moins 18 ans.';
  }
  if (profile.relationshipStatus !== 'celibataire') {
    return 'Cette personne doit indiquer être célibataire sur son profil.';
  }
  return null;
}
