import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import { validateImageMagicBytes, extForImageMime } from './imageValidation';

const ALBUM_COVER_DATA_RE =
  /^data:image\/(jpeg|png|webp|gif)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/i;

export const MAX_ALBUM_COVER_DATA_CHARS = 2_100_000;
export const ALBUM_COVER_MAX_FILE_BYTES = 3 * 1024 * 1024;

const UPLOADS_COVER_RE =
  /^\/uploads\/albums\/covers\/[a-zA-Z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

export function isValidAlbumCoverUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return false;
  if (UPLOADS_COVER_RE.test(url)) return true;
  if (!ALBUM_COVER_DATA_RE.test(url)) return false;
  return url.length <= MAX_ALBUM_COVER_DATA_CHARS;
}

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'albums', 'covers');
}

export function saveAlbumCoverFromDataUrl(dataUrl: string): string {
  const trimmed = String(dataUrl).trim();
  const match = ALBUM_COVER_DATA_RE.exec(trimmed);
  if (!match) {
    throw new Error('Image de couverture invalide (jpeg, png, webp, gif — max 3 Mo)');
  }
  if (trimmed.length > MAX_ALBUM_COVER_DATA_CHARS) {
    throw new Error('Image de couverture trop volumineuse');
  }

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > ALBUM_COVER_MAX_FILE_BYTES) {
    throw new Error('Image de couverture trop volumineuse (max 3 Mo)');
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

  return `/uploads/albums/covers/${filename}`;
}

export function resolveAlbumCoverUrl(raw: string): string {
  const url = raw.trim();
  if (UPLOADS_COVER_RE.test(url)) return url;
  if (ALBUM_COVER_DATA_RE.test(url)) {
    return saveAlbumCoverFromDataUrl(url);
  }
  throw new Error('URL de couverture invalide');
}

export function deleteAlbumCoverIfLocal(coverUrl: string): void {
  const url = coverUrl.trim();
  if (!UPLOADS_COVER_RE.test(url)) return;
  const filePath = path.join(getPublicDir(), url.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup
  }
}
