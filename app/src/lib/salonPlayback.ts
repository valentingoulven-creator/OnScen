import type { PlaybackState } from '../types';

export type MusicPlatform = 'spotify' | 'youtube';
export type TrackMatchType = 'exact' | 'mock' | 'search';

export interface ResolvedTrack {
  platform: MusicPlatform;
  title: string;
  artist: string;
  trackId?: string;
  externalUrl: string;
  searchUrl: string;
  matchType: TrackMatchType;
}

export function computePlaybackPositionMs(state: PlaybackState, now = Date.now()): number {
  if (!state.isPlaying) return Math.max(0, state.progressMs);
  const anchor = state.startedAt ?? state.updatedAt;
  return Math.max(0, state.progressMs + (now - anchor));
}

/** True when parent `initialState` should replace local playback (track / play-pause / seek). */
export function shouldResetPlaybackFromInitial(
  local: PlaybackState,
  initial: PlaybackState
): boolean {
  if (initial.trackId !== local.trackId) return true;
  if (initial.isPlaying !== local.isPlaying) return true;
  if (initial.startedAt !== local.startedAt) return true;
  if (!initial.isPlaying && initial.progressMs !== local.progressMs) return true;
  if (initial.updatedAt !== local.updatedAt) {
    const sameClockAnchor =
      initial.isPlaying === local.isPlaying &&
      initial.progressMs === local.progressMs &&
      initial.startedAt === local.startedAt;
    if (sameClockAnchor) return false;
    return true;
  }
  return false;
}

/** Apply socket/API state without resetting the clock on metadata-only updates (e.g. showVideo). */
export function mergeRemotePlaybackState(
  local: PlaybackState,
  remote: PlaybackState
): PlaybackState {
  if (shouldResetPlaybackFromInitial(local, remote)) return remote;
  return {
    ...local,
    title: remote.title,
    artist: remote.artist,
    albumArtUrl: remote.albumArtUrl,
    externalUrl: remote.externalUrl,
    showVideo: remote.showVideo,
    platform: remote.platform,
  };
}

export function formatPlaybackTime(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function buildPlatformSearchUrl(platform: MusicPlatform, title: string, artist: string): string {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  if (platform === 'youtube') {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  return `https://open.spotify.com/search/${q}`;
}

export function buildPlatformTrackUrl(platform: MusicPlatform, trackId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/watch?v=${trackId}`;
  }
  return `https://open.spotify.com/track/${trackId}`;
}

/** Lien plateforme avec position (YouTube `t=` ; Spotify sans offset fiable). */
export function buildTrackUrlAtPosition(
  platform: MusicPlatform,
  trackId: string,
  positionMs: number
): string {
  const base = buildPlatformTrackUrl(platform, trackId);
  if (platform === 'youtube') {
    const sec = Math.max(0, Math.floor(positionMs / 1000));
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}t=${sec}`;
  }
  return base;
}

export function buildYouTubeEmbedUrl(trackId: string, startSec = 0, autoplay = false): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    start: String(Math.max(0, Math.floor(startSec))),
    rel: '0',
  });
  if (autoplay) params.set('autoplay', '1');
  return `https://www.youtube.com/embed/${trackId}?${params.toString()}`;
}

export function playbackStateAtResume(state: PlaybackState, now = Date.now()): Partial<PlaybackState> {
  const progressMs = computePlaybackPositionMs(state, now);
  return { progressMs, startedAt: now, updatedAt: now, isPlaying: true };
}

export function playbackStateAtPause(state: PlaybackState, now = Date.now()): Partial<PlaybackState> {
  return {
    progressMs: computePlaybackPositionMs(state, now),
    startedAt: undefined,
    updatedAt: now,
    isPlaying: false,
  };
}

export function playbackStateAtSeek(
  state: PlaybackState,
  progressMs: number,
  now = Date.now()
): Partial<PlaybackState> {
  const clamped = Math.max(0, Math.floor(progressMs));
  if (state.isPlaying) {
    return { progressMs: clamped, startedAt: now, updatedAt: now, isPlaying: true };
  }
  return { progressMs: clamped, startedAt: undefined, updatedAt: now, isPlaying: false };
}

export function preferredParticipantPlatform(
  connectedPlatforms: MusicPlatform[] | undefined,
  hostPlatform: MusicPlatform
): MusicPlatform {
  const connected = connectedPlatforms ?? [];
  if (connected.includes(hostPlatform)) return hostPlatform;
  if (connected.includes('spotify')) return 'spotify';
  if (connected.includes('youtube')) return 'youtube';
  // Aucune plateforme connectée : YouTube est le mode natif navigateur par défaut.
  // - Salon YouTube : lecture directe YouTube ✓
  // - Salon Spotify : écoute croisée YouTube ✓
  return 'youtube';
}
