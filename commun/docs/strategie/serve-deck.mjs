/**
 * Serveur statique minimal pour la présentation produit (globe WebGL + textures).
 * Racine : commun/ — URLs relatives ../../backend/public/globe/… restent valides.
 *
 * Usage: node serve-deck.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COMMUN_ROOT = path.resolve(__dirname, '../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export function createStaticServer(rootDir = COMMUN_ROOT) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') {
        rel = '/docs/strategie/ONSCEN-PRESENTATION-PRODUIT.html';
      }
      const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(rootDir, safe.replace(/^\//, ''));
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(500);
      res.end('Error');
    }
  });
  return server;
}

export function startStaticServer(port = 0, rootDir = COMMUN_ROOT) {
  const server = createStaticServer(rootDir);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const p = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, port: p, baseUrl: `http://127.0.0.1:${p}` });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2]) || 8765;
  const { baseUrl } = await startStaticServer(port);
  const deckUrl = `${baseUrl}/docs/strategie/ONSCEN-PRESENTATION-PRODUIT.html`;
  console.log('Présentation produit:', deckUrl);
  console.log('Ctrl+C pour arrêter.');
}
