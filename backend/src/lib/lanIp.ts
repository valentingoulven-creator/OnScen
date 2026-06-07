import os from 'os';

export function getLanIpv4Addresses(): string[] {
  const ips: string[] = [];
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

function scoreLanIp(ip: string): number {
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

export function pickBestLanIp(ips: string[]): string | null {
  if (!ips.length) return null;
  return [...ips].sort((left, right) => scoreLanIp(right) - scoreLanIp(left))[0];
}

export function detectBestLanIp(): string | null {
  return pickBestLanIp(getLanIpv4Addresses());
}

export function resolveMobileHostIp(configuredIp?: string): string | null {
  const lanIps = getLanIpv4Addresses();
  if (configuredIp && lanIps.includes(configuredIp)) return configuredIp;
  return pickBestLanIp(lanIps) || configuredIp || null;
}
