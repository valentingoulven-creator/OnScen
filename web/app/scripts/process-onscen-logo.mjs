import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const defaultSrc = path.join(root, '../../commun/brand/onscen-app-icon-source.png');

const src = process.argv[2] ? path.resolve(process.argv[2]) : defaultSrc;

const targets = [
  path.join(root, 'public/onscen-logo.png'),
  path.join(root, '../../commun/backend/public/onscen-logo.png'),
];

function isBackgroundPixel(r, g, b) {
  if (r < 22 && g < 22 && b < 22) return { remove: true, alpha: 0 };
  return null;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = Buffer.from(data);

for (let i = 0; i < px.length; i += 4) {
  const r = px[i];
  const g = px[i + 1];
  const b = px[i + 2];
  const bg = isBackgroundPixel(r, g, b);
  if (!bg) continue;
  if (bg.remove) px[i + 3] = 0;
  else px[i + 3] = Math.min(px[i + 3], bg.alpha);
}

const trimmed = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 1 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

const meta = await sharp(trimmed).metadata();

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, trimmed);
  console.log('written', target, trimmed.length, 'bytes', `${meta.width}x${meta.height}`);
}
