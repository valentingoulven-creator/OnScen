import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';

const UPLOADS_PATH_RE = /^\/uploads\/(compositions|reels)\/[^/]+$/i;

/** Lit le début d'un fichier upload local (composition ou reel vidéo) pour scan ACRCloud. */
export function readPublicUploadSample(webPath: string, maxBytes: number): Buffer | null {
  const normalized = webPath.trim();
  if (!UPLOADS_PATH_RE.test(normalized)) return null;

  const filePath = path.join(getPublicDir(), normalized.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) return null;

  const size = fs.statSync(filePath).size;
  const toRead = Math.min(size, maxBytes);
  if (toRead < 100) return null;

  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(toRead);
    fs.readSync(fd, buf, 0, toRead, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}
