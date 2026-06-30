import os from 'os';

export interface LanAddress {
  ip: string;
  internal: boolean;
}

export function getLanIpv4Addresses(): LanAddress[] {
  const out: LanAddress[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family !== 'IPv4') continue;
      if (iface.address.startsWith('169.254')) continue;
      out.push({ ip: iface.address, internal: iface.internal });
    }
  }
  return out;
}

export function getPublicLanIps(): string[] {
  return getLanIpv4Addresses()
    .filter((a) => !a.internal)
    .map((a) => a.ip);
}

/** IP LAN préférée : première IPv4 non loopback hors APIPA. */
export function pickPreferredLanIp(configured?: string): string | null {
  const ips = getPublicLanIps();
  if (configured && ips.includes(configured)) return configured;
  if (ips.length) return ips[0];
  if (configured?.trim()) return configured.trim();
  return null;
}

export async function testHttpsReachable(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok || res.status === 204 || res.status === 403;
  } catch {
    return false;
  }
}

export async function testYoutubeReachableFromServer(): Promise<boolean> {
  const endpoints = [
    'https://www.youtube.com/generate_204',
    'https://www.google.com/generate_204',
  ];
  for (const url of endpoints) {
    if (await testHttpsReachable(url)) return true;
  }
  return false;
}
