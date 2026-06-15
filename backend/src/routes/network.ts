import { Router } from 'express';
import { pickPreferredLanIp, getPublicLanIps, testYoutubeReachableFromServer } from '../lib/lanNetwork';
import { syncMsdevLanConfig } from '../lib/msdevLanConfig';
import { assertMsdev } from '../lib/msdevGuard';

export const networkRouter = Router();

networkRouter.get('/info', async (_req, res) => {
  const port = Number(process.env.PORT) || 4080;
  const lanIps = getPublicLanIps();
  const configuredIp = process.env.MOBILE_HOST_IP;
  const fixedIp = pickPreferredLanIp(configuredIp) || lanIps[0] || configuredIp || '192.168.1.93';
  const fixedUrl = process.env.MOBILE_WEB_URL || `http://${fixedIp}:${port}`;
  const configuredStale =
    configuredIp != null && configuredIp !== '' && lanIps.length > 0 && !lanIps.includes(configuredIp);
  const youtubeReachable = await testYoutubeReachableFromServer();

  res.json({
    port,
    hostBind: process.env.HOST || '0.0.0.0',
    localhost: `http://localhost:${port}`,
    smartphonePrimary: fixedUrl,
    smartphoneIp: fixedIp,
    smartphone: [fixedUrl, ...lanIps.map((ip) => `http://${ip}:${port}`).filter((u) => u !== fixedUrl)],
    pcAddresses: lanIps,
    configuredIpStale: configuredStale,
    youtubeReachable,
    hint: `Sur le telephone, ouvrez dans le navigateur: ${fixedUrl}`,
    notePcIp:
      "L'adresse 192.168.x.x est celle du PC qui heberge Soundy. Ce n'est pas l'IP du telephone.",
    noteYoutube: youtubeReachable
      ? 'YouTube accessible depuis le PC (lecteur et recherche OK).'
      : 'YouTube bloque sur ce PC — verifiez Internet / pare-feu avant le salon.',
    noteNoDeviceList:
      "L'app n'affiche pas les telephones connectes au reseau. « Personnes proches » = comptes Soundy avec position.",
  });
});

networkRouter.post('/sync-lan', assertMsdev, async (_req, res) => {
  try {
    const result = await syncMsdevLanConfig();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Sync LAN impossible' });
  }
});
