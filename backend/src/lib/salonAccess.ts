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

export function canJoinSalon(salon: Salon, userId: string): boolean {
  const user = db.users.get(userId);
  if (isDevUser(user)) return true;
  const s = normalizeSalonAccess(salon);
  if (s.hostId === userId) return true;
  if (s.accessMode === 'public') return true;
  return s.allowedUserIds.includes(userId);
}

export function isSalonVisibleOnMap(salon: Salon, viewerId: string): boolean {
  if (salon.adminBlocked && !isDevUser(db.users.get(viewerId))) return false;
  if (isDevUser(db.users.get(viewerId))) return true;
  if (salon.isGhostMode) return false;
  return canJoinSalon(salon, viewerId);
}
