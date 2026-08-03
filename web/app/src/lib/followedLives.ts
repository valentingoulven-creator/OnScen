import type { Live } from '../types';
import { isActiveMapLive } from './mapLiveEndSync';

/** Lives actifs des hôtes suivis — même règle que « Suivi » dans l’onglet Live. */
export function pickFollowedActiveLives(lives: Live[], followingIds: Set<string>): Live[] {
  if (followingIds.size === 0) return [];
  return lives.filter((l) => isActiveMapLive(l) && followingIds.has(l.hostId));
}
