import { Salon } from '../models/schema';
import { db } from '../models/schema';
import { isDevUser } from './accessControl';

export type SalonAccessMode = 'public' | 'invite';

export function normalizeSalonAccess(salon: Salon): Salon {
  if (!salon.allowedUserIds?.length) {
    salon.allowedUserIds = [salon.hostId];
  } else if (!salon.allowedUserIds.includes(salon.hostId)) {
    salon.allowedUserIds = [salon.hostId, ...salon.allowedUserIds];
  }
  if (!salon.accessMode) {
    salon.accessMode = salon.isPublic ? 'public' : 'invite';
  }
  salon.isPublic = salon.accessMode === 'public';
  return salon;
}

/** Salon ouvert à tous (accessMode public après normalisation). */
export function isSalonPublic(salon: Salon): boolean {
  return normalizeSalonAccess(salon).accessMode === 'public';
}

export function canJoinSalon(salon: Salon, userId: string): boolean {
  const user = db.users.get(userId);
  if (isDevUser(user)) return true;
  const s = normalizeSalonAccess(salon);
  if (s.hostId === userId) return true;
  if (s.accessMode === 'public') return true;
  return s.allowedUserIds.includes(userId);
}

/**
 * Visibilité carte / globe :
 * - public → tous les utilisateurs connectés (sauf ghost / adminBlocked)
 * - invite → hôte + invités uniquement
 * - dev → tout (y compris bloqué / ghost / invite)
 */
export function isSalonVisibleOnMap(salon: Salon, viewerId: string): boolean {
  const viewer = db.users.get(viewerId);
  if (isDevUser(viewer)) return true;
  if (salon.adminBlocked) return false;
  if (salon.isGhostMode) return false;
  const host = db.users.get(salon.hostId);
  if (host?.isGhostMode) return false;

  const s = normalizeSalonAccess(salon);
  if (s.accessMode === 'public') return true;
  if (s.hostId === viewerId) return true;
  return s.allowedUserIds.includes(viewerId);
}
