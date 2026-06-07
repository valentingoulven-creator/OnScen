import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msdevDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(msdevDir, '..');
const port = 5173;
const urlFile = path.join(msdevDir, 'PUBLIC-DEMO-URL.txt');

function checkPort() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startDemoServer() {
  return spawn('npm', ['run', 'demo', '--prefix', 'app'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });
}

function extractTunnelUrl(text) {
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match?.[0] ?? null;
}

async function main() {
  console.log('\nMeloSong — démo publique (sans réseau local)\n');

  const up = await checkPort();
  if (!up) {
    console.log(`Démarrage de la démo hors-ligne sur le port ${port}...`);
    startDemoServer();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkPort()) break;
    }
    if (!(await checkPort())) {
      console.error('Impossible de démarrer npm run app:demo');
      process.exit(1);
    }
  } else {
    console.log(`Démo déjà active sur http://localhost:${port}`);
  }

  console.log('Ouverture du tunnel public (Cloudflare)...');
  const tunnel = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${port}`], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let publicUrl = null;
  const onData = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const found = extractTunnelUrl(text);
    if (found && !publicUrl) {
      publicUrl = found;
      const body = `MeloSong — démo publique (accessible depuis n'importe quel réseau)

${publicUrl}

Mode: démo hors-ligne (pas de serveur backend requis)
Connexion automatique — badge DEMO dans l'app

Relancer: npm run app:demo:public
`;
      fs.writeFileSync(urlFile, body, 'utf8');
      console.log('\n════════════════════════════════════════');
      console.log('  Ouvrez sur votre téléphone (Safari) :');
      console.log(`  ${publicUrl}`);
      console.log('════════════════════════════════════════\n');
    }
  };

  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.on('exit', (code) => {
    if (code !== 0 && !publicUrl) {
      console.error(`Tunnel terminé (code ${code})`);
      process.exit(code ?? 1);
    }
  });

  process.on('SIGINT', () => {
    tunnel.kill('SIGTERM');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
