import { db, type Live } from '../models/schema';
import { schedulePersist } from './persist';
import { persistLiveToPgAsync } from './pgSalonsLives';

export function bumpLivePeakViewers(live: Live): void {
  const peak = live.peakViewersCount ?? 0;
  if (live.viewersCount > peak) {
    live.peakViewersCount = live.viewersCount;
    db.lives.set(live.id, live);
  }
}

/** Marque un live comme terminé et planifie la persistance. */
export function endLiveSession(live: Live, endedAt = Date.now()): void {
  live.isActive = false;
  if (!live.endedAt) live.endedAt = endedAt;
  const peak = live.peakViewersCount ?? 0;
  if (live.viewersCount > peak) live.peakViewersCount = live.viewersCount;
  db.lives.set(live.id, live);
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
