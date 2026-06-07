import { spawn } from 'child_process';
import path from 'path';
import {
  checkHttpPort,
  msdevDir,
  rootDir,
  startPublicTunnel,
  waitForPort,
} from './start-public-tunnel.mjs';

const port = 5173;
const urlFile = path.join(msdevDir, 'PUBLIC-DEMO-URL.txt');

function startDemoServer() {
  return spawn('npm', ['run', 'demo', '--prefix', 'app'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });
}

async function main() {
  console.log('\nMeloSong — démo hors-ligne légère (sans serveur)\n');
  console.log('Pour l’app complète: npm run msdev:public\n');

  const up = await checkHttpPort(port);
  if (!up) {
    console.log(`Démarrage de la démo hors-ligne sur le port ${port}...`);
    startDemoServer();
    if (!(await waitForPort(port))) {
      console.error('Impossible de démarrer npm run app:demo');
      process.exit(1);
    }
  } else {
    console.log(`Démo déjà active sur http://localhost:${port}`);
  }

  startPublicTunnel({
    port,
    urlFile,
    label: 'démo hors-ligne (version allégée)',
    hint: `Mode: mock local — badge DEMO
Pour la vraie app: npm run msdev:public`,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
