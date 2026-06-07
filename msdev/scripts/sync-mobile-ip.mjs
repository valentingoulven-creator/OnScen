import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectBestLanIp, getLanIpv4Addresses } from './lan-ip.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const msdevDir = path.resolve(__dirname, '..');
const port = 4080;

const ip = detectBestLanIp();
if (!ip) {
  console.error('[msdev] Aucune adresse IPv4 LAN detectee. Verifiez Wi-Fi / Ethernet.');
  process.exit(1);
}

const allIps = getLanIpv4Addresses();
const base = `http://${ip}:${port}`;

function updateEnvFile(envPath) {
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    : fs.readFileSync(path.join(msdevDir, '.env.example'), 'utf8').split(/\r?\n/);

  const set = (key, value) => {
    const idx = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  };

  set('MOBILE_HOST_IP', ip);
  set('MOBILE_WEB_URL', base);
  set('MOBILE_API_URL', `${base}/api`);
  set('MOBILE_SOCKET_URL', base);

  fs.writeFileSync(envPath, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}

function updateConfigJson(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.mobile = {
    hostIp: ip,
    webUrl: base,
    apiBaseUrl: `${base}/api`,
    socketUrl: base,
  };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function updateMobileUrlTxt(txtPath) {
  const body = `MeloSong — URL a ouvrir SUR LE TELEPHONE (navigateur)
(IP du PC sur le reseau local — pas l'IP du telephone)

${base}

Si ca ne charge pas: npm run msdev:diagnose puis npm run msdev:fix-network (admin)
Si l'IP du PC a change: npm run msdev:sync-ip

Compte demo: listener@msdev.local / msdev123
`;
  fs.writeFileSync(txtPath, body, 'utf8');
}

const envPath = path.join(msdevDir, '.env');
const configPath = path.join(msdevDir, 'config.json');
const mobileUrlPath = path.join(msdevDir, 'MOBILE-URL.txt');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(path.join(msdevDir, '.env.example'), envPath);
}

updateEnvFile(envPath);
updateConfigJson(configPath);
updateMobileUrlTxt(mobileUrlPath);

console.log('');
console.log('MeloSong — IP mobile synchronisee');
console.log('');
console.log(`  ${base}`);
console.log('');
console.log(`  IP choisie: ${ip}`);
if (allIps.length > 1) {
  console.log(`  Autres interfaces: ${allIps.filter((candidate) => candidate !== ip).join(', ')}`);
}
console.log('');
console.log('  Ouvrez cette URL sur le telephone (meme Wi-Fi que le PC).');
console.log('');
