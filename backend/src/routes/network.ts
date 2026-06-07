import { Router } from 'express';
import os from 'os';
import { resolveMobileHostIp } from '../lib/lanIp';

export const networkRouter = Router();

networkRouter.get('/info', (_req, res) => {
  const port = Number(process.env.PORT) || 4080;
  const urls: { ip: string; url: string; internal: boolean }[] = [];

  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === 'IPv4') {
        urls.push({
          ip: iface.address,
          url: `http://${iface.address}:${port}`,
          internal: iface.internal,
        });
      }
    }
  }

  const lan = urls.filter((u) => !u.internal && !u.ip.startsWith('169.254'));
  const lanIps = lan.map((u) => u.ip);
  const configuredIp = process.env.MOBILE_HOST_IP;
  const fixedIp = resolveMobileHostIp(configuredIp) || '192.168.1.93';
  const fixedUrl =
    configuredIp && lanIps.includes(configuredIp)
      ? process.env.MOBILE_WEB_URL || `http://${fixedIp}:${port}`
      : `http://${fixedIp}:${port}`;
  const configuredStale =
    configuredIp != null && configuredIp !== '' && lanIps.length > 0 && !lanIps.includes(configuredIp);

  res.json({
    port,
    hostBind: process.env.HOST || '0.0.0.0',
    localhost: `http://localhost:${port}`,
    smartphonePrimary: fixedUrl,
    smartphoneIp: fixedIp,
    smartphone: [fixedUrl, ...lan.map((u) => u.url).filter((u) => u !== fixedUrl)],
    pcAddresses: lanIps,
    configuredIpStale: configuredStale,
    hint: `Sur le telephone, ouvrez dans le navigateur: ${fixedUrl}`,
    notePcIp:
      "L'adresse 192.168.x.x est celle du PC qui heberge MeloSong. Ce n'est pas l'IP du telephone.",
    noteNoDeviceList:
      "L'app n'affiche pas les telephones connectes au reseau. « Personnes proches » = comptes MeloSong avec position.",
  });
});
