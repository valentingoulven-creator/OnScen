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

console.log('Building msdev.exe for Windows...\n');

fs.mkdirSync(releaseDir, { recursive: true });

// Bundle with @yao-pkg/pkg (maintained fork of vercel/pkg)
try {
  execSync(
    `npx --yes @yao-pkg/pkg@6.6.0 "${path.join(backend, 'dist', 'entry-msdev.js')}" --targets node18-win-x64 --output "${path.join(releaseDir, 'msdev.exe')}" --config "${path.join(backend, 'package.json')}"`,
    { stdio: 'inherit', cwd: backend }
  );
} catch (err) {
  console.error('\npkg build failed. Trying legacy pkg...');
  execSync(
    `npx --yes pkg@5.8.1 "${path.join(backend, 'dist', 'entry-msdev.js')}" --targets node18-win-x64 --output "${path.join(releaseDir, 'msdev.exe')}"`,
    { stdio: 'inherit', cwd: backend }
  );
}

// Ship public assets and config next to the exe (required for express.static)
copyRecursive(path.join(backend, 'public'), path.join(releaseDir, 'public'));
fs.copyFileSync(path.join(msdevDir, '.env'), path.join(releaseDir, '.env'));
fs.copyFileSync(path.join(msdevDir, 'config.json'), path.join(releaseDir, 'config.json'));

const readme = `MeloSong — msdev (Windows)
========================

Double-cliquez sur msdev.exe pour lancer l'application.

- Web app : http://localhost:4080
- Compte démo : listener@msdev.local / msdev123

Gardez ce dossier intact (msdev.exe + public + .env + config.json).
`;

fs.writeFileSync(path.join(releaseDir, 'LISEZMOI.txt'), readme, 'utf8');

const launcherBat = `@echo off
title MeloSong msdev
cd /d "%~dp0"
start "MeloSong msdev" /MAX msdev.exe
`;
fs.writeFileSync(path.join(releaseDir, 'Lancer-msdev.bat'), launcherBat, 'utf8');

console.log('\n✓ Release ready:');
console.log(`  ${path.join(releaseDir, 'msdev.exe')}`);
console.log('\nDouble-cliquez sur msdev.exe pour démarrer MeloSong.\n');
