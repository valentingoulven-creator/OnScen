import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import { validateImageMagicBytes, extForImageMime } from './imageValidation';

const SPONSOR_BANNER_DATA_RE =
  /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

/** ~1,5 Mo max pour un bandeau 1280×192 (marge confortable). */
export const MAX_SPONSOR_BANNER_DATA_CHARS = 2_100_000;

const HTTPS_BANNER_RE = /^https:\/\//i;
const UPLOADS_BANNER_RE =
  /^\/uploads\/sponsors\/banners\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

export function isValidSponsorBannerUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  if (HTTPS_BANNER_RE.test(url)) return true;
  if (UPLOADS_BANNER_RE.test(url)) return true;
  if (!SPONSOR_BANNER_DATA_RE.test(url)) return false;
  return url.length <= MAX_SPONSOR_BANNER_DATA_CHARS;
}

export function assertValidSponsorBannerUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const url = String(raw).trim();
  if (!url) return undefined;
  if (!isValidSponsorBannerUrl(url)) {
    throw new Error(
      'URL de bandeau invalide (HTTPS, fichier uploadé ou image encodée ≤ 2 Mo requis)'
    );
  }
  return url;
}

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'sponsors', 'banners');
}

/** Décode une data URL image et l'enregistre sous public/uploads/sponsors/banners/. */
export function saveSponsorBannerFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = SPONSOR_BANNER_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Image de bandeau invalide');
  }
  if (trimmed.length > MAX_SPONSOR_BANNER_DATA_CHARS) {
    throw new Error('Bandeau trop volumineux après compression');
  }

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > SPONSOR_BANNER_MAX_FILE_BYTES) {
    throw new Error('Bandeau trop volumineux');
  }

  if (!validateImageMagicBytes(buffer, mime)) {
    throw new Error('Format d\'image non reconnu ou corrompu');
  }

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });

  const id = crypto.randomBytes(12).toString('hex');
  const ext = extForImageMime(mime);
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/uploads/sponsors/banners/${filename}`;
}

export const SPONSOR_BANNER_MAX_FILE_BYTES = 3 * 1024 * 1024;
