/**
 * Regenerates PNG PWA icons from public/icon.svg (requires sharp).
 * Usage: node commun/scripts/generate-pwa-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');

async function main() {
  const { default: sharp } = await import('sharp');
  const svg = fs.readFileSync(svgPath);
  await sharp(svg).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(svg).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('PWA icons written: apple-touch-icon.png, pwa-192x192.png, pwa-512x512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
