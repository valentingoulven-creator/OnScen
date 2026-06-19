import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { app } from './server';
import { setupSockets } from './socket';
import { setIo, clearIo } from './lib/ioInstance';
import { seedMsdevData, ensureMsdevDemoAccounts } from './seed-msdev';
import { seedProductionAdmin } from './seed-production';
import { seedBotsAtStartup } from './seed-bots';
import { seedOccitanieSpotifyAtStartup } from './seed-occitanie-spotify';
import { seedWorldRandomAtStartup } from './seed-world-random';
import { seedHomeFeed } from './seed-home-feed';
import { seedMsdevStories } from './seed-msdev-stories';
import {
  loadPersistedStore,
  loadPersistedStoreAsync,
  schedulePersist,
  startPersistLoop,
  stopPersistLoop,
  usesPostgresPersistence,
} from './lib/persist';
import { closePool } from './db/pool';
import { ensureMsdevHttpsCredentials, getMsdevHttpsUrls } from './msdevHttps';
import {
  ensureMsdevDemoCredentials,
  ensureMsdevDemoMonetizationAges,
  ensureMsdevListenerFollowersCount,
} from './lib/msdevDemoAccounts';
import { ensureAccessAdmins, isAccessControlEnabled, loadAccessControlFromPersist } from './lib/accessControl';
import { ensureDefaultSponsors, migrateSponsorMapVisibility } from './lib/sponsors';
import { ensureDefaultSponsorPlatformConfig } from './lib/sponsorPlatformConfig';
import { repairInvalidGeoInDb } from './lib/mapCoords';
import { loadSalonsLivesFromPostgres } from './lib/pgSalonsLives';
import { loadSalonQueuesFromPg } from './lib/pgSalonQueues';
import { loadReelsFromPg } from './lib/pgReels';
import { loadCompositionsFromPg } from './lib/pgCompositions';
import { loadDonationsFromPg } from './lib/pgDonations';
import { loadCreatorSubscriptionsFromPg } from './lib/pgSubscriptions';
import { migrateAllUsersRelationshipStatus } from './lib/profile';
import { getMsdevEnvPath } from './paths';
import { startSessionLimitScheduler, stopSessionLimitScheduler } from './lib/sessionLimits';
import { assertProductionStartup } from './lib/productionStartup';
import { resolveCorsOrigin } from './lib/corsConfig';
import { startServerMonitor, stopServerMonitor } from './lib/serverMonitor';
import { sendMonitoringAlert } from './lib/alertNotifier';

function getLocalIpv4Addresses(): string[] {
  const ips: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    if (!interfaces) continue;
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function getLanUrls(port: number): string[] {
  return getLocalIpv4Addresses().map((ip) => `http://${ip}:${port}`);
}

function logProductionStartup(port: number): void {
  let version = process.env.APP_VERSION?.trim() || '';
  if (!version) {
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      version = String(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '');
    } catch {
      version = 'unknown';
    }
  }
  const commit = process.env.DEPLOY_COMMIT?.trim().slice(0, 12) || undefined;
  console.log(
    JSON.stringify({
      event: 'startup',
      service: 'soundly',
      env: 'production',
      version,
      ...(commit ? { commit } : {}),
      port,
      ts: new Date().toISOString(),
    })
  );
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
      void stopPersistLoop()
        .then(() => closePool())
        .finally(() => {
          stopSessionLimitScheduler();
          stopServerMonitor();
          httpServer = null;
          ioServer = null;
          clearIo();
          resolve();
        });
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

let criticalHandlersRegistered = false;

function registerCriticalEventHandlers(): void {
  if (criticalHandlersRegistered) return;
  criticalHandlersRegistered = true;

  process.on('uncaughtException', (err: Error) => {
    console.error('[monitor] Exception non capturée — arrêt du processus:', err);
    void sendMonitoringAlert({
      type: 'uncaught_exception',
      severity: 'critical',
      message: `Exception non capturée : ${err.message}\n\nStack:\n${err.stack ?? 'N/A'}`,
      forceSend: true,
    }).catch(() => {}).finally(() => process.exit(1));
    // Ensure exit even if email sending hangs (PM2 will restart)
    setTimeout(() => process.exit(1), 5_000).unref();
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? (reason.stack ?? '') : '';
    console.error('[monitor] Promise rejection non gérée:', reason);
    void sendMonitoringAlert({
      type: 'unhandled_rejection',
      severity: 'warning',
      message: `Promise rejection non gérée : ${msg}\n\nStack:\n${stack || 'N/A'}`,
    });
  });
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

  assertProductionStartup();

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
      origin: resolveCorsOrigin(),
      methods: ['GET', 'POST'],
      allowedHeaders: ['X-Auth-Token', 'Content-Type'],
    },
    perMessageDeflate: {
      threshold: 1024,
    },
    httpCompression: {
      threshold: 1024,
    },
  });
  ioServer = io;

  setIo(io);
  setupSockets(io);
  startSessionLimitScheduler(io);
  registerShutdownHooks();
  registerCriticalEventHandlers();

  if (APP_ENV === 'msdev') {
    const restored = loadPersistedStore();
    if (restored) {
      console.log('[msdev] Données restaurées (messages, profils, paramètres)');
    } else {
      await seedMsdevData();
      loadAccessControlFromPersist(undefined, []);
    }
    const demoAdded = await ensureMsdevDemoAccounts();
    if (demoAdded > 0) {
      console.log(`[msdev] ${demoAdded} compte(s) démo ajouté(s) au store restauré`);
    }
    await ensureMsdevDemoCredentials();
    ensureMsdevDemoMonetizationAges();
    ensureMsdevListenerFollowersCount();
    const admins = ensureAccessAdmins();
    if (admins > 0) {
      console.log(`[melosong] ${admins} compte(s) administrateur synchronisé(s)`);
    }
    if (isAccessControlEnabled()) {
      console.log(
        '[melosong] Contrôle d’accès tunnel public actif — inscriptions soumises à validation admin par défaut'
      );
    }
    startPersistLoop();
  } else if (APP_ENV === 'production') {
    if (usesPostgresPersistence()) {
      console.log('[soundly] Persistance PostgreSQL (DATABASE_URL)');
    } else {
      console.warn(
        '[soundly] DATABASE_URL absent — repli sur store.json local (non recommandé en production). ' +
          'Configurer PostgreSQL : deploy/RUNBOOK-PROD.md § Checklist .env'
      );
    }
    const restored = await loadPersistedStoreAsync();
    if (restored) {
      console.log(
        usesPostgresPersistence()
          ? '[soundly] Données restaurées depuis PostgreSQL'
          : '[soundly] Données restaurées depuis le stockage local'
      );
    } else {
      await seedProductionAdmin();
    }
    if (usesPostgresPersistence()) {
      try {
        const { salons, lives } = await loadSalonsLivesFromPostgres();
        if (salons > 0 || lives > 0) {
          console.log(`[soundly] Salons/lives restaurés depuis PostgreSQL (${salons} salon(s), ${lives} live(s))`);
        }
        const queueRows = await loadSalonQueuesFromPg();
        if (queueRows > 0) {
          console.log(`[soundly] Files d'attente salon restaurées depuis PostgreSQL (${queueRows} morceau(x))`);
        }
      } catch (e) {
        console.warn('[soundly] Échec chargement salons/lives PostgreSQL:', e);
      }
      try {
        const reelStats = await loadReelsFromPg();
        if (reelStats.reels > 0) {
          console.log(
            `[soundly] Reels restaurés depuis PostgreSQL (${reelStats.reels} reel(s), ` +
              `${reelStats.likes} like(s), ${reelStats.comments} commentaire(s))`
          );
        }
      } catch (e) {
        console.warn('[soundly] Échec chargement reels PostgreSQL:', e);
      }
      try {
        const compositionStats = await loadCompositionsFromPg();
        if (compositionStats.compositions > 0) {
          console.log(
            `[soundly] Compositions restaurées depuis PostgreSQL (${compositionStats.compositions})`
          );
        }
      } catch (e) {
        console.warn('[soundly] Échec chargement compositions PostgreSQL:', e);
      }
      try {
        const donationStats = await loadDonationsFromPg();
        if (donationStats.gifts > 0 || donationStats.payments > 0) {
          console.log(
            `[soundly] Dons restaurés depuis PostgreSQL (${donationStats.gifts} pourboire(s), ` +
              `${donationStats.payments} paiement(s))`
          );
        }
      } catch (e) {
        console.warn('[soundly] Échec chargement dons PostgreSQL:', e);
      }
      // Fix #2: restaurer les abonnements créateurs depuis PostgreSQL
      try {
        const subscriptionCount = await loadCreatorSubscriptionsFromPg();
        if (subscriptionCount > 0) {
          console.log(
            `[soundly] Abonnements créateurs restaurés depuis PostgreSQL (${subscriptionCount})`
          );
        }
      } catch (e) {
        console.warn('[soundly] Échec chargement abonnements PostgreSQL:', e);
      }
    }
    const admins = ensureAccessAdmins();
    if (admins > 0) {
      console.log(`[soundly] ${admins} compte(s) administrateur synchronisé(s)`);
    }
    if (isAccessControlEnabled()) {
      console.log('[soundly] Contrôle d’accès actif — validation admin pour les nouveaux comptes');
    }
    startPersistLoop();
  }

  const sponsorsAdded = ensureDefaultSponsors();
  if (sponsorsAdded > 0) {
    console.log(`[melosong] Sponsors par défaut ajoutés : ${sponsorsAdded} entrée(s)`);
    schedulePersist();
  }
  ensureDefaultSponsorPlatformConfig();
  const sponsorGeoMigrated = migrateSponsorMapVisibility();
  if (sponsorGeoMigrated > 0) {
    console.log(`[melosong] Ciblage géo sponsors migré : ${sponsorGeoMigrated} entrée(s)`);
    schedulePersist();
  }

  seedBotsAtStartup();
  seedOccitanieSpotifyAtStartup();
  seedWorldRandomAtStartup();
  if (APP_ENV === 'msdev') {
    seedHomeFeed({ forceRepair: process.env.MSDEV_FORCE_SEED === '1' });
    const storiesSeed = seedMsdevStories({
      force: process.env.MSDEV_FORCE_SEED === '1',
    });
    if (storiesSeed.created > 0) {
      console.log(
        `[msdev] Stories seed : ${storiesSeed.created} story(s) pour ${storiesSeed.authorIds.length} auteur(s) favori(s) (${storiesSeed.authorsWithStories} auteurs avec story)`
      );
    }
  }
  const relationshipMigrated = migrateAllUsersRelationshipStatus();
  if (relationshipMigrated > 0) {
    console.log(`[melosong] Statut relationnel migré : ${relationshipMigrated} utilisateur(s)`);
  }
  const geoRepaired = repairInvalidGeoInDb();
  if (geoRepaired > 0) {
    console.log(`[melosong] Coordonnées carte réparées : ${geoRepaired} entité(s)`);
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error(`  ✖ Le port ${PORT} est déjà utilisé.`);
        console.error('    Fermez les autres terminaux Soundy (npm run msdev) puis relancez.');
        console.error(`    Diagnostic: netstat -ano | findstr :${PORT}`);
        console.error('');
      }
      reject(err);
    });
    server.listen(PORT, HOST, () => {
      if (APP_ENV === 'production') {
        logProductionStartup(PORT);
        startServerMonitor();
      }
      console.log('');
      console.log('  ╔══════════════════════════════════════╗');
      console.log(`  ║  Soundy   [${APP_ENV.padEnd(6)}]  local dev       ║`);
      console.log('  ╚══════════════════════════════════════╝');
      console.log(`  → ${scheme}://localhost:${PORT}`);
      console.log(`  → API  ${scheme}://localhost:${PORT}/api`);
      if (APP_ENV === 'msdev') {
        console.log('  → Demo: listener@msdev.local / msdev123');
        const localIps = getLocalIpv4Addresses();
        const configuredIp = process.env.MOBILE_HOST_IP;
        if (configuredIp && localIps.length && !localIps.includes(configuredIp)) {
          console.log(`  ⚠ MOBILE_HOST_IP=${configuredIp} ne correspond pas au PC (${localIps.join(', ')})`);
          console.log('    Mettez à jour msdev/.env et msdev/MOBILE-URL.txt');
        }
        if (scheme === 'https') {
          console.log('  ⚠ http://localhost:' + PORT + ' ne répond pas — utilisez https://localhost:' + PORT);
          console.log('  → Caméra LAN : HTTPS actif (acceptez le certificat auto-signé une fois).');
          console.log('  → Guide certificat : msdev/HTTPS-ACCES.txt');
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
            process.env.MOBILE_WEB_URL ||
            (configuredIp ? `http://${configuredIp}:${PORT}` : null);
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
