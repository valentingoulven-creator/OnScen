import { db, Salon } from '../models/schema';
import { getIo } from './ioInstance';

export function isSalonVipModerator(salon: Salon, userId: string): boolean {
  return (salon.vipModeratorIds ?? []).includes(userId);
}

/** Hôte ou modérateur VIP du salon. */
export function canModerateSalon(salon: Salon, actorId: string): boolean {
  return salon.hostId === actorId || isSalonVipModerator(salon, actorId);
}

/** Lecture salon : play/pause/stop/next/seek et changement de morceau (pas playlists ni réglages). */
export function canControlSalonPlayback(salon: Salon, actorId: string): boolean {
  return salon.hostId === actorId || isSalonVipModerator(salon, actorId);
}

/** Kick / ban : VIP ne peut pas cibler l'hôte ni un autre modérateur VIP. */
export function canModerateSalonTarget(salon: Salon, actorId: string, targetUserId: string): boolean {
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
export function setSalonVipModerator(
  salonId: string,
  actorId: string,
  targetUserId: string,
  add: boolean
): SalonVipChangeResult {
  if (!salonId || !actorId || !targetUserId) {
    return { ok: false, status: 400, error: 'Paramètres invalides' };
  }

  const salon = db.salons.get(salonId);
  if (!salon) {
    return { ok: false, status: 404, error: 'Salon introuvable' };
  }
  if (salon.hostId !== actorId) {
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
