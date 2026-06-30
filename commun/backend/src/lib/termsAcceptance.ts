import type { User } from '../models/schema';
import { CURRENT_TERMS_VERSION } from './legalConstants';

export function userNeedsTermsReacceptance(user: User): boolean {
  const accepted = user.acceptedTermsVersion?.trim();
  if (!accepted) return true;
  return accepted !== CURRENT_TERMS_VERSION;
}

export function acceptCurrentTerms(user: User): void {
  user.acceptedTermsVersion = CURRENT_TERMS_VERSION;
  user.acceptedTermsAt = Date.now();
}
