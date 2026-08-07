/**
 * Retire le badge « Danse » sur evenement-solar-festival.png (slide événements).
 */
import { renameSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharp = (await import(pathToFileURL(join(__dirname, '../../../../web/app/node_modules/sharp/lib/index.js')).href)).default;
const path = join(__dirname, '..', 'assets', 'evenement-solar-festival.png');
const tmp = `${path}.tmp`;

const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;

let r = 0;
let g = 0;
let b = 0;
let n = 0;
for (let y = 18; y < 36; y += 1) {
  for (let x = 240; x < 320; x += 1) {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
}
r = Math.round(r / n);
g = Math.round(g / n);
b = Math.round(b / n);

const svg = Buffer.from(
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="11" y="11" width="124" height="36" fill="rgb(${r},${g},${b})"/></svg>`,
);

await sharp(path).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(tmp);
try {
  unlinkSync(path);
} catch {
  /* first run */
}
renameSync(tmp, path);
console.log('Patched', path, 'fill', r, g, b);
