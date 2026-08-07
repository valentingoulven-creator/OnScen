/**
 * Recadrage 9:16 du screenshot Reels (zone vidéo, sans barres haut/bas).
 */
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharp = (await import(pathToFileURL(join(__dirname, '../../../../web/app/node_modules/sharp/lib/index.js')).href)).default;

const src = join(__dirname, '../../presentation-screenshots/mobile/12-reels.png');
const out = join(__dirname, '../assets/reels-retrowave-hero.png');

const meta = await sharp(src).metadata();
const w = meta.width;
const h = meta.height;

const top = Math.round(h * 0.1);
const bottom = Math.round(h * 0.11);
const contentH = h - top - bottom;
const cropW = Math.round((contentH * 9) / 16);
const left = Math.max(0, Math.round((w - cropW) / 2));

await sharp(src)
  .extract({ left, top, width: Math.min(cropW, w - left), height: contentH })
  .png()
  .toFile(out);

console.log('Cropped', out, { left, top, width: cropW, height: contentH, from: `${w}x${h}` });
