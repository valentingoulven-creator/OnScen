/**
 * Recadre les captures 1920×1080 (UI mobile à gauche) en PNG 390×844 pour la présentation.
 * Détecte la fin de la bande UI (avant la marge noire droite).
 * Usage : node commun/docs/crop-presentation-screenshots.mjs
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '../../web/app/node_modules/sharp/lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'presentation-screenshots');
const outDir = path.join(srcDir, 'mobile');

const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const MIN_CROP_WIDTH = 380;
const MAX_CROP_WIDTH = 860;

await mkdir(outDir, { recursive: true });

function columnDensity(data, fullWidth, height, x, channels) {
  let bright = 0;
  const step = 3;
  for (let y = 0; y < height; y += step) {
    const i = (y * fullWidth + x) * channels;
    if (data[i] + data[i + 1] + data[i + 2] > 40) bright += 1;
  }
  return bright / Math.ceil(height / step);
}

async function detectContentWidth(inputPath, fullWidth, fullHeight) {
  const sampleTop = Math.floor(fullHeight * 0.08);
  const sampleHeight = Math.floor(fullHeight * 0.84);
  const { data, info } = await sharp(inputPath)
    .extract({ left: 0, top: sampleTop, width: fullWidth, height: sampleHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let lastContentX = MIN_CROP_WIDTH;
  let blackRun = 0;

  for (let x = 0; x < fullWidth; x += 1) {
    const density = columnDensity(data, fullWidth, info.height, x, channels);
    if (density > 0.025) {
      lastContentX = x;
      blackRun = 0;
    } else {
      blackRun += 1;
      if (blackRun >= 48 && lastContentX >= MIN_CROP_WIDTH) break;
    }
  }

  return Math.min(MAX_CROP_WIDTH, Math.max(MIN_CROP_WIDTH, lastContentX + 12));
}

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.png'));

for (const file of files) {
  const input = path.join(srcDir, file);
  const output = path.join(outDir, file);
  const meta = await sharp(input).metadata();
  const fullWidth = meta.width ?? 1920;
  const fullHeight = meta.height ?? 1080;
  const cropWidth = await detectContentWidth(input, fullWidth, fullHeight);

  await sharp(input)
    .extract({ left: 0, top: 0, width: cropWidth, height: fullHeight })
    .resize(MOBILE_WIDTH, MOBILE_HEIGHT, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log(`✓ ${file} (crop ${cropWidth}px) → mobile/${file}`);
}

console.log(`Done — ${files.length} fichiers dans ${outDir}`);
