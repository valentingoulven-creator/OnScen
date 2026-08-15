/**
 * Génère les icônes iOS / Android / PWA / favicon depuis
 * commun/brand/onscen-app-icon-source.png (visuel concert + onde).
 *
 * Recadre le carré photo (retire le fond noir et les coins arrondis pré-appliqués)
 * pour que iOS / Android appliquent leur propre masque.
 *
 * Usage (racine) : node commun/scripts/apply-app-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'commun/brand/onscen-app-icon-source.png');
const faviconSvgPath = path.join(root, 'commun/brand/onscen-favicon.svg');

async function loadSharp() {
  const require = createRequire(import.meta.url);
  const candidates = [
    path.join(root, 'ios/apptel/node_modules/sharp'),
    path.join(root, 'web/app/node_modules/sharp'),
    'sharp',
  ];
  for (const candidate of candidates) {
    try {
      if (candidate === 'sharp') {
        const mod = await import('sharp');
        return mod.default;
      }
      if (fs.existsSync(candidate)) {
        const mod = await import(pathToFileURL(require.resolve(candidate)).href);
        return mod.default;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('sharp introuvable — npm install dans ios/apptel ou web/app');
}

function isNearBlack(r, g, b, a) {
  if (a < 20) return true;
  return r < 18 && g < 18 && b < 18;
}

async function cropFullBleedSquare(sharp, srcBuf) {
  const { data, info } = await sharp(srcBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (!isNearBlack(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    return sharp(srcBuf).flatten({ background: '#000000' });
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const inset = Math.round(Math.min(bw, bh) * 0.11);
  const left = minX + inset;
  const top = minY + inset;
  const size = Math.min(bw, bh) - inset * 2;
  return sharp(srcBuf)
    .extract({ left, top, width: size, height: size })
    .flatten({ background: '#000000' });
}

async function writePng(pipeline, dest, size, { flatten = true } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let img = pipeline.clone().resize(size, size, { fit: 'cover' });
  if (flatten) img = img.flatten({ background: '#000000' }).removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(dest);
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source manquante : ${sourcePath}`);
  }
  const sharp = await loadSharp();
  const srcBuf = fs.readFileSync(sourcePath);
  const square = await cropFullBleedSquare(sharp, srcBuf);

  const webPublic = path.join(root, 'web/app/public');
  const telPublic = path.join(root, 'ios/apptel/public');
  const iosIcon = path.join(
    root,
    'ios/apptel/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  );
  const androidRes = path.join(root, 'ios/apptel/android/app/src/main/res');
  const resourcesIcon = path.join(root, 'ios/apptel/resources/icon.png');

  await writePng(square, path.join(webPublic, 'pwa-192x192.png'), 192);
  await writePng(square, path.join(webPublic, 'pwa-512x512.png'), 512);
  await writePng(square, path.join(webPublic, 'icon.png'), 512);

  await writePng(square, path.join(telPublic, 'pwa-192x192.png'), 192);
  await writePng(square, path.join(telPublic, 'pwa-512x512.png'), 512);
  await writePng(square, path.join(telPublic, 'icon.png'), 512);
  await writePng(square, path.join(telPublic, 'apple-touch-icon.png'), 180);

  const faviconSvg = fs.readFileSync(faviconSvgPath);
  const favicon = sharp(faviconSvg, { density: 384 });
  for (const destDir of [webPublic, telPublic]) {
    fs.copyFileSync(faviconSvgPath, path.join(destDir, 'favicon.svg'));
    await writePng(favicon, path.join(destDir, 'favicon-32x32.png'), 32, { flatten: false });
    await writePng(favicon, path.join(destDir, 'favicon-48x48.png'), 48, { flatten: false });
  }

  await writePng(square, iosIcon, 1024);
  await writePng(square, resourcesIcon, 1024);

  if (fs.existsSync(androidRes)) {
    const densities = [
      { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
      { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
      { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
      { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
      { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
    ];
    for (const d of densities) {
      const folder = path.join(androidRes, d.dir);
      await writePng(square, path.join(folder, 'ic_launcher.png'), d.launcher);
      await writePng(square, path.join(folder, 'ic_launcher_round.png'), d.launcher);
      await writePng(square, path.join(folder, 'ic_launcher_foreground.png'), d.foreground);
    }
    const bgXml = path.join(androidRes, 'values/ic_launcher_background.xml');
    fs.writeFileSync(
      bgXml,
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B0B0F</color>
</resources>
`,
    );
    console.log('Android mipmaps écrits (ios/apptel/android — gitignoré).');
  } else {
    console.log('Android res absent — mipmaps ignorés (seront générés après cap add android).');
  }

  console.log('Icônes OnScen générées (web, tel, iOS AppIcon, resources/icon.png).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
