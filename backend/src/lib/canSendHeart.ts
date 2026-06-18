import { getAccountStatus } from './accessControl';
import { CREATOR_MONETIZATION_MIN_AGE, resolveUserAge } from './ageGates';
import type { User } from '../models/schema';

export const HEART_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export function isAccountValidated(user: User | null | undefined): boolean {
  if (!user) return false;
  return getAccountStatus(user) === 'active';
}

export function userMeetsHeartAge(user: User | null | undefined): boolean {
  if (!user) return false;
  const age = resolveUserAge(user);
  return typeof age === 'number' && age >= HEART_MIN_AGE;
}

export function isSingleForHeart(user: User | null | undefined): boolean {
  return user?.relationshipStatus === 'celibataire';
}

/**
 * Sender-side relationship gate: only block when explicitly set to 'en_couple'.
 * null/undefined (no status set) and 'celibataire'/'autre' are all allowed.
 */
export function senderPassesRelationshipGate(user: User | null | undefined): boolean {
  return user?.relationshipStatus !== 'en_couple';
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
  if (!senderPassesRelationshipGate(sender)) return false;
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
  if (!senderPassesRelationshipGate(sender)) {
    return 'Les cœurs sont réservés aux membres célibataires.';
  }
  if (!isSingleForHeart(recipient)) {
    return 'Cette personne doit indiquer être célibataire sur son profil.';
  }
  return null;
}
