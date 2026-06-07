import http from 'http';
import { detectBestLanIp, getLanIpv4Addresses } from './lan-ip.mjs';

const port = Number(process.env.PORT) || 4080;
const host = process.env.HOST || '0.0.0.0';

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 4000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function isListening() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, host);
  });
}

const lanIp = detectBestLanIp();
const mobileUrl = lanIp ? `http://${lanIp}:${port}` : null;

console.log('\n=== Vérification accès smartphone → MeloSong ===\n');

const serverUp = !(await isListening());
if (serverUp) {
  console.log(`[OK] Serveur actif sur ${host}:${port}`);
} else {
  console.log(`[!!] Aucun serveur sur le port ${port}. Lancez: npm run msdev`);
  process.exit(1);
}

for (const [label, url] of [
  ['PC (localhost)', `http://127.0.0.1:${port}/health`],
  ['LAN (téléphone)', mobileUrl ? `${mobileUrl}/health` : null],
  ['API réseau', `http://127.0.0.1:${port}/api/network/info`],
]) {
  if (!url) {
    console.log('[!!] Aucune IP LAN détectée');
    continue;
  }
  try {
    const res = await request(url);
    const ok = res.status >= 200 && res.status < 300;
    console.log(`${ok ? '[OK]' : '[!!]'} ${label}: HTTP ${res.status}`);
    if (label === 'API réseau' && ok) {
      const info = JSON.parse(res.body);
      console.log(`     URL smartphone: ${info.smartphonePrimary}`);
      if (info.configuredIpStale) {
        console.log('     [!] IP configurée obsolète → npm run msdev:sync-ip');
      }
    }
  } catch (err) {
    console.log(`[!!] ${label}: ${err.message}`);
  }
}

console.log('\n--- Téléphone ---');
if (mobileUrl) {
  console.log(`Ouvrez dans Safari (même Wi‑Fi que le PC):`);
  console.log(`  ${mobileUrl}`);
  console.log('\nPrérequis:');
  console.log('  • PC et téléphone sur le même réseau local');
  console.log('  • Pas de réseau invité / isolation Wi‑Fi sur le routeur');
  console.log('  • Pare-feu Windows: npm run msdev:fix-network (admin)');
} else {
  console.log('Impossible de déterminer une IP LAN.');
}

const allIps = getLanIpv4Addresses();
if (allIps.length) {
  console.log(`\nInterfaces détectées: ${allIps.join(', ')}`);
}
console.log('');
