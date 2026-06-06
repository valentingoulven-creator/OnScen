/**
 * Synchronise msdev/.env, config.json et MOBILE-URL.txt avec l’IP LAN du PC.
 * Usage: npx ts-node --transpile-only src/scripts/sync-lan-env.ts
 */
import dotenv from 'dotenv';
import { getMsdevEnvPath } from '../paths';
import { syncMsdevLanConfig } from '../lib/msdevLanConfig';

async function main(): Promise<void> {
  dotenv.config({ path: getMsdevEnvPath() });
  const result = await syncMsdevLanConfig();
  console.log('');
  console.log('  MeloSong — configuration réseau local');
  console.log(`  IP LAN utilisée : ${result.ip}`);
  if (result.detectedIps.length > 1) {
    console.log(`  Autres IP sur ce PC : ${result.detectedIps.filter((i) => i !== result.ip).join(', ')}`);
  }
  console.log(`  URL smartphone   : ${result.webUrl}`);
  console.log(`  YouTube (PC)     : ${result.youtubeReachable ? 'OK' : 'NON ACCESSIBLE — vérifiez Internet / pare-feu'}`);
  if (result.previousIp && result.previousIp !== result.ip) {
    console.log(`  (ancienne IP .env : ${result.previousIp})`);
  }
  console.log('');
  process.exit(result.youtubeReachable ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
