import type { PlaybackState } from '../types';

export type MusicPlatform = 'youtube';
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

export function buildPlatformSearchUrl(_platform: MusicPlatform, title: string, artist: string): string {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  return `https://www.youtube.com/results?search_query=${q}`;
}

export function buildPlatformTrackUrl(_platform: MusicPlatform, trackId: string): string {
  return `https://www.youtube.com/watch?v=${trackId}`;
}

/** Lien plateforme avec position (YouTube `t=`). */
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

export function buildYouTubeEmbedUrl(
  trackId: string,
  startSec = 0,
  autoplay = false,
  options?: { controls?: boolean; mute?: boolean }
): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    start: String(Math.max(0, Math.floor(startSec))),
    rel: '0',
  });
  if (autoplay) params.set('autoplay', '1');
  if (options?.controls !== undefined) params.set('controls', options.controls ? '1' : '0');
  if (options?.mute !== undefined) params.set('mute', options.mute ? '1' : '0');
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

/** Heartbeat hôte YouTube : position uniquement (ne touche pas isPlaying). */
export function playbackStateAtProgressReport(
  state: PlaybackState,
  progressMs: number,
  now = Date.now()
): Partial<PlaybackState> {
  const clamped = Math.max(0, Math.floor(progressMs));
  if (state.isPlaying) {
    return { progressMs: clamped, startedAt: now, updatedAt: now };
  }
  return { progressMs: clamped, updatedAt: now };
}

/** Format ID vidéo YouTube (6–15 car. alphanum / _ -). */
export const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{6,15}$/;

export function isValidYoutubeVideoId(id: string | undefined | null): id is string {
  const raw = id?.trim();
  return Boolean(raw && YOUTUBE_VIDEO_ID_RE.test(raw));
}

/** Extrait un ID vidéo YouTube depuis une URL ou un identifiant brut. */
export function parseYoutubeVideoId(input: string | undefined | null): string | null {
  const raw = input?.trim();
  if (!raw || raw === 'demo') return null;
  const fromUrl = raw.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/
  )?.[1];
  if (fromUrl && isValidYoutubeVideoId(fromUrl)) return fromUrl;
  if (isValidYoutubeVideoId(raw)) return raw;
  return null;
}

/** Résout l'ID YouTube du morceau salon (trackId, externalUrl, résolution auditeur). */
export function resolveSalonYoutubeTrackId(
  playbackState: Pick<PlaybackState, 'trackId' | 'externalUrl'>,
  resolved?: { trackId?: string; externalUrl?: string } | null
): string | undefined {
  return (
    parseYoutubeVideoId(playbackState.trackId) ??
    parseYoutubeVideoId(playbackState.externalUrl) ??
    parseYoutubeVideoId(resolved?.trackId) ??
    parseYoutubeVideoId(resolved?.externalUrl) ??
    undefined
  );
}

export function preferredParticipantPlatform(
  connectedPlatforms: MusicPlatform[] | undefined,
  hostPlatform: MusicPlatform
): MusicPlatform {
  const connected = connectedPlatforms ?? [];
  if (connected.includes(hostPlatform)) return hostPlatform;
  if (connected.includes('youtube')) return 'youtube';
  return 'youtube';
}
