import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { oauthRouter } from './routes/oauth';
import { geoRouter } from './routes/geo';
import { salonsRouter } from './routes/salons';
import { livesRouter } from './routes/lives';
import { chatRouter } from './routes/chat';
import { dmRouter } from './routes/dm';
import { groupsRouter } from './routes/groups';
import { giftsRouter } from './routes/gifts';
import { donationsRouter, handleStripeDonationWebhook } from './routes/donations';
import { subscriptionsRouter, handleStripeSubscriptionWebhook } from './routes/subscriptions';
import { networkRouter } from './routes/network';
import { ratingsRouter } from './routes/ratings';
import { notificationsRouter } from './routes/notifications';
import { reelsRouter } from './routes/reels';
import { feedRouter } from './routes/feed';
import { storiesRouter } from './routes/stories';
import { usersRouter } from './routes/users';
import { platformsRouter } from './routes/platforms';
import { msdevRouter } from './routes/msdev';
import { legalRouter } from './routes/legal';
import { analyticsRouter } from './routes/analytics';
import { accessRouter } from './routes/access';
import { adminContentRouter } from './routes/adminContent';
import { adminSponsorsRouter } from './routes/adminSponsors';
import { adminCloudflareRouter } from './routes/adminCloudflare';
import { newsRouter } from './routes/news';
import { sponsorsRouter } from './routes/sponsors';
import { trendingRouter } from './routes/trending';
import { supportRouter, supportAdminRouter } from './routes/support';
import { pushRouter } from './routes/push';
import { tilesRouter } from './routes/tiles';
import { getPublicDir, getMsdevConfigPath } from './paths';
import { REEL_UPLOAD_JSON_BODY_LIMIT } from './lib/reelUploadLimits';
import { startTileCacheEviction } from './lib/tileCacheEviction';
import { resolveCorsOrigin } from './lib/corsConfig';
import { isMsdevRuntime } from './lib/msdevGuard';
import { injectOgMetaIntoHtml, resolveShareOgMeta } from './lib/shareOgMeta';
import { renderPublicLegalHtml, resolvePublicLegalDocKey } from './lib/publicLegalHtml';
import { parseRequestLocale } from './lib/requestLocale';
import { checkPoolHealth, isPostgresEnabled } from './db/pool';
import { latencyMonitorMiddleware } from './middleware/latencyMonitor';
import { adminMonitorRouter } from './routes/adminMonitor';
import { adminSyslogRouter } from './routes/adminSyslog';
import { adminReportsRouter } from './routes/adminReports';
import { startServerMonitor } from './lib/serverMonitor';
import { startSystemMonitor } from './lib/systemMonitor';
import { webauthnRouter } from './routes/webauthn';
import { twoFactorRouter } from './routes/twoFactor';

export const app = express();

const PHONE_PREVIEW_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>📱 Soundy — Phone Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --frame-bg-top:    #2b2b32;
      --frame-bg-mid:    #18181e;
      --frame-bg-bot:    #0d0d12;
      --frame-rim:       #35353e;
      --frame-btn:       #1e1e26;
      --frame-hi:        rgba(255,255,255,0.055);
      --accent:          #7c3aed;
      --accent-glow:     rgba(124, 58, 237, 0.18);
    }
    body {
      background:
        radial-gradient(ellipse 70% 45% at 50% 0%, #1a083a 0%, transparent 65%),
        radial-gradient(ellipse 100% 60% at 50% 100%, #060610 0%, transparent 70%),
        #080812;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
      color: #e2e8f0;
      padding: 28px 24px 36px;
      user-select: none;
    }
    .header { text-align: center; margin-bottom: 18px; }
    .header h1 { font-size: 1rem; font-weight: 600; color: #f1f5f9; letter-spacing: -0.02em; }
    .header p { font-size: 0.7rem; color: #4a4a66; margin-top: 5px; }
    .header a { color: var(--accent); text-decoration: none; font-weight: 500; }
    .header a:hover { text-decoration: underline; }
    .size-bar {
      display: flex; gap: 6px; margin-bottom: 28px;
      align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .sz {
      background: #10101a; border: 1px solid #22223a; color: #505070;
      padding: 5px 14px; border-radius: 999px; font-size: 0.7rem;
      font-weight: 500; cursor: pointer; font-family: inherit; line-height: 1;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    .sz:hover { border-color: #3a3a55; color: #8888aa; }
    .sz.on { background: var(--accent-glow); border-color: var(--accent); color: #c4b5fd; }
    .scene { display: flex; align-items: flex-start; justify-content: center; flex: 1; width: 100%; }
    .phone {
      position: relative;
      background: linear-gradient(160deg, var(--frame-bg-top) 0%, var(--frame-bg-mid) 45%, var(--frame-bg-bot) 100%);
      border-radius: 58px; padding: 16px 11px;
      box-shadow:
        0 0 0 1.5px var(--frame-rim), 0 0 0 3px #09090f,
        inset 0 1px 0 rgba(255,255,255,0.09), inset 0 0 0 1px var(--frame-hi),
        0 60px 120px rgba(0,0,0,0.85), 0 24px 48px rgba(0,0,0,0.55),
        0 0 80px rgba(124,58,237,0.06);
      transform-origin: top center;
      transition: transform 0.28s cubic-bezier(0.34,1.2,0.64,1);
      will-change: transform;
    }
    .phone::before {
      content: ''; position: absolute; left: -4px; top: 106px;
      width: 4px; height: 28px; background: var(--frame-btn);
      border-radius: 3px 0 0 3px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.07),
        0 44px 0 0 var(--frame-btn), 0 90px 0 0 var(--frame-btn);
    }
    .phone::after {
      content: ''; position: absolute; right: -4px; top: 150px;
      width: 4px; height: 72px; background: var(--frame-btn);
      border-radius: 0 3px 3px 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
    }
    .screen {
      position: relative; border-radius: 46px; overflow: hidden; background: #000;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
      transition: width 0.28s ease, height 0.28s ease;
    }
    .screen::after {
      content: ''; position: absolute; inset: 0; border-radius: 46px;
      background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.015) 100%);
      pointer-events: none; z-index: 60;
    }
    .island {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      width: 126px; height: 37px; background: #000; border-radius: 22px;
      z-index: 50; pointer-events: none;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.035), 0 2px 10px rgba(0,0,0,0.6);
    }
    .statusbar {
      position: absolute; top: 0; left: 0; right: 0; height: 54px; z-index: 40;
      display: flex; align-items: flex-end; padding: 0 24px 8px;
      justify-content: space-between; pointer-events: none;
      background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%);
    }
    .sb-time { font-size: 15px; font-weight: 600; color: #fff; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .sb-icons { display: flex; align-items: center; gap: 5px; }
    .app-frame { display: block; border: none; background: #0b0b0f; transition: width 0.28s ease, height 0.28s ease; }
    .home {
      position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
      width: 134px; height: 5px; background: rgba(255,255,255,0.28);
      border-radius: 3px; z-index: 50; pointer-events: none;
    }
    .reload-btn {
      position: absolute; top: 8px; right: 8px;
      background: rgba(124,58,237,0.18); border: 1px solid rgba(124,58,237,0.35);
      border-radius: 8px; color: #c4b5fd; font-size: 0.65rem;
      font-family: inherit; padding: 4px 10px; cursor: pointer; z-index: 70;
      transition: background 0.15s;
    }
    .reload-btn:hover { background: rgba(124,58,237,0.3); }
    .footer { margin-top: 24px; font-size: 0.68rem; color: #2e2e48; text-align: center; line-height: 2; }
    .footer a { color: #5b21b6; text-decoration: none; font-weight: 500; }
    .footer a:hover { text-decoration: underline; color: var(--accent); }
    .footer kbd {
      display: inline-block; background: #12121e; border: 1px solid #242438;
      border-radius: 4px; padding: 1px 6px; font-size: 0.65rem; color: #44445e;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📱 Soundy — Aperçu Téléphone</h1>
    <p>apptel &rarr; <a href="/tel/" target="_blank">localhost:4080/tel</a></p>
  </div>
  <div class="size-bar">
    <button class="sz"    onclick="pick(this,320,568)"  title="iPhone SE">SE · 320×568</button>
    <button class="sz"    onclick="pick(this,375,667)"  title="iPhone 8">8 · 375×667</button>
    <button class="sz on" onclick="pick(this,390,844)"  title="iPhone 14">14 · 390×844</button>
    <button class="sz"    onclick="pick(this,430,932)"  title="iPhone 14 Pro Max">Pro Max · 430×932</button>
  </div>
  <div class="scene">
    <div class="phone" id="phone">
      <div class="screen" id="screen">
        <div class="statusbar">
          <span class="sb-time" id="clock">9:41</span>
          <div class="sb-icons">
            <svg width="17" height="12" viewBox="0 0 17 12" fill="white" aria-hidden="true">
              <rect x="0" y="8" width="3" height="4" rx="0.7"/>
              <rect x="4.7" y="5.5" width="3" height="6.5" rx="0.7"/>
              <rect x="9.4" y="3" width="3" height="9" rx="0.7"/>
              <rect x="14.1" y="0" width="3" height="12" rx="0.7" opacity="0.3"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <circle cx="8" cy="10.5" r="1.5" fill="white"/>
              <path d="M3.8 6.8a5.8 5.8 0 0 1 8.4 0" stroke="white" stroke-width="1.45" stroke-linecap="round"/>
              <path d="M1.2 4a10.2 10.2 0 0 1 13.6 0" stroke="white" stroke-width="1.45" stroke-linecap="round"/>
            </svg>
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="21.5" height="11" rx="3.5" stroke="white" stroke-opacity="0.35"/>
              <rect x="2" y="2" width="18" height="8" rx="2" fill="white"/>
              <path d="M23 4v4c1-.5 1.7-1.2 1.7-2s-.7-1.5-1.7-2z" fill="white" fill-opacity="0.4"/>
            </svg>
          </div>
        </div>
        <div class="island"></div>
        <iframe class="app-frame" id="iframe" src="/tel/" title="Soundy Tel" allow="autoplay; camera; microphone; geolocation"></iframe>
        <div class="home"></div>
        <button class="reload-btn" onclick="reloadApp()" title="Recharger l'app">↻ reload</button>
      </div>
    </div>
  </div>
  <div class="footer">
    Ouvrir directement &rarr; <a href="/tel/" target="_blank">http://localhost:4080/tel/</a>
    &nbsp;&middot;&nbsp;
    Dev live &rarr; <a href="http://localhost:4082/tel/" target="_blank">localhost:4082/tel</a>
    <br>
    <kbd>Ctrl+Shift+R</kbd> dans l'iframe pour recharger l'app
    &nbsp;&middot;&nbsp;
    <kbd>F5</kbd> pour rafraîchir l'émulateur
  </div>
  <script>
    const phone=document.getElementById('phone');
    const screen=document.getElementById('screen');
    const iframe=document.getElementById('iframe');
    function resize(w,h){
      screen.style.width=w+'px'; screen.style.height=h+'px';
      iframe.style.width=w+'px'; iframe.style.height=h+'px';
      fitToViewport(w,h);
    }
    function fitToViewport(scrW,scrH){
      const frameW=(scrW||screen.offsetWidth)+22+10;
      const frameH=(scrH||screen.offsetHeight)+32+10;
      const avW=window.innerWidth-60;
      const avH=window.innerHeight-220;
      const scale=Math.min(1,avW/frameW,avH/frameH);
      phone.style.transform='scale('+scale+')';
      const shrinkV=(1-scale)*frameH;
      phone.style.marginTop=(-shrinkV/2)+'px';
      phone.style.marginBottom=(-shrinkV/2)+'px';
    }
    function pick(btn,w,h){
      document.querySelectorAll('.sz').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      resize(w,h);
    }
    function reloadApp(){ iframe.src=iframe.src; }
    resize(390,844);
    window.addEventListener('resize',()=>fitToViewport());
    function tick(){
      var d=new Date();
      document.getElementById('clock').textContent=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    }
    tick(); setInterval(tick,10000);
  </script>
</body>
</html>`;


app.set('trust proxy', 1);
app.use(compression());
app.use(latencyMonitorMiddleware);
// Génère un nonce CSP aléatoire par requête (doit tourner avant helmet).
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Ne pas forcer upgrade-insecure-requests : casse http://IP (scripts → cert auto-signé)
        // et double charge avec Caddy sur getsoundy.com.
        'upgrade-insecure-requests': null,
        'default-src': ["'self'"],
        // unsafe-inline retiré : les scripts inline des pages servies par Express
        // reçoivent un attribut nonce="${res.locals.cspNonce}" injecté à la volée.
        // /phone-preview (outil dev avec onclick) surcharge cette directive via setHeader.
        'script-src': [
          "'self'",
          (_req, res) => `'nonce-${(res as express.Response).locals.cspNonce as string}'`,
          'https://www.youtube.com',
          'https://s.ytimg.com',
          'https://js.stripe.com',
        ],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https:',
          'https://assets.mixkit.co',
          'https://images.unsplash.com',
          'https://api.dicebear.com',
          'https://api.qrserver.com',
        ],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': [
          "'self'",
          'wss:',
          'ws:',
          'https://getsoundy.com',
          'https://assets.mixkit.co',
          'https://images.unsplash.com',
          'https://api.dicebear.com',
          'https://api.qrserver.com',
          'https://js.stripe.com',
          'https://hooks.stripe.com',
          'https://accounts.google.com',
          'https://www.googleapis.com',
          'https://graph.facebook.com',
          'https://open.spotify.com',
        ],
        'media-src': ["'self'", 'blob:', 'https:'],
        'frame-src': [
          "'self'",
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://open.spotify.com',
          'https://js.stripe.com',
          'https://hooks.stripe.com',
        ],
        'worker-src': ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS activé uniquement en production (Caddy gère TLS sur getsoundy.com).
    // Désactivé en dev/msdev pour éviter le blocage http://IP.
    strictTransportSecurity:
      process.env.APP_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
  })
);
app.use(
  cors({
    origin: resolveCorsOrigin(),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
  })
);
app.post(
  '/api/donations/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => void handleStripeDonationWebhook(req, res)
);
app.post(
  '/api/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => void handleStripeSubscriptionWebhook(req, res)
);
app.use('/api/reels', express.json({ limit: REEL_UPLOAD_JSON_BODY_LIMIT }));
app.use(express.json({ limit: '2mb' }));

const publicDir = getPublicDir();

/**
 * Stratégie de cache :
 *  - index.html, sw.js, .webmanifest → no-cache (revalidation systématique)
 *  - Assets hashés Vite (/assets/name-HASH.js) → immutable 1 an
 *    (le hash change à chaque build, donc pas de risque de stale cache)
 */
function isHashedViteAsset(urlPath: string): boolean {
  return /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z]+$/i.test(urlPath);
}

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }
  if (req.path === '/' || req.path === '/index.html') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  } else if (req.path === '/sw.js' || req.path.endsWith('.webmanifest')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  } else if (isHashedViteAsset(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

app.use(
  express.static(publicDir, {
    etag: true,
    setHeaders(res, filePath) {
      const base = path.basename(filePath);
      if (base === 'sw.js' || base.endsWith('.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      } else if (
        filePath.includes(`${path.sep}assets${path.sep}`) &&
        /[-_][A-Za-z0-9_-]{8,}\.[a-z]+$/i.test(base)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

/** Login, register, change-password only — not /me, /profile, check-username (normal use). */
const AUTH_RATE_LIMIT_SENSITIVE_PATHS = new Set(['/login', '/register', '/change-password']);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
  skip: (req) => {
    if (isMsdevRuntime()) return true;
    return !AUTH_RATE_LIMIT_SENSITIVE_PATHS.has(req.path);
  },
});

/** 3 demandes / heure par IP sur /forgot-password */
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de réinitialisation. Réessayez dans une heure.' },
  skip: () => isMsdevRuntime(),
});

/** 10 tentatives / 15 min par IP sur /reset-password */
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
});

/** 20 vérifications / 15 min par IP sur /verify-email */
const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
});

/** 30 vérifications / 15 min par IP sur /check-username */
const checkUsernameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de vérifications de pseudo. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
});

const reportsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de signalements. Réessayez plus tard.' },
  skip: () => isMsdevRuntime(),
});

const donationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de don. Réessayez plus tard.' },
  skip: () => isMsdevRuntime(),
});

const subscriptionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d’abonnement. Réessayez plus tard.' },
  skip: () => isMsdevRuntime(),
});

app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth/reset-password', resetPasswordLimiter);
app.use('/api/auth/verify-email', verifyEmailLimiter);
app.use('/api/auth/check-username', checkUsernameLimiter);
app.use('/api/auth', authLimiter, authRouter);
// OAuth routes are mounted separately: the auth code exchange is naturally
// rate-limited by Google/Facebook, and callback URLs must not be blocked.
app.use('/api/auth', oauthRouter);
// WebAuthn / Passkeys (Face ID, Touch ID, empreinte Android, Windows Hello)
app.use('/api/auth/webauthn', webauthnRouter);
app.use('/api/auth/2fa', twoFactorRouter);
app.use('/api/access', accessRouter);
app.use('/api/access/admin/support', supportAdminRouter);
app.use('/api/access/admin/content', adminContentRouter);
app.use('/api/access/admin/sponsors', adminSponsorsRouter);
app.use('/api/admin', adminCloudflareRouter);
app.use('/api/admin/monitor', adminMonitorRouter);
app.use('/api/admin/vps', adminSyslogRouter);
app.use('/api/admin/reports', adminReportsRouter);
app.use('/api/geo', geoRouter);
app.use('/api/salons', salonsRouter);
app.use('/api/lives', livesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dm', dmRouter);
app.use('/api/dm/groups', groupsRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/donations', donationsLimiter, donationsRouter);
app.use('/api/subscriptions', subscriptionsLimiter, subscriptionsRouter);
app.use('/api/network', networkRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/support', supportRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/feed', feedRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/platforms', platformsRouter);
app.use('/api/msdev', msdevRouter);
app.use('/api/legal/reports', reportsLimiter);
app.use('/api/legal', legalRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/news', newsRouter);
app.use('/api/sponsors', sponsorsRouter);
app.use('/api/trending', trendingRouter);
app.use('/api/push', pushRouter);

app.get('/api/config', (_req, res) => {
  const configPath = getMsdevConfigPath();
  if (fs.existsSync(configPath)) {
    res.sendFile(configPath);
    return;
  }
  res.json({
    env: process.env.APP_ENV || 'development',
    apiBaseUrl: `/api`,
    socketUrl: '/',
  });
});

// Fix #7 + #5: /health teste PostgreSQL et retourne { status, db }
app.get('/health', (_req, res) => {
  const pgEnabled = isPostgresEnabled();

  const respond = (dbStatus: 'ok' | 'error' | 'disabled') => {
    const status = dbStatus === 'error' ? 'degraded' : 'OK';
    res.json({
      status,
      app: 'Soundy',
      env: process.env.APP_ENV || 'development',
      db: dbStatus,
      timestamp: new Date(),
    });
  };

  if (!pgEnabled) {
    respond('disabled');
    return;
  }

  void checkPoolHealth()
    .then((ok) => respond(ok ? 'ok' : 'error'))
    .catch(() => respond('error'));
});

/** Pages légales publiques (sans auth, requises LCEN / Spotify / Google OAuth). */
function sendPublicLegalPage(req: express.Request, res: express.Response): void {
  const docKey = resolvePublicLegalDocKey(req.path);
  if (!docKey) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  const langParam = typeof req.query.lang === 'string' ? req.query.lang : undefined;
  const lang =
    langParam === 'en' || langParam === 'fr'
      ? langParam
      : parseRequestLocale(req.headers['accept-language']);
  const html = renderPublicLegalHtml(docKey, lang);
  if (!html) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('html').send(html);
}

app.get('/privacy', sendPublicLegalPage);
app.get('/terms', sendPublicLegalPage);
app.get('/legal/mentions', sendPublicLegalPage);

/** Page msdev : URL smartphone + QR (même réseau Wi‑Fi). */
app.get('/msdev-mobile', (req, res) => {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') {
    res.status(404).type('text/plain').send('Disponible en mode msdev uniquement');
    return;
  }
  const port = Number(process.env.PORT) || 4080;
  const scheme =
    process.env.MSDEV_HTTPS === '1' || req.secure ? 'https' : 'http';
  const hostIp = process.env.MOBILE_HOST_IP?.trim();
  const baseUrl =
    process.env.MOBILE_WEB_URL?.trim() ||
    (hostIp ? `${scheme}://${hostIp}:${port}` : `${scheme}://localhost:${port}`);
  const telFirst = req.query.app === 'tel' || req.query.app === 'apptel';
  const mobileUrl = telFirst ? `${baseUrl.replace(/\/$/, '')}/tel/` : baseUrl;
  const telUrl = `${baseUrl.replace(/\/$/, '')}/tel/`;
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}`;
  res.type('html').send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Soundy — Smartphone</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0b0f; color: #e5e7eb; margin: 0; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; color: #c4b5fd; }
    a { color: #a78bfa; word-break: break-all; }
    img { margin: 1rem auto; border-radius: 12px; background: #fff; padding: 8px; }
    p { font-size: 0.9rem; color: #9ca3af; max-width: 28rem; margin: 0.5rem auto; }
    code { background: #1a1a26; padding: 0.15rem 0.4rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Soundy sur smartphone</h1>
  <p>Ouvrez cette URL <strong>sur le téléphone</strong> (même Wi‑Fi que le PC) :</p>
  <p><a href="${mobileUrl}">${mobileUrl}</a></p>
  <img src="${qrApi}" width="220" height="220" alt="QR code" />
  <p>Variante mobile (PWA) : <a href="${telUrl}">${telUrl}</a></p>
  <p>Compte démo : <code>listener@msdev.local</code> / <code>msdev123</code></p>
  <p>Caméra : lancez <code>npm run msdev:https</code> sur le PC puis acceptez le certificat auto-signé une fois.</p>
  <p>PWA : dans le navigateur → <em>Ajouter à l'écran d'accueil</em>.</p>
</body>
</html>`);
});

/** Vide le cache SW/PWA et redirige vers l'accueil — contourne le service worker. */
app.get('/clear-pwa', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const nonce = res.locals.cspNonce as string;
  res.type('html').send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Soundy \u2014 Nettoyage cache PWA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0b0b0f; color: #e5e7eb; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; text-align: center; gap: 1rem; }
    .sp { width: 2.5rem; height: 2.5rem; border: 3px solid rgba(167,139,250,0.25); border-top-color: #a78bfa; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 1.1rem; color: #c4b5fd; }
    p { font-size: 0.85rem; color: #9ca3af; max-width: 24rem; }
  </style>
</head>
<body>
  <div class="sp" id="sp"></div>
  <h1>Nettoyage du cache PWA\u2026</h1>
  <p id="msg">D\u00e9sinscription du Service Worker et suppression des caches en cours\u2026</p>
  <script nonce="${nonce}">
    (function () {
      function finish() {
        document.getElementById('sp').style.borderTopColor = '#86efac';
        document.getElementById('msg').textContent = 'Cache supprim\u00e9 \u2014 redirection vers l\u2019accueil\u2026';
        setTimeout(function () { location.replace('/'); }, 1000);
      }
      var p = Promise.resolve();
      if ('serviceWorker' in navigator) {
        p = p.then(function () {
          return navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          });
        });
      }
      if (window.caches) {
        p = p.then(function () {
          return caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          });
        });
      }
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.startsWith('melosong_sw_purge_')) localStorage.removeItem(k);
        });
      } catch (e) {}
      p.then(finish).catch(finish);
    })();
  </script>
</body>
</html>`);
});

/** Émulateur téléphone : affiche apptel dans un cadre iPhone CSS-only. */
app.get('/phone-preview', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Outil de dev : contient des attributs onclick inline qui nécessitent unsafe-inline.
  // On restreint la CSP à ce que la page utilise réellement.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self' ws: wss:;",
  );
  res.send(PHONE_PREVIEW_HTML);
});

function isStaticAssetPath(urlPath: string): boolean {
  if (urlPath.startsWith('/assets/')) return true;
  return /\.(js|mjs|css|map|woff2?|ttf|eot|png|jpe?g|gif|webp|svg|ico|json|webmanifest|txt|wasm)$/i.test(urlPath);
}

function getShareOgBaseUrl(req: express.Request): string {
  const env =
    process.env.WEB_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || 'getsoundy.com').split(',')[0].trim();
  return `${proto}://${host}`;
}

function sendSpaIndex(req: express.Request, res: express.Response, indexPath: string): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const og = resolveShareOgMeta(req.path, getShareOgBaseUrl(req));
  if (!og) {
    res.sendFile(indexPath);
    return;
  }
  try {
    const html = injectOgMetaIntoHtml(fs.readFileSync(indexPath, 'utf-8'), og);
    res.type('html').send(html);
  } catch {
    res.sendFile(indexPath);
  }
}

// Tile proxy: fetches CARTO dark tiles server-side and caches them locally.
// Must be registered before the SPA catchall to avoid the .png 404 short-circuit.
// Rate-limited: 600 req/min per IP (≈ 10 tiles/s — covers normal map panning).
const tileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many tile requests',
  skip: () => isMsdevRuntime(),
});
app.use('/tiles', tileLimiter, tilesRouter);

// Evict oldest cached tiles on startup and every 24 h (cap: TILE_CACHE_MAX_MB, default 500 MB)
startTileCacheEviction();

// System resource monitors (production only — no-op in dev/msdev)
startSystemMonitor();  // RAM + CPU via os module, alerts to ALERT_EMAIL
startServerMonitor();  // Disk + RAM + CPU + API latency p95, alerts to SMTP_ADMIN_EMAIL

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    next();
    return;
  }
  if (isStaticAssetPath(req.path)) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    sendSpaIndex(req, res, indexPath);
  } else {
    res.status(404).send('Soundy app not built. Run: npm run app:build');
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large' || e?.status === 413) {
    res.status(413).json({
      error: 'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.',
    });
    return;
  }
  next(err);
});
