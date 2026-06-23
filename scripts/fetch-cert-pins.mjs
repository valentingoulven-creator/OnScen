#!/usr/bin/env node
/**
 * Extrait les pins SPKI SHA-256 pour getsoundy.com (SSL pinning Android).
 * Usage : node scripts/fetch-cert-pins.mjs [--write]
 */
import tls from 'node:tls';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'getsoundy.com';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmlPath = path.join(root, 'apptel/android/app/src/main/res/xml/network_security_config.xml');

function fetchCert(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, host, { servername: host, rejectUnauthorized: true }, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        socket.end();
        resolve(cert);
      } catch (e) {
        socket.destroy();
        reject(e);
      }
    });
    socket.on('error', reject);
    socket.setTimeout(15000, () => {
      socket.destroy(new Error('timeout'));
    });
  });
}

function spkiPinFromCert(cert) {
  const x509 = new crypto.X509Certificate(cert.raw);
  const spki = x509.publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(spki).digest('base64');
}

function expirationFromCert(cert) {
  const d = new Date(cert.valid_to);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const cert = await fetchCert(HOST);
  const pin = spkiPinFromCert(cert);
  const expiration = expirationFromCert(cert);

  console.log(`Host: ${HOST}`);
  console.log(`SPKI SHA-256 pin: ${pin}`);
  console.log(`Cert expires: ${cert.valid_to}`);
  console.log(`Suggested pin-set expiration: ${expiration}`);

  if (!process.argv.includes('--write')) return;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par scripts/fetch-cert-pins.mjs — Cloudflare : renouveler avant expiration -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">${HOST}</domain>
        <pin-set expiration="${expiration}">
            <pin digest="SHA-256">${pin}</pin>
        </pin-set>
    </domain-config>
</network-security-config>
`;
  fs.writeFileSync(xmlPath, xml, 'utf8');
  console.log(`Written: ${xmlPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
