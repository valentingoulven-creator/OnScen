import fs from 'fs';
import path from 'path';
import { getMsdevEnvPath, getAppRoot } from '../paths';
import { pickPreferredLanIp, getPublicLanIps, testYoutubeReachableFromServer } from './lanNetwork';
import { buildMsdevDualIpConfig, isMsdevDualIpEnabled } from './msdevDualIp';

function resolveMsdevWebScheme(opts?: { useHttps?: boolean }): 'http' | 'https' {
  if (opts?.useHttps) return 'https';
  if (process.env.MSDEV_HTTPS === '1') return 'https';
  if (process.argv.includes('--https')) return 'https';
  return 'http';
}

function buildWebUrl(ip: string, port: number, scheme: 'http' | 'https'): string {
  return `${scheme}://${ip}:${port}`;
}

export interface MsdevLanSyncResult {
  ip: string;
  port: number;
  webUrl: string;
  apiUrl: string;
  socketUrl: string;
  youtubeReachable: boolean;
  envUpdated: boolean;
  configUpdated: boolean;
  mobileUrlUpdated: boolean;
  detectedIps: string[];
  previousIp?: string;
}

function getMsdevDir(): string {
  return path.resolve(getAppRoot(), '..', 'msdev');
}

function getConfigJsonPath(): string {
  const candidates = [
    path.join(getAppRoot(), 'config.json'),
    path.resolve(__dirname, '../../../msdev/config.json'),
    path.join(getMsdevDir(), 'config.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[candidates.length - 1];
}

function getMobileUrlTxtPath(): string {
  return path.join(getMsdevDir(), 'MOBILE-URL.txt');
}

function updateEnvFile(envPath: string, ip: string, port: number, allIps: string[], scheme: 'http' | 'https'): boolean {
  if (!fs.existsSync(envPath)) return false;
  const web = buildWebUrl(ip, port, scheme);
  const api = `${web}/api`;
  const ipA = allIps[0] ?? ip;
  const ipB = allIps[1] ?? ipA;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const localhostWeb = buildWebUrl('localhost', port, scheme);
  const localhostApi = `${localhostWeb}/api`;
  const keys: Record<string, string> = {
    MOBILE_HOST_IP: ip,
    MOBILE_WEB_URL: web,
    MOBILE_API_URL: api,
    MOBILE_SOCKET_URL: web,
    WEB_APP_URL: localhostWeb,
    API_BASE_URL: localhostApi,
    SOCKET_URL: localhostWeb,
    MSDEV_DUAL_IP_ENABLED: allIps.length >= 2 ? 'true' : 'false',
    MSDEV_DUAL_IP_USER_A: ipA,
    MSDEV_DUAL_IP_USER_B: ipB,
    MSDEV_HTTPS: scheme === 'https' ? '1' : '0',
  };
  const seen = new Set<string>();
  const out = lines.map((line) => {
    for (const [key, val] of Object.entries(keys)) {
      const re = new RegExp(`^\\s*${key}\\s*=`);
      if (re.test(line)) {
        seen.add(key);
        return `${key}=${val}`;
      }
    }
    return line;
  });
  for (const [key, val] of Object.entries(keys)) {
    if (!seen.has(key)) out.push(`${key}=${val}`);
  }
  fs.writeFileSync(envPath, out.join('\n').replace(/\n*$/, '\n'));
  return true;
}

function updateConfigJson(configPath: string, ip: string, port: number, allIps: string[], scheme: 'http' | 'https'): boolean {
    const web = buildWebUrl(ip, port, scheme);
  let base: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      base = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  base.port = port;
  base.env = 'msdev';
  base.mobile = {
    hostIp: ip,
    webUrl: web,
    apiBaseUrl: `${web}/api`,
    socketUrl: web,
  };
  base.web = { url: web };
  base.api = {
    baseUrl: `${web}/api`,
    baseUrlAndroid: `http://10.0.2.2:${port}/api`,
  };
  base.socket = {
    url: web,
    urlAndroid: `http://10.0.2.2:${port}`,
  };
  if (allIps.length >= 2) {
    const dual = buildMsdevDualIpConfig(port);
    base.dualIpUsers = dual.users;
    base.dualIpEnabled = true;
  } else if (isMsdevDualIpEnabled()) {
    const dual = buildMsdevDualIpConfig(port);
    base.dualIpUsers = dual.users;
    base.dualIpEnabled = true;
  }
  fs.writeFileSync(configPath, `${JSON.stringify(base, null, 2)}\n`);
  return true;
}

function applyDualIpToProcessEnv(allIps: string[]): void {
  if (allIps.length < 2) return;
  process.env.MSDEV_DUAL_IP_ENABLED = 'true';
  process.env.MSDEV_DUAL_IP_USER_A = allIps[0];
  process.env.MSDEV_DUAL_IP_USER_B = allIps[1];
}

function updateMobileUrlTxt(txtPath: string, ip: string, port: number, youtubeOk: boolean, allIps: string[], scheme: 'http' | 'https'): boolean {
    const web = buildWebUrl(ip, port, scheme);
  const ytNote = youtubeOk
    ? 'YouTube: accessible depuis ce PC (recherche / lecteur OK).'
    : 'YouTube: VERIFIEZ la connexion Internet / pare-feu sur ce PC.';
  let dualBlock = '';
  if (allIps.length >= 2) {
    const ipA = allIps[0];
    const ipB = allIps[1];
    dualBlock = `
=== 2 utilisateurs simules (2 IP du PC) ===
Utilisateur A (hote DJ)     : ${buildWebUrl(ipA, port, scheme)}
  Compte: dj@msdev.local / msdev123
Utilisateur B (auditeur)    : ${buildWebUrl(ipB, port, scheme)}
  Compte: listener@msdev.local / msdev123
Ouvrez chaque URL dans un navigateur ou appareil different.
`;
  }
  const body = `Soundly — URL a ouvrir SUR LE TELEPHONE (navigateur)
(IP du PC sur le reseau local — pas l'IP du telephone)

${web}
${dualBlock}
${ytNote}

Si ca ne charge pas: npm run msdev:diagnose puis npm run msdev:fix-network (admin)
Si l'IP du PC a change: npm run msdev:sync-lan

Compte demo: listener@msdev.local / msdev123
`;
  fs.writeFileSync(txtPath, body);
  return true;
}

function readConfiguredIp(envPath: string): string | undefined {
  if (!fs.existsSync(envPath)) return undefined;
  const m = fs.readFileSync(envPath, 'utf8').match(/^\s*MOBILE_HOST_IP\s*=\s*(.+)\s*$/m);
  return m?.[1]?.trim();
}

export async function syncMsdevLanConfig(opts?: {
  port?: number;
  forceIp?: string;
  useHttps?: boolean;
}): Promise<MsdevLanSyncResult> {
  const port = opts?.port ?? (Number(process.env.PORT) || 4080);
  const scheme = resolveMsdevWebScheme(opts);
  const envPath = getMsdevEnvPath();
  const previousIp = readConfiguredIp(envPath);
  const detectedIps = getPublicLanIps();
  const envForce = process.env.MSDEV_FORCE_LAN_IP?.trim();
  const ip =
    (opts?.forceIp && detectedIps.includes(opts.forceIp) ? opts.forceIp : null) ||
    (envForce && detectedIps.includes(envForce) ? envForce : null) ||
    pickPreferredLanIp(previousIp) ||
    pickPreferredLanIp() ||
    '192.168.1.93';

  const webUrl = buildWebUrl(ip, port, scheme);
  const youtubeReachable = await testYoutubeReachableFromServer();

  process.env.MOBILE_HOST_IP = ip;
  process.env.MOBILE_WEB_URL = webUrl;
  process.env.MOBILE_API_URL = `${webUrl}/api`;
  process.env.MOBILE_SOCKET_URL = webUrl;

  applyDualIpToProcessEnv(detectedIps);
  const envUpdated = updateEnvFile(envPath, ip, port, detectedIps, scheme);
  const configUpdated = updateConfigJson(getConfigJsonPath(), ip, port, detectedIps, scheme);
  const mobileUrlUpdated = updateMobileUrlTxt(getMobileUrlTxtPath(), ip, port, youtubeReachable, detectedIps, scheme);

  return {
    ip,
    port,
    webUrl,
    apiUrl: `${webUrl}/api`,
    socketUrl: webUrl,
    youtubeReachable,
    envUpdated,
    configUpdated,
    mobileUrlUpdated,
    detectedIps,
    previousIp,
  };
}
