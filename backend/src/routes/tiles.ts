import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { getAppRoot } from '../paths';

export const tilesRouter = express.Router();

const CACHE_DIR = path.join(getAppRoot(), 'tile-cache');
const CARTO_SUBDOMAINS = ['a', 'b', 'c'] as const;
let _subdIdx = 0;

function nextSubdomain(): string {
  const s = CARTO_SUBDOMAINS[_subdIdx % CARTO_SUBDOMAINS.length];
  _subdIdx = (_subdIdx + 1) % CARTO_SUBDOMAINS.length;
  return s;
}

function fetchFromCarto(z: string, x: string, y: string, r: string): Promise<Buffer> {
  const sub = nextSubdomain();
  const url = `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}${r}.png`;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 MeloSong-TileProxy/2.0',
          Referer: 'https://getsoundy.com/',
          Accept: 'image/png,image/*;q=0.8',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`CARTO ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    request.setTimeout(8000, () => {
      request.destroy(new Error(`CARTO timeout for tile ${z}/${x}/${y}${r}`));
    });
    request.on('error', reject);
  });
}

tilesRouter.get('/:z/:x/:filename', (req, res) => {
  void (async () => {
    const { z, x, filename } = req.params as { z: string; x: string; filename: string };

    if (!/^\d+$/.test(z) || !/^\d+$/.test(x)) {
      res.status(400).type('text/plain').send('Invalid tile coordinates');
      return;
    }
    const yMatch = /^(\d+)(@2x)?\.png$/.exec(filename);
    if (!yMatch) {
      res.status(400).type('text/plain').send('Invalid tile filename');
      return;
    }
    const y = yMatch[1];
    const r = yMatch[2] ?? '';

    const cacheFile = path.join(CACHE_DIR, z, x, filename);

    if (fs.existsSync(cacheFile)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('X-Tile-Cache', 'HIT');
      res.sendFile(cacheFile);
      return;
    }

    try {
      const buf = await fetchFromCarto(z, x, y, r);

      try {
        fs.mkdirSync(path.join(CACHE_DIR, z, x), { recursive: true });
        fs.writeFileSync(cacheFile, buf);
      } catch (cacheErr) {
        console.warn('[tile-proxy] cache write failed:', cacheErr);
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('X-Tile-Cache', 'MISS');
      res.send(buf);
    } catch (err) {
      console.warn('[tile-proxy] upstream error:', err instanceof Error ? err.message : String(err));
      res.status(502).type('text/plain').send('Tile temporarily unavailable');
    }
  })();
});
