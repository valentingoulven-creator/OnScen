import type { User } from '../models/schema';

/** Version de session JWT — incrémentée pour invalider tous les tokens émis avant. */
export function getUserTokenVersion(user: User): number {
  const v = user.tokenVersion;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function bumpUserTokenVersion(user: User): number {
  const next = getUserTokenVersion(user) + 1;
  user.tokenVersion = next;
  return next;
}
