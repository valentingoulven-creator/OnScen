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
}

export function getPendingProposals(salonId: string): SalonTrackProposal[] {
  return ensureSalonProposals(salonId).filter((p) => p.status === 'pending');
}

export function albumArtForTrack(platform: MusicPlatform, trackId?: string): string | undefined {
  if (platform === 'youtube' && trackId && trackId !== 'demo') {
    return `https://img.youtube.com/vi/${trackId}/hqdefault.jpg`;
  }
  return undefined;
}

export function resolveTrackFromProposal(
  salon: Salon,
  proposal: Pick<SalonTrackProposal, 'title' | 'artist' | 'spotifyUrl' | 'youtubeUrl'>
): { trackId?: string; externalUrl?: string } {
  const plat = salon.platform;
  const link = plat === 'youtube' ? proposal.youtubeUrl : proposal.spotifyUrl;
  const altLink = plat === 'youtube' ? proposal.spotifyUrl : proposal.youtubeUrl;
  for (const candidate of [link, altLink]) {
    if (!candidate) continue;
    const parsed = parseMusicLink(plat, candidate);
    if (parsed) {
      return {
        trackId: parsed.trackId,
        externalUrl: buildPlatformTrackUrl(plat, parsed.trackId),
      };
    }
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
  io.to(`salon_${salonId}`).emit('playback_sync', playbackState);
  io.to(`salon_${salonId}`).emit('salon_playback', playbackState);

  const live = db.lives.get(salonId);
  if (live?.isActive) {
    live.playbackState = playbackState;
    db.lives.set(salonId, live);
    io.to(`live_${salonId}`).emit('playback_sync', playbackState);
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
  const state = applyQueueItemToSalon(salon, item);
  broadcastSalonQueue(salon.id);
  broadcastSalonPlayback(salon.id, state);
  return state;
}

export function enqueueItem(salonId: string, item: Omit<SalonQueueItem, 'id' | 'addedAt'>): SalonQueueItem {
  const queue = ensureSalonQueue(salonId);
  const full: SalonQueueItem = {
    ...item,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    addedAt: Date.now(),
  };
  queue.push(full);
  db.salonQueues.set(salonId, queue);
  broadcastSalonQueue(salonId);
  return full;
}

export function proposalToQueueItem(
  salon: Salon,
  proposal: SalonTrackProposal,
  hostId: string,
  hostName: string
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
