#!/usr/bin/env node
/**
 * Extrait les pins SPKI SHA-256 pour onscen.com + getsoundy.com (SSL pinning Android).
 *
 * Domaine canonique `onscen.com` (2026-08-10, cf. commun/docs/ONSCEN-DOMAINE.md) et legacy
 * `getsoundy.com` dual-hostés sur des certificats Caddy/Let's Encrypt DISTINCTS (CN et
 * empreintes différentes, vérifié — pas un SAN partagé) : les deux domaines nécessitent
 * chacun leur propre <domain-config> avec pin-set, sinon `onscen.com` (utilisé par
 * capacitor.config.prod.json + VITE_API_URL mobile) retombe sur le <base-config> sans
 * pinning.
 *
 * Pin le certificat feuille (leaf, rotation ~90j) ET le certificat intermédiaire (issuer,
 * rotation beaucoup plus rare) comme pin de secours par domaine — recommandation OWASP
 * « au moins 2 pins » pour éviter de « bricker » l'app au prochain renouvellement TLS si
 * un seul pin (le leaf) est utilisé.
 *
 * Usage : node commun/scripts/fetch-cert-pins.mjs [--write]
 */
import tls from 'node:tls';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTS = ['onscen.com', 'getsoundy.com'];
// commun/scripts/ -> racine repo = deux niveaux au-dessus (restructuration monorepo du 09/07/2026 ;
// l'ancien chemin à un seul niveau pointait vers commun/ios/... et n'écrivait jamais le bon fichier).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const xmlPath = path.join(root, 'ios/apptel/android/app/src/main/res/xml/network_security_config.xml');

function fetchChain(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, host, { servername: host, rejectUnauthorized: true }, () => {
      try {
        const leaf = socket.getPeerCertificate(true);
        socket.end();
        const chain = [];
        let current = leaf;
        const seen = new Set();
        while (current && !seen.has(current.fingerprint)) {
          chain.push(current);
          seen.add(current.fingerprint);
          current = current.issuerCertificate;
        }
        resolve(chain);
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

async function pinsForHost(host) {
  const chain = await fetchChain(host);
  if (chain.length < 1) throw new Error(`Aucun certificat reçu pour ${host}`);

  const leaf = chain[0];
  // Intermédiaire = dernier certificat de la chaîne qui n'est pas auto-signé (root) ;
  // sert de pin de secours car sa durée de vie est bien plus longue que le leaf.
  const intermediate = chain.find((c) => c !== leaf && c.subject?.CN !== c.issuer?.CN) || chain[chain.length - 1];

  const pins = [{ cert: leaf, label: 'leaf' }];
  if (intermediate && intermediate !== leaf) {
    pins.push({ cert: intermediate, label: 'intermediate (secours)' });
  }

  // Expiration du pin-set = la plus proche des deux (le leaf expire toujours avant) —
  // renouveler avant cette date pour ne pas bloquer l'app.
  const expiration = expirationFromCert(leaf);

  for (const { cert, label } of pins) {
    console.log(`[${host}/${label}] subject=${cert.subject?.CN} issuer=${cert.issuer?.CN} pin=${spkiPinFromCert(cert)} expires=${cert.valid_to}`);
  }

  return { host, pins, expiration };
}

async function main() {
  const results = [];
  for (const host of HOSTS) {
    results.push(await pinsForHost(host));
  }

  if (!process.argv.includes('--write')) return;

  const domainBlocks = results
    .map(({ host, pins, expiration }) => {
      const pinLines = pins
        .map(({ cert, label }) => `            <pin digest="SHA-256">${spkiPinFromCert(cert)}</pin> <!-- ${label} -->`)
        .join('\n');
      return `    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">${host}</domain>
        <pin-set expiration="${expiration}">
${pinLines}
        </pin-set>
    </domain-config>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par commun/scripts/fetch-cert-pins.mjs — renouveler avant expiration.
     onscen.com (canonique) + getsoundy.com (legacy) : certificats Caddy/Let's Encrypt
     DISTINCTS, chacun avec 2 pins (leaf + intermédiaire de secours, recommandation OWASP)
     pour éviter de bloquer l'app au prochain renouvellement TLS du leaf seul. -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
${domainBlocks}
</network-security-config>
`;
  fs.writeFileSync(xmlPath, xml, 'utf8');
  console.log(`Written: ${xmlPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
