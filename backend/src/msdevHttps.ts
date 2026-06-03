import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getAppRoot } from './paths';

function getMsdevCertDir(): string {
  const packaged = path.join(getAppRoot(), 'certs');
  if (fs.existsSync(packaged)) return packaged;
  return path.resolve(__dirname, '../../msdev/certs');
}

function getLocalIpv4Addresses(): string[] {
  const ips: string[] = ['127.0.0.1'];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    if (!interfaces) continue;
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        ips.push(iface.address);
      }
    }
  }
  return [...new Set(ips)];
}

function buildSubjectAltName(ips: string[]): string {
  const parts = ['DNS:localhost', 'DNS:*.localhost'];
  for (const ip of ips) {
    parts.push(`IP:${ip}`);
  }
  return parts.join(',');
}

/** Génère ou charge un certificat auto-signé pour msdev HTTPS (caméra sur LAN). */
export function ensureMsdevHttpsCredentials(): { key: Buffer; cert: Buffer } | null {
  const dir = getMsdevCertDir();
  const keyPath = path.join(dir, 'dev-key.pem');
  const certPath = path.join(dir, 'dev-cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    fs.mkdirSync(dir, { recursive: true });
    const ips = getLocalIpv4Addresses();
    const san = buildSubjectAltName(ips);
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 825 -nodes -subj "/CN=MeloSong msdev local" -addext "subjectAltName=${san}"`,
        { stdio: 'pipe' }
      );
    } catch (err) {
      console.error('');
      console.error('  ✖ Impossible de générer le certificat HTTPS msdev (openssl requis).');
      console.error('    Installez OpenSSL ou lancez msdev/scripts/generate-dev-cert.ps1');
      console.error(String(err));
      console.error('');
      return null;
    }
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export function getMsdevHttpsUrls(port: number): string[] {
  const scheme = 'https';
  const urls = [`${scheme}://localhost:${port}`];
  for (const ip of getLocalIpv4Addresses()) {
    if (ip !== '127.0.0.1') urls.push(`${scheme}://${ip}:${port}`);
  }
  return urls;
}
