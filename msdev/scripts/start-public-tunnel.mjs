import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msdevDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(msdevDir, '..');

export function checkHttpPort(port, path = '/') {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function extractTunnelUrl(text) {
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match?.[0] ?? null;
}

export function startPublicTunnel({ port, urlFile, label, hint }) {
  console.log(`\nOuverture du tunnel public pour ${label} (port ${port})...`);

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
      const body = `MeloSong — ${label}

${publicUrl}

${hint}

Relancer: voir package.json (msdev:public ou app:demo:public)
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

export async function waitForPort(port, path = '/', attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    if (await checkHttpPort(port, path)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export { rootDir, msdevDir };
