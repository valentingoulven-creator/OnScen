import { MUSIC_REELS, type MusicReel } from './reels';
import { MAX_RECORDED_REEL_VIDEO_DATA_CHARS } from '../lib/reelRecording';
import { isCompositionAudioUrl } from '../lib/reelCompositionAudio';

const MIXKIT_VIDEO_RE =
  /^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+(-720)?\.mp4(?:\?.*)?$/i;
const MIXKIT_POSTER_RE =
  /^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-thumb-720-0\.jpg(?:\?.*)?$/i;
const MIXKIT_MUSIC_RE =
  /^https:\/\/assets\.mixkit\.co\/music\/\d+\/\d+\.mp3(?:\?.*)?$/i;
const UNSPLASH_IMAGE_RE = /^https:\/\/images\.unsplash\.com\//i;

const BLOCKED_MEDIA_RE =
  /picsum\.photos|commondatastorage|sample-videos|w3schools|mdn\.sample|placeholder\.com|loremflickr/i;

const RECORDED_VIDEO_DATA_RE = /^data:video\/(webm|mp4|quicktime|x-m4v)(?:;[^;,]+)*;base64,/i;
const RECORDED_POSTER_DATA_RE = /^data:image\/(jpeg|png|webp)(?:;[^;,]+)*;base64,/i;
const MAX_RECORDED_VIDEO_CHARS = MAX_RECORDED_REEL_VIDEO_DATA_CHARS;
const MAX_RECORDED_POSTER_CHARS = 220_000;

function isRecordedReelVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    RECORDED_VIDEO_DATA_RE.test(trimmed) && trimmed.length > 0 && trimmed.length <= MAX_RECORDED_VIDEO_CHARS
  );
}

function isRecordedReelPosterUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    RECORDED_POSTER_DATA_RE.test(trimmed) && trimmed.length > 0 && trimmed.length <= MAX_RECORDED_POSTER_CHARS
  );
}

function isRecordedReelMedia(reel: MusicReel): boolean {
  const video = reel.videoUrl?.trim() ?? '';
  if (!video || !isRecordedReelVideoUrl(video)) return false;
  const poster = reel.posterUrl?.trim() ?? '';
  if (poster && !isRecordedReelPosterUrl(poster)) return false;
  return reel.mediaType !== 'image';
}

function isAllowedReelAudioUrl(url: string): boolean {
  const trimmed = url.trim();
  return MIXKIT_MUSIC_RE.test(trimmed) || isCompositionAudioUrl(trimmed);
}

/** Son jouable dans le flux public (piste dédiée, flag explicite, ou enregistrement caméra). */
export function reelHasPlayableAudio(reel: MusicReel): boolean {
  if (reel.hasAudio === false) return false;
  const audioUrl = reel.audioUrl?.trim() ?? '';
  if (audioUrl && isAllowedReelAudioUrl(audioUrl)) return true;
  if (reel.hasAudio === true && reel.mediaType === 'video' && !!reel.videoUrl) return true;
  if (isRecordedReelMedia(reel)) return true;
  return false;
}

/** Média autorisé dans le flux : Mixkit, Unsplash, ou enregistrement caméra (data URL). */
export function isCuratedReelMedia(reel: MusicReel): boolean {
  const video = reel.videoUrl?.trim() ?? '';
  const poster = reel.posterUrl?.trim() ?? '';
  const audio = reel.audioUrl?.trim() ?? '';
  if (BLOCKED_MEDIA_RE.test(video) || BLOCKED_MEDIA_RE.test(poster) || BLOCKED_MEDIA_RE.test(audio)) {
    return false;
  }

  if (isRecordedReelMedia(reel)) return true;

  if (audio && !isAllowedReelAudioUrl(audio)) return false;

  if (reel.mediaType === 'image' || (!video && poster)) {
    return UNSPLASH_IMAGE_RE.test(poster);
  }
  return MIXKIT_VIDEO_RE.test(video) && (!poster || MIXKIT_POSTER_RE.test(poster) || UNSPLASH_IMAGE_RE.test(poster));
}

/** Reel affichable dans le flux Reels (vidéo avec son, pas les visuels statiques seuls). */
export function isPublicFeedReel(reel: MusicReel): boolean {
  if (reel.mediaType === 'image' || (!reel.videoUrl?.trim() && !reel.audioUrl?.trim())) return false;
  if (!isCuratedReelMedia(reel) && !isRecordedReelMedia(reel)) return false;
  return reelHasPlayableAudio(reel);
}

/** Réponse API → entrée canonique du catalogue local si l’id est connu. */
export function canonicalReel(reel: MusicReel): MusicReel | null {
  const demo = MUSIC_REELS.find((r) => r.id === reel.id);
  if (demo) {
    return reel.authorId ? { ...demo, authorId: reel.authorId } : demo;
  }
  if (!isCuratedReelMedia(reel)) return null;
  return reel;
}

/** Flux Reels : extras utilisateur curés en tête, puis catalogue démo (sans doublon d’id). */
export function buildReelsFeed(userReels: MusicReel[]): MusicReel[] {
  const curated = userReels
    .map(canonicalReel)
    .filter((r): r is MusicReel => r != null)
    .filter(isPublicFeedReel);
  const ids = new Set(curated.map((r) => r.id));
  const demos = MUSIC_REELS.filter((r) => !ids.has(r.id) && isPublicFeedReel(r));
  const feed = [...curated, ...demos];
  return feed.length > 0 ? feed : MUSIC_REELS.filter(isPublicFeedReel);
}

export function findReelIndexInFeed(feed: MusicReel[], reelId: string): number {
  const i = feed.findIndex((r) => r.id === reelId);
  return i >= 0 ? i : 0;
}

type ApiReel = Partial<MusicReel> & {
  mediaUrl?: string;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Normalise la forme API (mediaUrl / champs manquants) vers MusicReel affichable. */
export function normalizeReelFromApi(raw: ApiReel): MusicReel | null {
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) return null;

  const mediaUrl = str(raw.mediaUrl);
  let videoUrl = str(raw.videoUrl);
  let posterUrl = str(raw.posterUrl);
  const audioUrl = str(raw.audioUrl);
  const mediaType =
    raw.mediaType === 'image' ? 'image' : raw.mediaType === 'video' ? 'video' : undefined;

  if (mediaType === 'image') {
    posterUrl = posterUrl || mediaUrl;
    videoUrl = '';
  } else {
    if (!videoUrl && mediaUrl) videoUrl = mediaUrl;
    if (!posterUrl) posterUrl = videoUrl || mediaUrl;
  }

  const durationSec =
    typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec) && raw.durationSec > 0
      ? Math.round(raw.durationSec)
      : undefined;

  const visibility =
    raw.visibility === 'private' || raw.visibility === 'public' ? raw.visibility : undefined;
  const isPrivate = raw.isPrivate === true || visibility === 'private';

  const draft: MusicReel = {
    id,
    title,
    artist: str(raw.artist),
    genre: str(raw.genre),
    mediaType: mediaType ?? (videoUrl ? 'video' : 'image'),
    videoUrl: videoUrl || undefined,
    posterUrl,
    authorId: raw.authorId,
    authorUsername: str(raw.authorUsername) || undefined,
    authorAvatarUrl: str(raw.authorAvatarUrl) || undefined,
    authorUsernameColor: str(raw.authorUsernameColor) || undefined,
    authorUsernameWaveFrom: str(raw.authorUsernameWaveFrom) || undefined,
    authorUsernameWaveTo: str(raw.authorUsernameWaveTo) || undefined,
    ...(audioUrl ? { audioUrl } : {}),
    ...(raw.hasAudio === true ? { hasAudio: true } : raw.hasAudio === false ? { hasAudio: false } : {}),
    ...(durationSec != null ? { durationSec } : {}),
    ...(visibility ? { visibility } : {}),
    ...(isPrivate ? { isPrivate: true } : { isPrivate: false }),
  };

  return canonicalReel(draft);
}

/** Normalise un reel profil (y compris privés / enregistrés) sans filtrage flux public. */
export function normalizeProfileReelFromApi(raw: ApiReel): MusicReel | null {
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) return null;

  const mediaUrl = str(raw.mediaUrl);
  let videoUrl = str(raw.videoUrl);
  let posterUrl = str(raw.posterUrl);
  const audioUrl = str(raw.audioUrl);
  const mediaType =
    raw.mediaType === 'image' ? 'image' : raw.mediaType === 'video' ? 'video' : undefined;

  if (mediaType === 'image') {
    posterUrl = posterUrl || mediaUrl;
    videoUrl = '';
  } else {
    if (!videoUrl && mediaUrl) videoUrl = mediaUrl;
    if (!posterUrl) posterUrl = videoUrl || mediaUrl;
  }

  const durationSec =
    typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec) && raw.durationSec > 0
      ? Math.round(raw.durationSec)
      : undefined;

  const visibility =
    raw.visibility === 'private' || raw.visibility === 'public' ? raw.visibility : undefined;
  const isPrivate = raw.isPrivate === true || visibility === 'private';

  return {
    id,
    title,
    artist: str(raw.artist),
    genre: str(raw.genre),
    mediaType: mediaType ?? (videoUrl ? 'video' : 'image'),
    videoUrl: videoUrl || undefined,
    posterUrl,
    authorId: raw.authorId,
    authorUsername: str(raw.authorUsername) || undefined,
    authorAvatarUrl: str(raw.authorAvatarUrl) || undefined,
    authorUsernameColor: str(raw.authorUsernameColor) || undefined,
    authorUsernameWaveFrom: str(raw.authorUsernameWaveFrom) || undefined,
    authorUsernameWaveTo: str(raw.authorUsernameWaveTo) || undefined,
    ...(audioUrl ? { audioUrl } : {}),
    ...(raw.hasAudio === true ? { hasAudio: true } : raw.hasAudio === false ? { hasAudio: false } : {}),
    ...(durationSec != null ? { durationSec } : {}),
    ...(visibility ? { visibility } : {}),
    isPrivate,
    ...(typeof raw.viewCount === 'number' && raw.viewCount >= 0
      ? { viewCount: raw.viewCount }
      : {}),
  };
}

function reelHasDisplayableMedia(reel: MusicReel): boolean {
  return !!reel.posterUrl || !!reel.videoUrl;
}

/** Fusionne la réponse API avec le catalogue local ; retombe sur MUSIC_REELS si vide ou non curé. */
export function resolveReelsFeed(apiReels: unknown): MusicReel[] {
  const list = Array.isArray(apiReels) ? apiReels : [];
  const normalized = list
    .map((raw) => normalizeReelFromApi(raw as ApiReel))
    .filter((r): r is MusicReel => r != null && reelHasDisplayableMedia(r));

  const merged = buildReelsFeed(normalized);
  if (merged.length === 0 || !merged.some(reelHasDisplayableMedia)) {
    return MUSIC_REELS.filter(isPublicFeedReel);
  }
  return merged;
}

export function fallbackPosterForReel(reelId: string): string | undefined {
  return MUSIC_REELS.find((r) => r.id === reelId)?.posterUrl;
}
