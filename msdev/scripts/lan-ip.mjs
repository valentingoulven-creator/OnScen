import os from 'os';

/** @returns {string[]} */
export function getLanIpv4Addresses() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        ips.push(iface.address);
      }
    }
  }
  return [...new Set(ips)];
}

/** Prefer home/office LAN (192.168, 10.x) over Docker/virtual bridges. */
function scoreLanIp(ip) {
  if (ip.startsWith('192.168.')) return 300;
  if (ip.startsWith('10.')) return 200;
  const [a, b, c, d] = ip.split('.').map(Number);
  if (a === 172 && b >= 16 && b <= 31) {
    if (b === 17 && c === 0 && d === 1) return 10;
    if (b === 18 && c === 0 && d === 1) return 10;
    if (b === 30 && c === 0) return 20;
    return 100;
  }
  return 0;
}

/** @param {string[]} ips */
export function pickBestLanIp(ips) {
  if (!ips.length) return null;
  return [...ips].sort((left, right) => scoreLanIp(right) - scoreLanIp(left))[0];
}

export function detectBestLanIp() {
  return pickBestLanIp(getLanIpv4Addresses());
}
