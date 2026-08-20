/**
 * Génère logo UI, favicon, PWA et icônes stores depuis
 * commun/brand/onscen-app-icon-source.png (étoile + anneau dégradé).
 *
 * Usage (racine) : node commun/scripts/apply-app-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'commun/brand/onscen-app-icon-source.png');

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
  return r < 22 && g < 22 && b < 22;
}

async function makeTransparentLogo(sharp, srcBuf) {
  const { data, info } = await sharp(srcBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += info.channels) {
    if (isNearBlack(px[i], px[i + 1], px[i + 2], info.channels > 3 ? px[i + 3] : 255)) {
      px[i + 3] = 0;
    }
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 4 })
    .png({ compressionLevel: 9, adaptiveFiltering: true });
}

async function writePng(pipeline, dest, size, { flatten = true } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let img = pipeline.clone().resize(size, size, { fit: 'contain', background: flatten ? '#000000' : { r: 0, g: 0, b: 0, alpha: 0 } });
  if (flatten) img = img.flatten({ background: '#000000' }).removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(dest);
}

function pngToFaviconSvg(pngBuf) {
  const b64 = pngBuf.toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <image href="data:image/png;base64,${b64}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
}

function pngsToIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dirs = [];
  let offset = 6 + 16 * images.length;
  for (const img of images) {
    const dir = Buffer.alloc(16);
    dir[0] = img.size >= 256 ? 0 : img.size;
    dir[1] = img.size >= 256 ? 0 : img.size;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(img.buf.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += img.buf.length;
  }
  return Buffer.concat([header, ...dirs, ...images.map((img) => img.buf)]);
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source manquante : ${sourcePath}`);
  }
  const sharp = await loadSharp();
  const srcBuf = fs.readFileSync(sourcePath);

  const square = sharp(srcBuf)
    .flatten({ background: '#000000' })
    .resize(1024, 1024, { fit: 'contain', background: '#000000' });

  const uiLogo = await makeTransparentLogo(sharp, srcBuf);
  const uiPng = await uiLogo.png({ compressionLevel: 9 }).toBuffer();

  const webPublic = path.join(root, 'web/app/public');
  const telPublic = path.join(root, 'ios/apptel/public');
  const backendPublic = path.join(root, 'commun/backend/public');
  const webAssets = path.join(root, 'web/app/src/assets');
  const iosIcon = path.join(
    root,
    'ios/apptel/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  );
  const androidRes = path.join(root, 'ios/apptel/android/app/src/main/res');
  const resourcesIcon = path.join(root, 'ios/apptel/resources/icon.png');
  const brandFaviconSvg = path.join(root, 'commun/brand/onscen-favicon.svg');

  for (const dest of [
    path.join(webPublic, 'onscen-logo.png'),
    path.join(telPublic, 'onscen-logo.png'),
    path.join(backendPublic, 'onscen-logo.png'),
    path.join(webAssets, 'onscen-logo.png'),
  ]) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, uiPng);
  }

  await writePng(square, path.join(webPublic, 'pwa-192x192.png'), 192);
  await writePng(square, path.join(webPublic, 'pwa-512x512.png'), 512);
  await writePng(square, path.join(webPublic, 'icon.png'), 512);

  await writePng(square, path.join(telPublic, 'pwa-192x192.png'), 192);
  await writePng(square, path.join(telPublic, 'pwa-512x512.png'), 512);
  await writePng(square, path.join(telPublic, 'icon.png'), 512);
  await writePng(square, path.join(telPublic, 'apple-touch-icon.png'), 180);

  const faviconRaster = sharp(uiPng).extend({
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const faviconSvgPng = await sharp(uiPng)
    .resize(64, 64, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const faviconSvg = pngToFaviconSvg(faviconSvgPng);
  fs.writeFileSync(brandFaviconSvg, faviconSvg);

  const icoSizes = [16, 32, 48];
  const icoImages = [];
  for (const size of icoSizes) {
    const buf = await faviconRaster
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    icoImages.push({ size, buf });
  }
  const icoBuf = pngsToIco(icoImages);
  for (const destDir of [webPublic, telPublic, backendPublic]) {
    fs.writeFileSync(path.join(destDir, 'favicon.svg'), faviconSvg);
    fs.writeFileSync(path.join(destDir, 'favicon.ico'), icoBuf);
    await writePng(faviconRaster, path.join(destDir, 'favicon-32x32.png'), 32, { flatten: false });
    await writePng(faviconRaster, path.join(destDir, 'favicon-48x48.png'), 48, { flatten: false });
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
    <color name="ic_launcher_background">#000000</color>
</resources>
`,
    );
    console.log('Android mipmaps écrits (ios/apptel/android — gitignoré).');
  } else {
    console.log('Android res absent — mipmaps ignorés (seront générés après cap add android).');
  }

  console.log('Logo étoile OnScen généré (UI, favicon, PWA, iOS AppIcon).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
