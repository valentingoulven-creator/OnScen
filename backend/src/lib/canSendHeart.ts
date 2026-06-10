import { getAccountStatus } from './accessControl';
import { CREATOR_MONETIZATION_MIN_AGE } from './ageGates';
import type { User } from '../models/schema';

export const HEART_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export function isAccountValidated(user: User | null | undefined): boolean {
  if (!user) return false;
  return getAccountStatus(user) === 'active';
}

export function userMeetsHeartAge(user: User | null | undefined): boolean {
  if (!user) return false;
  return typeof user.age === 'number' && user.age >= HEART_MIN_AGE;
}

export function isSingleForHeart(user: User | null | undefined): boolean {
  return user?.relationshipStatus === 'celibataire';
}

export function canReceiveHeart(user: User | null | undefined): boolean {
  if (!user) return false;
  if (!isAccountValidated(user)) return false;
  if (!userMeetsHeartAge(user)) return false;
  if (!isSingleForHeart(user)) return false;
  return true;
}

export function canSendHeart(sender: User | null | undefined, recipient: User | null | undefined): boolean {
  if (!sender || !recipient) return false;
  if (!isAccountValidated(sender)) return false;
  if (!isAccountValidated(recipient)) return false;
  if (!userMeetsHeartAge(sender)) return false;
  if (!userMeetsHeartAge(recipient)) return false;
  if (!isSingleForHeart(sender)) return false;
  if (!isSingleForHeart(recipient)) return false;
  return true;
}

export function heartSendDeniedReason(
  sender: User | null | undefined,
  recipient: User | null | undefined
): string | null {
  if (!sender) return 'Session invalide.';
  if (!isAccountValidated(sender)) {
    return 'Votre compte doit être validé pour envoyer un cœur.';
  }
  if (!recipient) return 'Utilisateur introuvable.';
  if (!isAccountValidated(recipient)) {
    return 'Ce profil n’est pas encore validé.';
  }
  if (!userMeetsHeartAge(sender)) {
    return 'Vous devez avoir au moins 18 ans pour envoyer un cœur.';
  }
  if (!userMeetsHeartAge(recipient)) {
    return 'Cette personne doit avoir au moins 18 ans.';
  }
  if (!isSingleForHeart(sender)) {
    return 'Indiquez être célibataire sur votre profil pour envoyer un cœur.';
  }
  if (!isSingleForHeart(recipient)) {
    return 'Cette personne doit indiquer être célibataire sur son profil.';
  }
  return null;
}
