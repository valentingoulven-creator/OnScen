import fs from 'fs';
import path from 'path';
import { getAppRoot } from '../paths';

const CACHE_DIR = path.join(getAppRoot(), 'tile-cache');
const DEFAULT_MAX_MB = 500;
const EVICTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface FileEntry {
  file: string;
  size: number;
  mtime: number;
}

function collectFiles(dir: string): FileEntry[] {
  const result: FileEntry[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(full));
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(full);
        result.push({ file: full, size: stat.size, mtime: stat.mtimeMs });
      } catch {
        // stat failed (race condition) — skip
      }
    }
  }
  return result;
}

/**
 * Deletes the oldest cached tiles until total cache size is below `maxSizeMb`.
 * Safe to call concurrently — deletion errors are silently ignored.
 */
export function evictTileCache(maxSizeMb: number = DEFAULT_MAX_MB): void {
  const maxBytes = maxSizeMb * 1024 * 1024;
  const files = collectFiles(CACHE_DIR);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes <= maxBytes) return;

  console.log(
    `[tile-cache] size ${(totalBytes / 1024 / 1024).toFixed(1)} MB exceeds limit ${maxSizeMb} MB — evicting oldest tiles`
  );

  files.sort((a, b) => a.mtime - b.mtime);

  let remaining = totalBytes;
  let deleted = 0;
  for (const { file, size } of files) {
    if (remaining <= maxBytes) break;
    try {
      fs.unlinkSync(file);
      remaining -= size;
      deleted++;
    } catch {
      // race condition or permission error — skip
    }
  }

  console.log(
    `[tile-cache] evicted ${deleted} tile(s) — estimated size now ~${(remaining / 1024 / 1024).toFixed(1)} MB`
  );
}

/**
 * Runs evictTileCache once on startup and every 24 h thereafter.
 * The interval timer is unref'd so it never prevents clean process exit.
 * Max size is read from TILE_CACHE_MAX_MB env var (default 500 MB).
 */
export function startTileCacheEviction(): void {
  const maxMb = Number(process.env.TILE_CACHE_MAX_MB) || DEFAULT_MAX_MB;

  try {
    evictTileCache(maxMb);
  } catch (err) {
    console.warn('[tile-cache] startup eviction error:', err);
  }

  const timer = setInterval(() => {
    try {
      evictTileCache(maxMb);
    } catch (err) {
      console.warn('[tile-cache] periodic eviction error:', err);
    }
  }, EVICTION_INTERVAL_MS);
  timer.unref();
}
