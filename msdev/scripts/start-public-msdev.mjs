import { spawn } from 'child_process';
import path from 'path';
import {
  checkHttpPort,
  msdevDir,
  rootDir,
  startPublicTunnel,
  waitForPort,
} from './start-public-tunnel.mjs';

const port = 4080;
const urlFile = path.join(msdevDir, 'PUBLIC-APP-URL.txt');

async function ensureLatestBuild() {
  console.log('Build de la dernière version (frontend)...');
  await new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'app:build'], { cwd: rootDir, stdio: 'inherit', shell: true });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exit ${code}`))));
  });
}

async function ensureMsdevServer() {
  if (await checkHttpPort(port, '/health')) {
    console.log(`MeloSong msdev déjà actif sur http://localhost:${port}`);
    return;
  }

  console.log(`Démarrage MeloSong msdev (app complète) sur le port ${port}...`);
  spawn('npm', ['run', 'msdev:server'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });

  const up = await waitForPort(port, '/health');
  if (!up) {
    console.error('Impossible de démarrer npm run msdev:server');
    process.exit(1);
  }
}

async function main() {
  console.log('\nMeloSong — app complète en accès public (dernière version)\n');

  await ensureLatestBuild();
  await ensureMsdevServer();

  startPublicTunnel({
    port,
    urlFile,
    label: 'app complète (msdev)',
    hint: `Compte démo: listener@msdev.local / msdev123
Badge: msdev (pas DEMO) — chat temps réel, serveur inclus`,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
