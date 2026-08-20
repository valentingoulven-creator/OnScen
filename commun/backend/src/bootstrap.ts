import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupSockets } from './socket';
import { setIo, clearIo } from './lib/ioInstance';
import { attachSocketClusterAdapter } from './lib/socketCluster';
import { seedMsdevData, ensureMsdevDemoAccounts, ensureMsdevDemoLives, ensureMsdevFranceSalonLives } from './seed-msdev';
import { seedProductionAdmin } from './seed-production';
import { seedBotsAtStartup } from './seed-bots';
import { seedWorldRandomAtStartup } from './seed-world-random';
import { seedHomeFeed } from './seed-home-feed';
import { seedMsdevStories } from './seed-msdev-stories';
import { seedMsdevShowcase } from './seed-msdev-showcase';
import { ensureMsdevPresentationLive, seedMsdevPresentationLive } from './seed-msdev-presentation-live';
import {
  PRESENTATION_LIVE_ID,
  startPresentationDemoChatTicker,
  stopPresentationDemoChatTicker,
} from './lib/presentationDemoLive';
import { db } from './models/schema';
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
import { ensureAccessAdmins, getAccessPolicy, isAccessControlEnabled, loadAccessControlFromPersist } from './lib/accessControl';
import { ensureDefaultMapSidebarEventSponsors, ensureDefaultSponsors, migrateSponsorMapVisibility, syncDefaultSponsorFields, syncDefaultSponsorScopes } from './lib/sponsors';
import { ensureProductionSponsorContent, refreshMsdevSponsorEventDatesIfStale } from './seed-production-sponsors';
import { ensureDefaultSponsorPlatformConfig } from './lib/sponsorPlatformConfig';
import { repairInvalidGeoInDb } from './lib/mapCoords';
import { loadSalonsLivesFromPostgres } from './lib/pgSalonsLives';
import { initPostGis } from './lib/postgisConfig';
import { loadSalonQueuesFromPg } from './lib/pgSalonQueues';
import { loadReelsFromPg } from './lib/pgReels';
import { loadCompositionsFromPg } from './lib/pgCompositions';
import { getDatabaseUrl } from './db/pool';
import { loadDonationsFromPg } from './lib/pgDonations';
import { loadCreatorSubscriptionsFromPg } from './lib/pgSubscriptions';
import { loadSubscriptionCheckoutsFromPg } from './lib/pgSubscriptionCheckouts';
import { migrateAllUsersRelationshipStatus } from './lib/profile';
import { getMsdevEnvPath } from './paths';
import { startSessionLimitScheduler, stopSessionLimitScheduler } from './lib/sessionLimits';
import { startDataRetentionScheduler, stopDataRetentionScheduler } from './lib/dataRetention';
import { assertProductionStartup } from './lib/productionStartup';
import { initRateLimitStore } from './lib/rateLimitStore';
import { initErrorMonitoring } from './lib/errorMonitoring';
import { resolveCorsOrigin } from './lib/corsConfig';
import { startServerMonitor, stopServerMonitor } from './lib/serverMonitor';
import { startExternalUptimeMonitor } from './lib/externalUptimeMonitor';
import { sendMonitoringAlert } from './lib/alertNotifier';

async function loadMsdevOptionalPgMusic(): Promise<void> {
  if (!getDatabaseUrl()) return;
  try {
    const { loadAlbumsFromPg } = await import('./lib/pgAlbums');
    const [compositionStats, albumStats] = await Promise.all([
      loadCompositionsFromPg(),
      loadAlbumsFromPg(),
    ]);
    if (compositionStats.compositions > 0 || albumStats.albums > 0) {
      console.log(
        `[msdev] Musique chargée depuis PostgreSQL (${albumStats.albums} album(s), ${compositionStats.compositions} morceau(x))`
      );
    }
  } catch (e) {
    console.warn('[msdev] Chargement musique PostgreSQL ignoré:', e);
  }
}

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
      service: 'onscen',
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
      stopDataRetentionScheduler();
      stopServerMonitor();
      stopPresentationDemoChatTicker();
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

export async function startOnScen(options: StartOptions = {}): Promise<void> {
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
  await initRateLimitStore();
  await initErrorMonitoring();

  const { app } = await import('./server');

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
    // Explicitly cap payload size to 1 MB (default is 1 MB but set it explicitly
    // so any future Socket.io upgrade cannot silently raise the limit).
    maxHttpBufferSize: 1e6,
    perMessageDeflate: {
      threshold: 1024,
    },
    httpCompression: {
      threshold: 1024,
    },
  });
  ioServer = io;

  setIo(io);
  await attachSocketClusterAdapter(io);
  setupSockets(io);
  startSessionLimitScheduler(io);
  startDataRetentionScheduler();
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
    ensureMsdevDemoLives();
    ensureMsdevFranceSalonLives();
    await ensureMsdevDemoCredentials();
    ensureMsdevDemoMonetizationAges();
    ensureMsdevListenerFollowersCount();
    const admins = ensureAccessAdmins();
    if (admins > 0) {
      console.log(`[onscen] ${admins} compte(s) administrateur synchronisé(s)`);
    }
    if (isAccessControlEnabled()) {
      console.log(
        '[onscen] Contrôle d’accès tunnel public actif — inscriptions soumises à validation admin par défaut'
      );
    }
    await loadMsdevOptionalPgMusic();
    startPersistLoop();
  } else if (APP_ENV === 'production' || APP_ENV === 'preproduction') {
    if (usesPostgresPersistence()) {
      console.log('[onscen] Persistance PostgreSQL (DATABASE_URL)');
    } else {
      console.warn(
        '[onscen] DATABASE_URL absent — repli sur store.json local (non recommandé en production). ' +
          'Configurer PostgreSQL : commun/deploy/RUNBOOK-PROD.md § Checklist .env'
      );
    }
    const restored = await loadPersistedStoreAsync();
    if (usesPostgresPersistence()) {
      await initPostGis();
    }
    if (restored) {
      console.log(
        usesPostgresPersistence()
          ? '[onscen] Données restaurées depuis PostgreSQL'
          : '[onscen] Données restaurées depuis le stockage local'
      );
    } else {
      await seedProductionAdmin();
    }
    if (usesPostgresPersistence()) {
      try {
        const { salons, lives } = await loadSalonsLivesFromPostgres();
        if (salons > 0 || lives > 0) {
          console.log(`[onscen] Salons/lives restaurés depuis PostgreSQL (${salons} salon(s), ${lives} live(s))`);
        }
        const queueRows = await loadSalonQueuesFromPg();
        if (queueRows > 0) {
          console.log(`[onscen] Files d'attente salon restaurées depuis PostgreSQL (${queueRows} morceau(x))`);
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement salons/lives PostgreSQL:', e);
      }
      try {
        const presLive = db.lives.get(PRESENTATION_LIVE_ID);
        if (presLive?.presentationDemoStream && presLive.isActive) {
          const pres = seedMsdevPresentationLive();
          startPresentationDemoChatTicker();
          console.log(
            `[onscen] Live présentation démo : ${pres.viewersCount} spectateurs, ${pres.chatMessages} message(s)`
          );
        }
      } catch (e) {
        console.warn('[onscen] Live présentation démo ignoré:', e);
      }
      try {
        const reelStats = await loadReelsFromPg();
        if (reelStats.reels > 0) {
          console.log(
            `[onscen] Reels restaurés depuis PostgreSQL (${reelStats.reels} reel(s), ` +
              `${reelStats.likes} like(s), ${reelStats.comments} commentaire(s))`
          );
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement reels PostgreSQL:', e);
      }
      try {
        const compositionStats = await loadCompositionsFromPg();
        if (compositionStats.compositions > 0) {
          console.log(
            `[onscen] Compositions restaurées depuis PostgreSQL (${compositionStats.compositions})`
          );
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement compositions PostgreSQL:', e);
      }
      try {
        const { loadAlbumsFromPg } = await import('./lib/pgAlbums');
        const albumStats = await loadAlbumsFromPg();
        if (albumStats.albums > 0) {
          console.log(`[onscen] Albums restaurés depuis PostgreSQL (${albumStats.albums})`);
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement albums PostgreSQL:', e);
      }
      try {
        const donationStats = await loadDonationsFromPg();
        if (donationStats.gifts > 0 || donationStats.payments > 0) {
          console.log(
            `[onscen] Dons restaurés depuis PostgreSQL (${donationStats.gifts} pourboire(s), ` +
              `${donationStats.payments} paiement(s))`
          );
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement dons PostgreSQL:', e);
      }
      // Fix #2: restaurer les abonnements créateurs depuis PostgreSQL
      try {
        const subscriptionCount = await loadCreatorSubscriptionsFromPg();
        if (subscriptionCount > 0) {
          console.log(
            `[onscen] Abonnements créateurs restaurés depuis PostgreSQL (${subscriptionCount})`
          );
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement abonnements PostgreSQL:', e);
      }
      try {
        const checkoutCount = await loadSubscriptionCheckoutsFromPg();
        if (checkoutCount > 0) {
          console.log(
            `[onscen] Checkouts abonnements restaurés depuis PostgreSQL (${checkoutCount})`
          );
        }
      } catch (e) {
        console.warn('[onscen] Échec chargement checkouts PostgreSQL:', e);
      }
    }
    const admins = ensureAccessAdmins();
    if (admins > 0) {
      console.log(`[onscen] ${admins} compte(s) administrateur synchronisé(s)`);
    }
    if (isAccessControlEnabled()) {
      const mode = getAccessPolicy().registrationMode;
      const modeLabel =
        mode === 'open'
          ? 'ouvertes'
          : mode === 'closed'
            ? 'fermées (comptes existants uniquement)'
            : mode === 'invite_only'
              ? 'sur invitation'
              : 'validation admin pour les nouveaux comptes';
      const scope = APP_ENV === 'production' ? 'production' : 'actif';
      console.log(`[onscen] Contrôle d’accès ${scope} — inscriptions ${modeLabel} (mode=${mode})`);
    }
    startPersistLoop();
  }

  const sponsorsAdded = ensureDefaultSponsors();
  if (sponsorsAdded > 0) {
    console.log(`[onscen] Sponsors par défaut ajoutés : ${sponsorsAdded} entrée(s)`);
    schedulePersist();
  }
  const sponsorsSynced = syncDefaultSponsorFields();
  if (sponsorsSynced > 0) {
    console.log(`[onscen] Champs sponsors par défaut complétés : ${sponsorsSynced} entrée(s)`);
    schedulePersist();
  }
  ensureDefaultSponsorPlatformConfig();
  const sponsorGeoMigrated = migrateSponsorMapVisibility();
  if (sponsorGeoMigrated > 0) {
    console.log(`[onscen] Ciblage géo sponsors migré : ${sponsorGeoMigrated} entrée(s)`);
    schedulePersist();
  }
  const sponsorScopesSynced = syncDefaultSponsorScopes();
  if (sponsorScopesSynced > 0) {
    console.log(`[onscen] Portée carte sponsors synchronisée : ${sponsorScopesSynced} entrée(s)`);
    schedulePersist();
  }

  if (APP_ENV === 'production' || APP_ENV === 'preproduction' || APP_ENV === 'msdev') {
    ensureProductionSponsorContent();
    if (APP_ENV === 'msdev') {
      const refreshed = refreshMsdevSponsorEventDatesIfStale();
      if (refreshed > 0) {
        console.log(`[msdev] Dates événements Sponso repoussées : ${refreshed} publication(s)`);
        schedulePersist();
      }
    }
  }
  const sidebarSponsorsAdded = ensureDefaultMapSidebarEventSponsors();
  if (sidebarSponsorsAdded > 0) {
    console.log(
      `[onscen] Sponsors sidebar carte ajoutés : ${sidebarSponsorsAdded} entrée(s)`
    );
    schedulePersist();
  }

  seedBotsAtStartup();
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
    const showcaseSeed = seedMsdevShowcase({
      force: process.env.MSDEV_FORCE_SEED === '1',
    });
    if (
      showcaseSeed.followsAdded > 0 ||
      showcaseSeed.reelsCreated > 0 ||
      showcaseSeed.eventsCreated > 0 ||
      showcaseSeed.salonsCreated > 0 ||
      showcaseSeed.profileUpdated
    ) {
      console.log(
        `[msdev] Showcase listener : ${showcaseSeed.followsAdded} abonnement(s), ` +
          `${showcaseSeed.reelsCreated} reel(s), ${showcaseSeed.eventsCreated} événement(s), ` +
          `${showcaseSeed.salonsCreated} salon(s), ${showcaseSeed.livesCreated} live(s)`
      );
    }
    ensureMsdevPresentationLive();
    startPresentationDemoChatTicker();
  }
  const relationshipMigrated = migrateAllUsersRelationshipStatus();
  if (relationshipMigrated > 0) {
    console.log(`[onscen] Statut relationnel migré : ${relationshipMigrated} utilisateur(s)`);
  }
  const geoRepaired = repairInvalidGeoInDb();
  if (geoRepaired > 0) {
    console.log(`[onscen] Coordonnées carte réparées : ${geoRepaired} entité(s)`);
  }
  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error(`  ✖ Le port ${PORT} est déjà utilisé.`);
        console.error('    Fermez les autres terminaux OnScen (npm run msdev) puis relancez.');
        console.error(`    Diagnostic: netstat -ano | findstr :${PORT}`);
        console.error('');
      }
      reject(err);
    });
    server.listen(PORT, HOST, () => {
      if (APP_ENV === 'production' || APP_ENV === 'preproduction') {
        logProductionStartup(PORT);
        startServerMonitor();
        startExternalUptimeMonitor();
      }
      console.log('');
      console.log('  ╔══════════════════════════════════════╗');
      console.log(`  ║  OnScen   [${APP_ENV.padEnd(14)}]  server          ║`);
      console.log('  ╚══════════════════════════════════════╝');
      console.log(`  → ${scheme}://localhost:${PORT}`);
      console.log(`  → API  ${scheme}://localhost:${PORT}/api`);
      if (APP_ENV === 'msdev') {
        console.log('  → Demo: listener@msdev.local / msdev123');
        const localIps = getLocalIpv4Addresses();
        const configuredIp = process.env.MOBILE_HOST_IP;
        if (configuredIp && localIps.length && !localIps.includes(configuredIp)) {
          console.log(`  ⚠ MOBILE_HOST_IP=${configuredIp} ne correspond pas au PC (${localIps.join(', ')})`);
          console.log('    Mettez à jour commun/msdev/.env et commun/msdev/MOBILE-URL.txt');
        }
        if (scheme === 'https') {
          console.log('  ⚠ http://localhost:' + PORT + ' ne répond pas — utilisez https://localhost:' + PORT);
          console.log('  → Caméra LAN : HTTPS actif (acceptez le certificat auto-signé une fois).');
          console.log('  → Guide certificat : commun/msdev/HTTPS-ACCES.txt');
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
