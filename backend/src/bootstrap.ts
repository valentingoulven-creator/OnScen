import http from 'http';
import https from 'https';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { app } from './server';
import { setupSockets } from './socket';
import { setIo, clearIo } from './lib/ioInstance';
import { seedMsdevData } from './seed-msdev';
import { seedBotsAtStartup } from './seed-bots';
import { purgeHeartNotifications } from './lib/notifications';
import {
  loadPersistedStore,
  schedulePersist,
  startPersistLoop,
  stopPersistLoop,
} from './lib/persist';
import { ensureMsdevHttpsCredentials, getMsdevHttpsUrls } from './msdevHttps';
import { getMsdevEnvPath } from './paths';
import { getLanIpv4Addresses, resolveMobileHostIp } from './lib/lanIp';

function getLanUrls(port: number): string[] {
  return getLanIpv4Addresses().map((ip) => `http://${ip}:${port}`);
}

export interface StartOptions {
  forceMsdev?: boolean;
  openBrowser?: boolean;
  useHttps?: boolean;
}

let httpServer: http.Server | https.Server | null = null;
let ioServer: Server | null = null;
let shutdownHooksRegistered = false;

function shutdown(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      stopPersistLoop();
      httpServer = null;
      ioServer = null;
      clearIo();
      resolve();
    };
    if (!httpServer) {
      finish();
      return;
    }
    if (ioServer) {
      ioServer.close(() => {
        httpServer?.close(finish);
      });
      return;
    }
    httpServer.close(finish);
  });
}

function registerShutdownHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;
  const onSignal = () => {
    void shutdown().then(() => process.exit(0));
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}

export async function startMeloSong(options: StartOptions = {}): Promise<void> {
  const forceMsdev =
    options.forceMsdev ??
    (process.env.MSENV === 'msdev' ||
      process.env.APP_ENV === 'msdev' ||
      process.argv.includes('--msdev'));

  if (forceMsdev) {
    process.env.MSENV = 'msdev';
    process.env.APP_ENV = process.env.APP_ENV || 'msdev';
    dotenv.config({ path: getMsdevEnvPath() });
  } else {
    dotenv.config();
  }

  const PORT = Number(process.env.PORT) || (forceMsdev ? 4080 : 3000);
  const APP_ENV = process.env.APP_ENV || (forceMsdev ? 'msdev' : 'development');
  const HOST = process.env.HOST || '0.0.0.0';
  const useHttps =
    options.useHttps ??
    (process.env.MSDEV_HTTPS === '1' || process.argv.includes('--https'));

  let server: http.Server | https.Server;
  if (useHttps && APP_ENV === 'msdev') {
    const creds = ensureMsdevHttpsCredentials();
    if (creds) {
      server = https.createServer(creds, app);
    } else {
      console.warn('  ⚠ HTTPS indisponible — repli sur HTTP (caméra LAN peut être bloquée).');
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }
  httpServer = server;
  const scheme = server instanceof https.Server ? 'https' : 'http';
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });
  ioServer = io;

  setIo(io);
  setupSockets(io);
  registerShutdownHooks();

  if (APP_ENV === 'msdev') {
    const restored = loadPersistedStore();
    if (restored) {
      console.log('[msdev] Données restaurées (messages, profils, paramètres)');
    } else {
      await seedMsdevData();
    }
    startPersistLoop();
  }

  seedBotsAtStartup();
  purgeHeartNotifications();

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error(`  ✖ Le port ${PORT} est déjà utilisé.`);
        console.error('    Fermez les autres terminaux MeloSong (npm run msdev) puis relancez.');
        console.error(`    Diagnostic: netstat -ano | findstr :${PORT}`);
        console.error('');
      }
      reject(err);
    });
    server.listen(PORT, HOST, () => {
      console.log('');
      console.log('  ╔══════════════════════════════════════╗');
      console.log(`  ║  MeloSong  [${APP_ENV.padEnd(6)}]  local dev       ║`);
      console.log('  ╚══════════════════════════════════════╝');
      console.log(`  → ${scheme}://localhost:${PORT}`);
      console.log(`  → API  ${scheme}://localhost:${PORT}/api`);
      if (APP_ENV === 'msdev') {
        console.log('  → Demo: listener@msdev.local / msdev123');
        const localIps = getLanIpv4Addresses();
        const configuredIp = process.env.MOBILE_HOST_IP;
        const mobileIp = resolveMobileHostIp(configuredIp);
        if (configuredIp && localIps.length && !localIps.includes(configuredIp)) {
          console.log(`  ⚠ MOBILE_HOST_IP=${configuredIp} ne correspond pas au PC (${localIps.join(', ')})`);
          console.log('    Lancez: npm run msdev:sync-ip');
        }
        if (scheme === 'https') {
          console.log('  → Caméra LAN : HTTPS actif (acceptez le certificat auto-signé une fois).');
          const httpsUrls = getMsdevHttpsUrls(PORT);
          const phoneUrl =
            configuredIp != null
              ? `https://${configuredIp}:${PORT}`
              : httpsUrls.find((u) => !u.includes('localhost'));
          if (phoneUrl) {
            console.log('  → Smartphone (caméra — ouvrir sur le téléphone):');
            console.log(`     ${phoneUrl}`);
          }
        } else {
          const mobileUrl =
            (configuredIp && localIps.includes(configuredIp)
              ? process.env.MOBILE_WEB_URL || `http://${configuredIp}:${PORT}`
              : null) ||
            (mobileIp ? `http://${mobileIp}:${PORT}` : null);
          if (mobileUrl) {
            console.log('  → Smartphone (même réseau local — sans caméra garantie en HTTP):');
            console.log(`     ${mobileUrl}`);
          } else {
            const lan = getLanUrls(PORT);
            if (lan.length) {
              console.log('  → Smartphone (même réseau local):');
              lan.forEach((u) => console.log(`     ${u}`));
            }
          }
          console.log('  ℹ  Caméra sur téléphone en HTTP souvent bloquée → npm run msdev:https');
        }
        console.log('  ℹ  L’IP ci-dessus est celle du PC, pas du téléphone.');
        console.log('  → Fermez cette fenêtre pour arrêter le serveur.');
      }
      console.log('');

      if (options.openBrowser) {
        openBrowser(`${scheme}://localhost:${PORT}`);
      }
      resolve();
    });
  });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) console.log('Ouvrez manuellement:', url);
  });
}
