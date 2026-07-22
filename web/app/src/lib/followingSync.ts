/** Synchronise l’état « utilisateurs suivis » entre PiP, carte, grilles lives, etc. */

import type { Live, Salon } from '../types';

export const FOLLOWING_CHANGED_EVENT = 'soundy:following-changed';

export type FollowingChangedDetail = {
  userId: string;
  following: boolean;
  /** Contexte PiP / carte — injecté dans le pool sidebar si absent. */
  salon?: Salon;
  live?: Live;
};

export type FollowingChangedContext = Pick<FollowingChangedDetail, 'salon' | 'live'>;

export function notifyFollowingChanged(
  userId: string,
  following: boolean,
  context?: FollowingChangedContext
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<FollowingChangedDetail>(FOLLOWING_CHANGED_EVENT, {
      detail: { userId, following, ...context },
    })
  );
}

export function applyFollowingChanged(
  prev: Set<string>,
  userId: string,
  following: boolean
): Set<string> {
  const next = new Set(prev);
  if (following) next.add(userId);
  else next.delete(userId);
  return next;
}
