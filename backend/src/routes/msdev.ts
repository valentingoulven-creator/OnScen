import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../models/schema';
import { authenticateJWT, signToken, setAuthCookie } from '../middleware/auth';
import { runAppBuild } from '../lib/msdevRebuild';
import { publicProfile } from '../lib/profile';
import { applyProfileDefaults } from '../lib/profile';
import { ensurePlatformAccountsFromLegacy } from '../lib/platformConnect';
import {
  buildMsdevDualIpConfig,
  getClientIp,
  isMsdevDualIpEnabled,
  resolveEmailForClientIp,
} from '../lib/msdevDualIp';
import { isMsdevShortcutBlocked, loginAccessDeniedReason } from '../lib/accessControl';
import { seedCommunityPosts } from '../seed-community-posts';
import { getHomeFeedSeedStats, seedHomeFeed } from '../seed-home-feed';
import { seedMsdevStories } from '../seed-msdev-stories';
import { assertMsdev } from '../lib/msdevGuard';

export const msdevRouter = Router();

const MSDEV_DEMO_PASSWORD = 'msdev123';

msdevRouter.use(assertMsdev);

let rebuildInProgress = false;

/**
 * Rebuild frontend (app/ → backend/public) puis rechargement côté client.
 * Le serveur Node ne peut pas se redémarrer lui-même ; ngrok reste géré par BUILD-ET-LANCE.bat.
 */
msdevRouter.post('/rebuild', authenticateJWT, async (_req: Request, res: Response) => {
  if (rebuildInProgress) {
    res.status(409).json({ error: 'Un build est déjà en cours' });
    return;
  }
  rebuildInProgress = true;
  try {
    const result = await runAppBuild();
    if (result.code !== 0) {
      const tail = (result.stderr || result.stdout).trim().slice(-800);
      res.status(500).json({
        error: 'Échec du build frontend',
        detail: tail || `code de sortie ${result.code}`,
      });
      return;
    }
    res.json({
      ok: true,
      message: 'Build terminé. Rechargez la page pour appliquer les changements.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur build';
    res.status(500).json({ error: message });
  } finally {
    rebuildInProgress = false;
  }
});

/** Purge PWA / service worker (écran noir après rebuild). */
msdevRouter.get('/clear-pwa', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    hint: 'Ouvrez https://localhost:4080/?clear-pwa=1 ou http://localhost:4080/?clear-pwa=1 puis Ctrl+Shift+R',
    steps: [
      'Fermer l’icône PWA (désinstaller « Soundy » de l’écran d’accueil)',
      'Chrome, Edge ou Opera → Paramètres du site → Effacer les données',
      'Ouvrir l’URL affichée par LANCER-MELOSONG.bat (http ou https, pas l’autre)',
      'Ctrl+Shift+R sur la page de connexion',
    ],
  });
});

msdevRouter.post('/clear-pwa', (_req: Request, res: Response) => {
  res.json({ ok: true, redirect: '/?clear-pwa=1' });
});

/** Regénère les publications aléatoires du fil Communauté (msdev). */
msdevRouter.post('/seed-community-posts', authenticateJWT, (req: Request, res: Response) => {
  const force = req.body?.force === true || req.query.force === '1';
  const result = seedCommunityPosts({ force });
  res.json({
    ok: true,
    ...result,
    message:
      result.created > 0
        ? `${result.created} publication(s) hors favoris créée(s) (${result.nonFavoriteTotal ?? result.total} non-favoris).`
        : `${result.nonFavoriteTotal ?? result.total} publication(s) hors favoris déjà présentes.`,
  });
});

/** Regénère des stories aléatoires pour les favoris de listener@msdev.local (msdev). ?force=1 recrée tout le seed stories. */
msdevRouter.post('/seed-stories', authenticateJWT, (req: Request, res: Response) => {
  const force = req.body?.force === true || req.query.force === '1';
  const result = seedMsdevStories({ force });
  res.json({
    ok: true,
    ...result,
    message:
      result.created > 0
        ? `${result.created} story(s) créée(s) pour ${result.authorIds.length} auteur(s) favori(s) (${result.authorsWithStories} auteurs avec story active).`
        : `${result.authorsWithStories} auteur(s) favori(s) ont déjà une story active.`,
  });
});

/** Regénère favoris + publications mixtes pour l'onglet Accueil (msdev). ?force=1 recrée tout le seed. */
msdevRouter.post('/seed-home-feed', authenticateJWT, (req: Request, res: Response) => {
  const force = req.body?.force === true || req.query.force === '1';
  const forceCommunity = req.body?.forceCommunity === true || force;
  const result = seedHomeFeed({ forceCommunity, forceRepair: force });
  res.json({
    ok: true,
    ...result,
    stats: getHomeFeedSeedStats(),
    message: `Accueil : ${result.listenerFavoriteCount} favoris, ${result.favoritePostsTotal} posts favoris, ${result.communityPostsTotal} posts hors favoris.`,
  });
});

msdevRouter.get('/dual-ip', (req: Request, res: Response) => {
  const port = Number(process.env.PORT) || 4080;
  const clientIp = getClientIp(req);
  res.json(buildMsdevDualIpConfig(port, clientIp));
});

msdevRouter.post('/login-by-ip', async (req: Request, res: Response) => {
  if (isMsdevShortcutBlocked()) {
    res.status(403).json({
      error:
        'Connexion automatique par IP désactivée lorsque le tunnel public (ngrok) est actif. Utilisez e-mail et mot de passe.',
    });
    return;
  }
  const port = Number(process.env.PORT) || 4080;
  const clientIp = getClientIp(req);
  const email =
    (typeof req.body?.email === 'string' ? req.body.email.trim() : '') ||
    resolveEmailForClientIp(clientIp, port);

  if (!email) {
    res.status(400).json({
      error:
        'IP non reconnue pour la simulation. Ouvrez l’app via http://IP_A:4080 ou http://IP_B:4080 (voir /api/msdev/dual-ip).',
      clientIp,
      dual: buildMsdevDualIpConfig(port, clientIp),
    });
    return;
  }

  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user) {
    res.status(404).json({ error: `Compte msdev introuvable: ${email}` });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : MSDEV_DEMO_PASSWORD;
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    res.status(400).json({ error: 'Mot de passe invalide' });
    return;
  }
  const denied = loginAccessDeniedReason(user);
  if (denied) {
    res.status(403).json({ error: denied });
    return;
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  user.lastSeenAt = Date.now();
  db.users.set(user.id, user);
  const token = signToken({ id: user.id, username: user.username });
  setAuthCookie(res, token, true);
  const dual = buildMsdevDualIpConfig(port, clientIp);

  res.json({
    token,
    user: publicProfile(user, true, user.id),
    clientIp,
    matchedSlot: dual.matchedSlot,
    simulatedViaIp: Boolean(dual.matchedSlot),
  });
});
