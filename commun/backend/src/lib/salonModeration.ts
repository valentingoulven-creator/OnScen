import { Salon } from '../models/schema';
import { db } from '../models/schema';
import { getIo } from './ioInstance';
import { isDevUserId } from './devUser';
import { hydrateSalonFromPostgres } from './pgSalonsLives';

export function isSalonVipModerator(salon: Salon, userId: string): boolean {
  return (salon.vipModeratorIds ?? []).includes(userId);
}

/** Hôte, modérateur VIP ou compte Dev. */
export function canModerateSalon(salon: Salon, actorId: string): boolean {
  return salon.hostId === actorId || isSalonVipModerator(salon, actorId) || isDevUserId(actorId);
}

/** Lecture salon : play/pause/stop/next/seek et changement de morceau (pas playlists ni réglages). */
export function canControlSalonPlayback(salon: Salon, actorId: string): boolean {
  return salon.hostId === actorId || isSalonVipModerator(salon, actorId) || isDevUserId(actorId);
}

/** Kick / ban : Dev peut cibler tout le monde sauf lui-même ; VIP ne peut pas cibler l'hôte ni un autre VIP. */
export function canModerateSalonTarget(salon: Salon, actorId: string, targetUserId: string): boolean {
  if (targetUserId === actorId) return false;
  if (isDevUserId(actorId)) return true;
  if (targetUserId === salon.hostId) return false;
  if (salon.hostId === actorId) return true;
  if (!isSalonVipModerator(salon, actorId)) return false;
  return !isSalonVipModerator(salon, targetUserId);
}

export function broadcastSalonUpdated(salon: Salon): void {
  getIo()?.to(`salon_${salon.id}`).emit('salon_updated', salon);
}

export type SalonVipChangeResult =
  | { ok: true; salon: Salon }
  | { ok: false; status: number; error: string };

/** Grant or revoke VIP moderator rights on a salon (host only, not self). */
export async function setSalonVipModerator(
  salonId: string,
  actorId: string,
  targetUserId: string,
  add: boolean
): Promise<SalonVipChangeResult> {
  if (!salonId || !actorId || !targetUserId) {
    return { ok: false, status: 400, error: 'Paramètres invalides' };
  }

  const salon = await hydrateSalonFromPostgres(salonId);
  if (!salon) {
    return { ok: false, status: 404, error: 'Salon introuvable' };
  }
  if (salon.hostId !== actorId && !isDevUserId(actorId)) {
    return { ok: false, status: 403, error: 'Non autorisé' };
  }
  if (targetUserId === salon.hostId) {
    return { ok: false, status: 400, error: 'Impossible de modifier le host' };
  }
  if (!db.users.has(targetUserId)) {
    return { ok: false, status: 400, error: 'Utilisateur invalide' };
  }

  const ids = salon.vipModeratorIds ?? [];
  if (add === true) {
    salon.vipModeratorIds = ids.includes(targetUserId) ? ids : [...ids, targetUserId];
  } else {
    salon.vipModeratorIds = ids.filter((id) => id !== targetUserId);
  }

  db.salons.set(salonId, salon);
  broadcastSalonUpdated(salon);
  return { ok: true, salon };
}
