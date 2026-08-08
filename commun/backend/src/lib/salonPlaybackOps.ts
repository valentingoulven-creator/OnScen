import { getIo } from './ioInstance';
import { parseMusicLink, buildPlatformTrackUrl } from './musicLinks';
import { playbackStateAtResume } from './playbackClock';
import {
  db,
  Salon,
  SalonQueueItem,
  SalonTrackProposal,
  MusicPlatform,
  PlaybackState,
} from '../models/schema';
import { clearSalonQueueFromPgAsync, persistSalonQueueAsync } from './pgSalonQueues';
import { stampYoutubePlaybackMetadata, stampYoutubeQueueItemMetadata, youtubeMetadataNow } from './youtubeMetadata';

export function ensureSalonQueue(salonId: string): SalonQueueItem[] {
  if (!db.salonQueues.has(salonId)) db.salonQueues.set(salonId, []);
  return db.salonQueues.get(salonId)!;
}

export function ensureSalonProposals(salonId: string): SalonTrackProposal[] {
  if (!db.salonProposals.has(salonId)) db.salonProposals.set(salonId, []);
  return db.salonProposals.get(salonId)!;
}

export function clearSalonPlaybackData(salonId: string): void {
  db.salonQueues.delete(salonId);
  db.salonProposals.delete(salonId);
  clearSalonQueueFromPgAsync(salonId);
}

function persistQueue(salonId: string): void {
  persistSalonQueueAsync(salonId);
}

export function sortPendingProposals(proposals: SalonTrackProposal[]): SalonTrackProposal[] {
  return [...proposals].sort((a, b) => {
    const upvoteDiff = (b.upvotes?.length ?? 0) - (a.upvotes?.length ?? 0);
    if (upvoteDiff !== 0) return upvoteDiff;
    return b.createdAt - a.createdAt;
  });
}

export function getPendingProposals(salonId: string): SalonTrackProposal[] {
  const pending = ensureSalonProposals(salonId).filter((p) => p.status === 'pending');
  return sortPendingProposals(pending);
}

export function albumArtForTrack(platform: MusicPlatform, trackId?: string): string | undefined {
  if (platform === 'youtube' && trackId && trackId !== 'demo') {
    return `https://img.youtube.com/vi/${trackId}/hqdefault.jpg`;
  }
  return undefined;
}

export function resolveTrackFromProposal(
  salon: Salon,
  proposal: Pick<SalonTrackProposal, 'title' | 'artist' | 'youtubeUrl'>
): { trackId?: string; externalUrl?: string } {
  const candidate = proposal.youtubeUrl;
  if (!candidate) return {};
  const parsed = parseMusicLink(salon.platform, candidate);
  if (parsed) {
    return {
      trackId: parsed.trackId,
      externalUrl: buildPlatformTrackUrl(salon.platform, parsed.trackId),
    };
  }
  return {};
}

export function buildPlaybackFromQueueItem(salon: Salon, item: SalonQueueItem, now = Date.now()): PlaybackState {
  const trackId = item.trackId || 'demo';
  const externalUrl =
    item.externalUrl ||
    (trackId !== 'demo' ? buildPlatformTrackUrl(salon.platform, trackId) : undefined);
  return {
    platform: salon.platform,
    trackId,
    title: item.title,
    artist: item.artist,
    albumArtUrl: item.albumArtUrl || albumArtForTrack(salon.platform, trackId),
    isPlaying: true,
    progressMs: 0,
    updatedAt: now,
    startedAt: now,
    externalUrl,
    ...(salon.platform === 'youtube' ? { showVideo: true, metadataFetchedAt: item.metadataFetchedAt ?? youtubeMetadataNow() } : {}),
  };
}

export function applyQueueItemToSalon(salon: Salon, item: SalonQueueItem): PlaybackState {
  const now = Date.now();
  salon.playbackState = buildPlaybackFromQueueItem(salon, item, now);
  db.salons.set(salon.id, salon);
  return salon.playbackState;
}

export function broadcastSalonPlayback(salonId: string, playbackState: PlaybackState): void {
  const io = getIo();
  if (!io) return;
  io.to(`salon_${salonId}`).emit('salon_playback', playbackState);

  const live = db.lives.get(salonId);
  if (live?.isActive) {
    live.playbackState = playbackState;
    db.lives.set(salonId, live);
    io.to(`live_${salonId}`).emit('salon_playback', playbackState);
  }
}

export function broadcastSalonQueue(salonId: string): void {
  const io = getIo();
  if (!io) return;
  const queue = ensureSalonQueue(salonId);
  io.to(`salon_${salonId}`).emit('salon_queue_updated', { salonId, queue });
}

export function broadcastSalonProposals(salonId: string): void {
  const io = getIo();
  if (!io) return;
  const proposals = getPendingProposals(salonId);
  io.to(`salon_${salonId}`).emit('salon_proposals_updated', { salonId, proposals });
}

export function hostSkipNext(salon: Salon): PlaybackState | null {
  const queue = ensureSalonQueue(salon.id);
  if (queue.length === 0) return null;
  const next = queue.shift()!;
  db.salonQueues.set(salon.id, queue);
  persistQueue(salon.id);
  const state = applyQueueItemToSalon(salon, next);
  broadcastSalonQueue(salon.id);
  broadcastSalonPlayback(salon.id, state);
  return state;
}

export function hostPlayQueueItem(salon: Salon, queueItemId: string): PlaybackState | null {
  const queue = ensureSalonQueue(salon.id);
  const idx = queue.findIndex((q) => q.id === queueItemId);
  if (idx < 0) return null;
  const [item] = queue.splice(idx, 1);
  db.salonQueues.set(salon.id, queue);
  persistQueue(salon.id);
  const state = applyQueueItemToSalon(salon, item);
  broadcastSalonQueue(salon.id);
  broadcastSalonPlayback(salon.id, state);
  return state;
}

export function enqueueItem(salonId: string, item: Omit<SalonQueueItem, 'id' | 'addedAt'>): SalonQueueItem {
  const queue = ensureSalonQueue(salonId);
  const salon = db.salons.get(salonId);
  const full: SalonQueueItem = stampYoutubeQueueItemMetadata(salon?.platform ?? 'youtube', {
    ...item,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    addedAt: Date.now(),
  });
  queue.push(full);
  db.salonQueues.set(salonId, queue);
  persistQueue(salonId);
  broadcastSalonQueue(salonId);
  return full;
}

export function proposalToQueueItem(
  salon: Salon,
  proposal: SalonTrackProposal,
  _hostId: string,
  _hostName: string
): SalonQueueItem {
  const resolved = resolveTrackFromProposal(salon, proposal);
  return {
    id: '',
    title: proposal.title,
    artist: proposal.artist,
    trackId: resolved.trackId,
    externalUrl: resolved.externalUrl,
    albumArtUrl: albumArtForTrack(salon.platform, resolved.trackId),
    addedById: proposal.proposerId,
    addedByName: proposal.proposerName,
    source: 'proposal',
    proposalId: proposal.id,
    addedAt: 0,
  };
}

export function resumeSalonPlayback(salon: Salon): PlaybackState {
  const patch = playbackStateAtResume(salon.playbackState);
  salon.playbackState = { ...salon.playbackState, ...patch };
  db.salons.set(salon.id, salon);
  broadcastSalonPlayback(salon.id, salon.playbackState);
  return salon.playbackState;
}

export function hostLoadYoutubePlaylist(
  salon: Salon,
  items: Omit<SalonQueueItem, 'id' | 'addedAt'>[],
  hostId: string,
  hostName: string
): PlaybackState | null {
  if (items.length === 0) return null;
  const now = Date.now();
  const built: SalonQueueItem[] = items.map((item, i) =>
    stampYoutubeQueueItemMetadata(salon.platform, {
      ...item,
      id: `q_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      addedAt: now + i,
      addedById: hostId,
      addedByName: hostName,
      source: 'host' as const,
    })
  );
  const [first, ...rest] = built;
  db.salonQueues.set(salon.id, rest);
  persistQueue(salon.id);
  const state = applyQueueItemToSalon(salon, first);
  broadcastSalonQueue(salon.id);
  broadcastSalonPlayback(salon.id, state);
  return state;
}

/** Retire un morceau de la file OnScen s'il y est (changement immédiat ≠ file d'attente). */
/** Réordonne la file OnScen (hôte / VIP). `orderedIds` doit lister tous les ids actuels. */
export function reorderSalonQueue(salonId: string, orderedIds: string[]): SalonQueueItem[] | null {
  const queue = ensureSalonQueue(salonId);
  if (orderedIds.length !== queue.length) return null;
  const byId = new Map(queue.map((q) => [q.id, q]));
  if (!orderedIds.every((id) => byId.has(id))) return null;
  const reordered = orderedIds.map((id) => byId.get(id)!);
  db.salonQueues.set(salonId, reordered);
  persistQueue(salonId);
  broadcastSalonQueue(salonId);
  return reordered;
}

export function removeTrackFromSalonQueue(salonId: string, trackId: string): boolean {
  const safeId = trackId.trim();
  if (!safeId) return false;
  const queue = ensureSalonQueue(salonId);
  const next = queue.filter((item) => item.trackId !== safeId);
  if (next.length === queue.length) return false;
  db.salonQueues.set(salonId, next);
  persistQueue(salonId);
  broadcastSalonQueue(salonId);
  return true;
}

export function hostChangePlaybackTrack(
  salon: Salon,
  track: { trackId: string; title: string; artist: string; externalUrl?: string; albumArtUrl?: string }
): PlaybackState {
  const now = Date.now();
  const trackId = track.trackId;
  const externalUrl =
    track.externalUrl ||
    (trackId !== 'demo' ? buildPlatformTrackUrl(salon.platform, trackId) : undefined);
  salon.playbackState = stampYoutubePlaybackMetadata(salon.platform, {
    platform: salon.platform,
    trackId,
    title: track.title.slice(0, 120),
    artist: track.artist.slice(0, 80),
    albumArtUrl: track.albumArtUrl || albumArtForTrack(salon.platform, trackId),
    isPlaying: true,
    progressMs: 0,
    updatedAt: now,
    startedAt: now,
    externalUrl,
    ...(salon.platform === 'youtube' ? { showVideo: true } : {}),
  });
  db.salons.set(salon.id, salon);
  broadcastSalonPlayback(salon.id, salon.playbackState);
  return salon.playbackState;
}
