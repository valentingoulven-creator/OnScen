/**

 * Builds msdev.exe and assembles the release folder for Windows.

 */

const { execSync } = require('child_process');

const fs = require('fs');

const path = require('path');



const root = path.resolve(__dirname, '../..');

const backend = path.join(root, 'backend');

const msdevDir = path.join(root, 'msdev');

const releaseDir = path.join(msdevDir, 'release');



function copyRecursive(src, dest) {

  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {

    const srcPath = path.join(src, entry.name);

    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {

      copyRecursive(srcPath, destPath);

    } else {

      fs.copyFileSync(srcPath, destPath);

    }

  }

}



function readAppVersion() {

  try {

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

    return pkg.version || '2.0.0';

  } catch {

    return '2.0.0';

  }

}



function patchExeMetadata(exePath, version) {

  if (process.platform !== 'win32' || !fs.existsSync(exePath)) return;

  try {

    execSync(

      `node "${path.join(__dirname, 'patch-exe-metadata.cjs')}" "${exePath}" "${version}"`,

      { stdio: 'inherit', cwd: backend }

    );

  } catch (err) {

    console.warn('Métadonnées Windows (resedit) ignorées:', err.message);

  }

}



function unblockReleaseFolder(dir) {

  if (process.platform !== 'win32') return;

  const escaped = dir.replace(/'/g, "''");

  try {

    execSync(

      `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '${escaped}' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue"`,

      { stdio: 'inherit' }

    );

    console.log('Unblock-File appliqué sur', dir);

  } catch (err) {

    console.warn('Unblock-File ignoré:', err.message);

  }

}



console.log('Building msdev.exe for Windows...\n');



fs.mkdirSync(releaseDir, { recursive: true });



const exePath = path.join(releaseDir, 'msdev.exe');

const appVersion = readAppVersion();



// Bundle with @yao-pkg/pkg (maintained fork of vercel/pkg)

try {

  execSync(

    `npx --yes @yao-pkg/pkg@6.6.0 "${path.join(backend, 'dist', 'entry-msdev.js')}" --targets node18-win-x64 --output "${exePath}" --config "${path.join(backend, 'package.json')}"`,

    { stdio: 'inherit', cwd: backend }

  );

} catch (err) {

  console.error('\npkg build failed. Trying legacy pkg...');

  execSync(

    `npx --yes pkg@5.8.1 "${path.join(backend, 'dist', 'entry-msdev.js')}" --targets node18-win-x64 --output "${exePath}"`,

    { stdio: 'inherit', cwd: backend }

  );

}



patchExeMetadata(exePath, appVersion);

unblockReleaseFolder(releaseDir);



// Ship public assets and config next to the exe (required for express.static)

copyRecursive(path.join(backend, 'public'), path.join(releaseDir, 'public'));



const envSrc = path.join(msdevDir, '.env');

const envExample = path.join(msdevDir, '.env.example');

if (fs.existsSync(envSrc)) {

  fs.copyFileSync(envSrc, path.join(releaseDir, '.env'));

} else if (fs.existsSync(envExample)) {

  console.warn('commun/msdev/.env absent — copie de .env.example vers release/.env');

  fs.copyFileSync(envExample, path.join(releaseDir, '.env'));

} else {

  throw new Error('commun/msdev/.env ou commun/msdev/.env.example requis pour le build exe');

}



const configSrc = path.join(msdevDir, 'config.json');

if (fs.existsSync(configSrc)) {

  fs.copyFileSync(configSrc, path.join(releaseDir, 'config.json'));

}



// Données persistantes msdev (store.json uniquement — évite copies iCloud / sauvegardes)

const dataSrc = path.join(msdevDir, 'data');

const dataDest = path.join(releaseDir, 'data');

fs.mkdirSync(dataDest, { recursive: true });

const storeJson = path.join(dataSrc, 'store.json');

if (fs.existsSync(storeJson)) {

  try {

    fs.copyFileSync(storeJson, path.join(dataDest, 'store.json'));

  } catch (err) {

    console.warn('Copie store.json ignorée:', err.message);

  }

}



const readme = `MeloSong — msdev (Windows)

========================



Lancement recommandé : Lancer-msdev.ps1 ou Lancer-msdev.bat

(Double-clic msdev.exe possible ; voir DEBLOCAGE-WINDOWS.txt si Windows bloque.)



- Web app : http://localhost:4080

- Page smartphone (QR) : http://localhost:4080/msdev-mobile

- Compte démo : listener@msdev.local / msdev123



Gardez ce dossier intact : msdev.exe, public/, .env, config.json, data/



Sans exe (Node.js installé) : msdev\\Lancer-msdev-node.bat à la racine du projet source.

Voir : DEBLOCAGE-WINDOWS.txt, commun/msdev/BUILD-EXE.txt, commun/msdev/MOBILE-PWA.txt

`;



fs.writeFileSync(path.join(releaseDir, 'LISEZMOI.txt'), readme, 'utf8');



for (const doc of ['BUILD-EXE.txt', 'MOBILE-PWA.txt', 'DEBLOCAGE-WINDOWS.txt']) {

  const src = path.join(msdevDir, doc);

  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(releaseDir, doc));

}



const launcherBat = `@echo off

title MeloSong msdev

cd /d "%~dp0"

REM Retire Zone.Identifier (fichier marque comme telecharge)

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '.' -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

if not exist msdev.exe (

  echo msdev.exe introuvable. Relancez npm run build:exe depuis le projet.

  pause

  exit /b 1

)

start "MeloSong msdev" /MAX msdev.exe

`;

fs.writeFileSync(path.join(releaseDir, 'Lancer-msdev.bat'), launcherBat, 'utf8');



const launcherPs1 = path.join(msdevDir, 'Lancer-msdev.ps1');

if (fs.existsSync(launcherPs1)) {

  fs.copyFileSync(launcherPs1, path.join(releaseDir, 'Lancer-msdev.ps1'));

}



fs.writeFileSync(
  path.join(releaseDir, 'Lancer-msdev-node-INFO.txt'),
  `Pour lancer MeloSong SANS msdev.exe (contourne Smart App Control) :

1. Installez Node.js 18+ : https://nodejs.org
2. Ouvrez le dossier source MeloSong Dev (pas seulement release/)
3. Double-cliquez : msdev\\Lancer-msdev-node.bat

Ou en ligne de commande à la racine du projet :
   npm run msdev:server

Puis ouvrez http://localhost:4080
`,
  'utf8'
);



console.log('\n✓ Release ready:');

console.log(`  ${exePath}`);

console.log('  Lancer-msdev.ps1 / Lancer-msdev.bat / DEBLOCAGE-WINDOWS.txt');

if (process.platform === 'win32') {

  console.log('\nNote : Smart App Control peut bloquer l’exe non signé ; voir DEBLOCAGE-WINDOWS.txt');

  console.log('       Contournement dev : msdev\\Lancer-msdev-node.bat\n');

} else {

  console.log('\n');

}


