import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import {
  COMPOSITION_UPLOAD_MAX_FILE_BYTES,
  MAX_COMPOSITION_AUDIO_DATA_CHARS,
} from './compositionUploadLimits';

const COMPOSITION_AUDIO_DATA_RE =
  /^data:audio\/(mpeg|mp3|wav|x-wav|mp4|x-m4a|ogg|webm|x-flac|flac)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

const UPLOADS_FILE_RE = /^\/uploads\/compositions\/[a-zA-Z0-9._-]+\.(mp3|wav|m4a|ogg|webm|flac)$/i;

export function isValidCompositionFileUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  if (UPLOADS_FILE_RE.test(url)) return true;
  if (!COMPOSITION_AUDIO_DATA_RE.test(url)) return false;
  return url.length <= MAX_COMPOSITION_AUDIO_DATA_CHARS;
}

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'compositions');
}

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'wav' || m === 'x-wav') return 'wav';
  if (m === 'mp4' || m === 'x-m4a') return 'm4a';
  if (m === 'ogg') return 'ogg';
  if (m === 'webm') return 'webm';
  if (m === 'flac' || m === 'x-flac') return 'flac';
  return 'mp3';
}

/** Décode une data URL audio et l'enregistre sous public/uploads/compositions/. */
export function saveCompositionFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = COMPOSITION_AUDIO_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Fichier audio invalide (mp3, wav, m4a, ogg — max 30 Mo)');
  }
  if (trimmed.length > MAX_COMPOSITION_AUDIO_DATA_CHARS) {
    throw new Error('Fichier audio trop volumineux (max 30 Mo)');
  }

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > COMPOSITION_UPLOAD_MAX_FILE_BYTES) {
    throw new Error('Fichier audio trop volumineux (max 30 Mo)');
  }

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });

  const id = crypto.randomBytes(12).toString('hex');
  const ext = extForMime(mime);
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/uploads/compositions/${filename}`;
}

export function resolveCompositionFileUrl(raw: string): string {
  const url = raw.trim();
  if (UPLOADS_FILE_RE.test(url)) return url;
  if (COMPOSITION_AUDIO_DATA_RE.test(url)) {
    return saveCompositionFromDataUrl(url);
  }
  throw new Error('URL audio invalide');
}

export function deleteCompositionFileIfLocal(fileUrl: string): void {
  const url = fileUrl.trim();
  if (!UPLOADS_FILE_RE.test(url)) return;
  const filePath = path.join(getPublicDir(), url.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup
  }
}
