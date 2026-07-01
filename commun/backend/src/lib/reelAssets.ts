import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import {
  MAX_RECORDED_REEL_VIDEO_DATA_CHARS,
  REEL_RECORD_MAX_SEC,
  REEL_UPLOAD_MAX_FILE_BYTES,
} from './reelUploadLimits';
import { validateImageMagicBytes, validateVideoMagicBytes } from './imageValidation';
import { probeVideoDurationSec } from './videoDuration';

/** Marge de tolérance (s) sur la durée réelle sondée — arrondis d'encodage/conteneur. */
const REEL_DURATION_TOLERANCE_SEC = 3;

const RECORDED_VIDEO_DATA_RE =
  /^data:video\/(webm|mp4|quicktime|x-m4v)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;
const RECORDED_POSTER_DATA_RE =
  /^data:image\/(jpeg|png|webp)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

export const UPLOADS_REEL_VIDEO_RE =
  /^\/uploads\/reels\/[a-f0-9]{24}\.(webm|mp4|mov|m4v)$/i;
export const UPLOADS_REEL_POSTER_RE =
  /^\/uploads\/reels\/[a-f0-9]{24}-poster\.(jpg|jpeg|png|webp)$/i;

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'reels');
}

function extForVideoMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'quicktime') return 'mov';
  if (m === 'x-m4v') return 'm4v';
  if (m === 'mp4') return 'mp4';
  return 'webm';
}

function extForImageMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'png') return 'png';
  if (m === 'webp') return 'webp';
  return 'jpg';
}

function saveVideoFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = RECORDED_VIDEO_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Vidéo invalide (webm, mp4 ou mov — max ~287 Mo)');
  }
  if (trimmed.length > MAX_RECORDED_REEL_VIDEO_DATA_CHARS) {
    throw new Error('Vidéo trop volumineuse (max ~287 Mo)');
  }
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > REEL_UPLOAD_MAX_FILE_BYTES) {
    throw new Error('Vidéo trop volumineuse (max ~287 Mo)');
  }
  if (!validateVideoMagicBytes(buffer, mime)) {
    throw new Error('Format vidéo non reconnu ou fichier corrompu');
  }
  const realDurationSec = probeVideoDurationSec(buffer, mime);
  if (realDurationSec != null && realDurationSec > REEL_RECORD_MAX_SEC + REEL_DURATION_TOLERANCE_SEC) {
    throw new Error(`Vidéo trop longue (max ${REEL_RECORD_MAX_SEC} s)`);
  }
  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const filename = `${id}.${extForVideoMime(mime)}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/reels/${filename}`;
}

function savePosterFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = RECORDED_POSTER_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Image poster invalide');
  }
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 512 * 1024) {
    throw new Error('Image poster trop volumineuse');
  }
  if (!validateImageMagicBytes(buffer, mime)) {
    throw new Error("Format d'image poster non reconnu ou fichier corrompu");
  }
  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const filename = `${id}-poster.${extForImageMime(mime)}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/reels/${filename}`;
}

export function isUploadedReelVideoUrl(url: string): boolean {
  return UPLOADS_REEL_VIDEO_RE.test(url.trim());
}

export function isUploadedReelPosterUrl(url: string): boolean {
  return UPLOADS_REEL_POSTER_RE.test(url.trim());
}

/** Enregistre une data URL vidéo sur disque ; laisse les URLs http(s) et fichiers locaux inchangés. */
export function resolveReelVideoUrl(raw: string): string {
  const url = raw.trim();
  if (!url) throw new Error('URL vidéo requise');
  if (UPLOADS_REEL_VIDEO_RE.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (RECORDED_VIDEO_DATA_RE.test(url)) return saveVideoFromDataUrl(url);
  throw new Error('URL vidéo invalide');
}

/** Enregistre une data URL image poster sur disque. */
export function resolveReelPosterUrl(raw: string): string {
  const url = raw.trim();
  if (!url) throw new Error('URL poster requise');
  if (UPLOADS_REEL_POSTER_RE.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (RECORDED_POSTER_DATA_RE.test(url)) return savePosterFromDataUrl(url);
  throw new Error('URL poster invalide');
}

export function deleteReelFileIfLocal(fileUrl: string | undefined): void {
  const url = fileUrl?.trim();
  if (!url) return;
  if (!UPLOADS_REEL_VIDEO_RE.test(url) && !UPLOADS_REEL_POSTER_RE.test(url)) return;
  const filePath = path.join(getPublicDir(), url.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* best-effort */
  }
}

export function deleteReelMediaFiles(reel: { videoUrl?: string; posterUrl?: string }): void {
  deleteReelFileIfLocal(reel.videoUrl);
  deleteReelFileIfLocal(reel.posterUrl);
}
