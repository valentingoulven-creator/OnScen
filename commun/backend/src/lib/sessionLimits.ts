import { Server } from 'socket.io';
import { db } from '../models/schema';
import { clearSalonPlaybackData } from './salonPlaybackOps';
import { endLiveSession } from './liveArchive';

/** Durée maximale d'une session d'écoute salon : 2 heures. */
export const SALON_MAX_DURATION_MS = 2 * 60 * 60 * 1000;

/** Durée maximale d'un live : 8 heures. */
export const LIVE_MAX_DURATION_MS = 8 * 60 * 60 * 1000;

/** Délai avant la fin à partir duquel l'avertissement est envoyé : 15 minutes. */
export const SESSION_WARNING_BEFORE_MS = 15 * 60 * 1000;

/** Intervalle de vérification périodique : 5 minutes. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const warnedSalons = new Set<string>();
const warnedLives = new Set<string>();

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSessionLimitScheduler(io: Server): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => checkSessionLimits(io), CHECK_INTERVAL_MS);
}

export function stopSessionLimitScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function checkSessionLimits(io: Server): void {
  const now = Date.now();

  for (const [salonId, salon] of db.salons.entries()) {
    const elapsed = now - salon.createdAt;
    const remaining = SALON_MAX_DURATION_MS - elapsed;

    if (remaining <= 0) {
      // Un live lié à ce salon (id partagé) ne doit pas continuer à tourner sans
      // salon derrière lui : sinon il reste actif indéfiniment (orphelin), invisible
      // depuis la carte/le salon mais toujours joignable et décompté dans le quota hôte.
      const linkedLive = db.lives.get(salonId);
      if (linkedLive?.isActive) {
        endLiveSession(linkedLive);
        io.to(`live_${salonId}`).emit('live_ended', {
          liveId: salonId,
          reason: 'duration_limit',
        });
      }
      db.salons.delete(salonId);
      db.salonChats.delete(salonId);
      clearSalonPlaybackData(salonId);
      warnedSalons.delete(salonId);
      io.to(`salon_${salonId}`).emit('salon_ended', {
        salonId,
        reason: 'duration_limit',
      });
    } else if (remaining <= SESSION_WARNING_BEFORE_MS && !warnedSalons.has(salonId)) {
      warnedSalons.add(salonId);
      io.to(`salon_${salonId}`).emit('session_warning', {
        type: 'salon',
        id: salonId,
        remainingMs: remaining,
      });
    }
  }

  for (const [liveId, live] of db.lives.entries()) {
    if (!live.isActive) continue;
    const elapsed = now - live.startedAt;
    const remaining = LIVE_MAX_DURATION_MS - elapsed;

    if (remaining <= 0) {
      endLiveSession(live);
      warnedLives.delete(liveId);
      io.to(`live_${liveId}`).emit('live_ended', {
        liveId,
        reason: 'duration_limit',
      });
    } else if (remaining <= SESSION_WARNING_BEFORE_MS && !warnedLives.has(liveId)) {
      warnedLives.add(liveId);
      io.to(`live_${liveId}`).emit('session_warning', {
        type: 'live',
        id: liveId,
        remainingMs: remaining,
      });
    }
  }
}
