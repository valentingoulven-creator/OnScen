import { db, type Live } from '../models/schema';
import { schedulePersist } from './persist';
import { persistLiveToPgAsync } from './pgSalonsLives';
import { deleteLiveKitRoom, stopLiveKitEgressIfActive } from './livekit';

export function bumpLivePeakViewers(live: Live): void {
  const peak = live.peakViewersCount ?? 0;
  if (live.viewersCount > peak) {
    live.peakViewersCount = live.viewersCount;
    db.lives.set(live.id, live);
  }
}

/**
 * Marque un live comme terminé et planifie la persistance.
 * Idempotent : un live déjà terminé (`endedAt` déjà posé) ressort immédiatement,
 * pour éviter un double arrêt d'egress/room LiveKit et une double persistance en
 * cas d'appels concurrents (ex. /stop + webhook + scheduler de durée max en même temps).
 */
export function endLiveSession(live: Live, endedAt = Date.now()): void {
  if (live.endedAt) return;
  void stopLiveKitEgressIfActive(live.id);
  // Déconnecte immédiatement les participants restants et invalide la room :
  // un token déjà distribué ne permet plus de rejoindre ce live après sa fin.
  void deleteLiveKitRoom(live.id);
  live.isActive = false;
  live.endedAt = endedAt;
  const peak = live.peakViewersCount ?? 0;
  if (live.viewersCount > peak) live.peakViewersCount = live.viewersCount;
  db.lives.set(live.id, live);
  // Libère la réservation « live actif » de l'hôte (garde anti-doublon de POST /lives/start).
  if (db.activeLiveByHost.get(live.hostId) === live.id) {
    db.activeLiveByHost.delete(live.hostId);
  }
  schedulePersist();
  persistLiveToPgAsync(live);
}

/** Lives terminés hébergés par un utilisateur (visibles sur le profil). */
export function listHostedArchivedLives(hostId: string, viewerId: string): Live[] {
  const isOwner = hostId === viewerId;
  return [...db.lives.values()]
    .filter((l) => l.hostId === hostId && !l.isActive)
    .filter((l) => isOwner || !l.adminBlocked)
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
}

export interface ArchivedLiveSummary {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  thumbnailUrl?: string;
  platform: string;
  isActive: false;
  adminBlocked?: boolean;
  /** Rediffusion Cloudflare Stream (HLS) si disponible. */
  replayPlaybackUrl?: string;
  streamMode?: Live['streamMode'];
  peakViewersCount?: number;
}

function replayUrlForLive(l: Live): string | undefined {
  if (l.streamMode !== 'cloudflare') return undefined;
  return l.cloudflareVodPlaybackUrl ?? l.cloudflarePlaybackUrl;
}

export function serializeArchivedLive(l: Live): ArchivedLiveSummary {
  const endedAt = l.endedAt ?? l.startedAt;
  return {
    id: l.id,
    title: l.title,
    hostId: l.hostId,
    hostName: l.hostName,
    startedAt: l.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - l.startedAt),
    thumbnailUrl: l.playbackState?.albumArtUrl,
    platform: l.platform,
    isActive: false,
    adminBlocked: l.adminBlocked || undefined,
    replayPlaybackUrl: replayUrlForLive(l),
    streamMode: l.streamMode,
    peakViewersCount: l.peakViewersCount ?? l.viewersCount,
  };
}
