import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';

const SPONSOR_LOGO_DATA_RE =
  /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

/** ~500 Ko max pour un logo 80×80 (marge confortable). */
export const MAX_SPONSOR_LOGO_DATA_CHARS = 700_000;

const HTTPS_LOGO_RE = /^https:\/\//i;
const UPLOADS_LOGO_RE = /^\/uploads\/sponsors\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

export function isValidSponsorLogoUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  if (HTTPS_LOGO_RE.test(url)) return true;
  if (UPLOADS_LOGO_RE.test(url)) return true;
  if (!SPONSOR_LOGO_DATA_RE.test(url)) return false;
  return url.length <= MAX_SPONSOR_LOGO_DATA_CHARS;
}

export function assertValidSponsorLogoUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const url = String(raw).trim();
  if (!url) return undefined;
  if (!isValidSponsorLogoUrl(url)) {
    throw new Error(
      'URL de logo invalide (HTTPS, fichier uploadé ou image encodée ≤ 700 Ko requis)'
    );
  }
  return url;
}

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'sponsors');
}

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'png' || m === 'image/png') return 'png';
  if (m === 'webp' || m === 'image/webp') return 'webp';
  if (m === 'gif' || m === 'image/gif') return 'gif';
  return 'jpg';
}

/** Décode une data URL image et l'enregistre sous public/uploads/sponsors/. */
export function saveSponsorLogoFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = SPONSOR_LOGO_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Image de logo invalide');
  }
  if (trimmed.length > MAX_SPONSOR_LOGO_DATA_CHARS) {
    throw new Error('Logo trop volumineux après compression');
  }

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > SPONSOR_LOGO_MAX_FILE_BYTES) {
    throw new Error('Logo trop volumineux');
  }

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });

  const id = crypto.randomBytes(12).toString('hex');
  const ext = extForMime(mime);
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/uploads/sponsors/${filename}`;
}

export const SPONSOR_LOGO_MAX_FILE_BYTES = 2 * 1024 * 1024;
