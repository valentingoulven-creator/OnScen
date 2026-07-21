import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import { validateImageMagicBytes } from './imageValidation';
import { deleteObjectByUrl, uploadObject } from './objectStorage';

export const PROFILE_PHOTO_DATA_RE =
  /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

export const UPLOADS_PROFILE_PHOTO_RE =
  /^\/uploads\/profile-photos\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'png') return 'png';
  if (m === 'webp') return 'webp';
  if (m === 'gif') return 'gif';
  return 'jpg';
}

export function isProfilePhotoFileUrl(url: string): boolean {
  return UPLOADS_PROFILE_PHOTO_RE.test(url.trim());
}

export function decodeProfilePhotoDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const trimmed = String(dataUrl).trim();
  const match = PROFILE_PHOTO_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Format de photo non pris en charge (JPEG, PNG, WebP, GIF).');
  }
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error('Chaque photo ne peut pas dépasser 2 Mo.');
  }
  if (!validateImageMagicBytes(buffer, mime)) {
    throw new Error('Photo invalide ou corrompue.');
  }
  return { buffer, mime };
}

export async function saveProfilePhotoBuffer(buffer: Buffer, mime: string): Promise<string> {
  const ext = extForMime(mime);
  const filename = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  const stored = await uploadObject(buffer, {
    prefix: 'profile-photos',
    filename,
    extension: ext,
    contentType: `image/${mime === 'jpg' ? 'jpeg' : mime}`,
  });
  return stored.url;
}

export async function saveProfilePhotoFromDataUrl(dataUrl: string): Promise<string> {
  const { buffer, mime } = decodeProfilePhotoDataUrl(dataUrl);
  return saveProfilePhotoBuffer(buffer, mime);
}

/**
 * Convertit les data URLs en fichiers servis ; conserve URLs http(s) et /uploads/ existantes.
 */
export async function persistProfilePhotoUrls(photos: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of photos) {
    const trimmed = String(raw).trim();
    if (!trimmed) {
      out.push('');
      continue;
    }
    if (PROFILE_PHOTO_DATA_RE.test(trimmed)) {
      out.push(await saveProfilePhotoFromDataUrl(trimmed));
      continue;
    }
    if (UPLOADS_PROFILE_PHOTO_RE.test(trimmed) || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      out.push(trimmed);
      continue;
    }
    out.push('');
  }
  return out;
}

export function deleteProfilePhotoIfLocal(url: string | undefined): void {
  if (!url || !UPLOADS_PROFILE_PHOTO_RE.test(url.trim())) return;
  const filePath = path.join(getPublicDir(), url.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
  void deleteObjectByUrl(url);
}
