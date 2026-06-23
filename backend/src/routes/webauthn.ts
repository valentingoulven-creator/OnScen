import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import rateLimit from 'express-rate-limit';
import { authenticateJWT, signTokenForUser, setAuthCookie } from '../middleware/auth';
import { db } from '../models/schema';
import { publicProfile } from '../lib/profile';
import { loginAccessDeniedReason } from '../lib/accessControl';
import { trackEvent, trackUserActive } from '../lib/analytics';
import { isMsdevRuntime } from '../lib/msdevGuard';
import {
  listCredentialsForUser,
  findCredentialById,
  saveCredential,
  updateCredentialCounter,
  deleteCredential,
} from '../lib/pgWebAuthn';

// ── Relying Party configuration ───────────────────────────────────────────────
const rpID   = process.env.WEBAUTHN_RP_ID   ?? 'getsoundy.com';
const rpName = process.env.WEBAUTHN_RP_NAME ?? 'Soundy';
/** Accepts a comma-separated list of origins for multi-origin setups (e.g. ngrok). */
function getExpectedOrigins(): string[] {
  const env = process.env.WEBAUTHN_ORIGIN ?? 'https://getsoundy.com';
  return env.split(',').map((o) => o.trim()).filter(Boolean);
}

export const webauthnRouter = Router();

// ── Rate limiter: 30 req / 15 min per IP ─────────────────────────────────────
const webauthnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives biométriques. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
});

// ── In-memory challenge store (TTL 5 min) ────────────────────────────────────
interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}
const challengeStore = new Map<string, ChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, entry] of challengeStore.entries()) {
    if (now > entry.expiresAt) challengeStore.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/webauthn/credentials — liste les credentials de l'utilisateur
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.get(
  '/credentials',
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId = (req as Request & { user: { id: string } }).user.id;
    try {
      const creds = await listCredentialsForUser(userId);
      res.json({
        credentials: creds.map((c) => ({
          id: c.credentialId,
          deviceType: c.deviceType,
          backedUp: c.backedUp,
          createdAt: c.createdAt,
        })),
      });
    } catch {
      res.status(500).json({ error: 'Erreur lors de la récupération des credentials' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/register/options — génère les options d'enregistrement
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.post(
  '/register/options',
  authenticateJWT,
  webauthnLimiter,
  async (req: Request, res: Response) => {
    const userId   = (req as Request & { user: { id: string; username: string } }).user.id;
    const username = (req as Request & { user: { id: string; username: string } }).user.username;
    const user = db.users.get(userId);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    try {
      const existingCreds = await listCredentialsForUser(userId);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId),
        userName: username,
        userDisplayName: user.username,
        excludeCredentials: existingCreds.map((c) => ({
          id: c.credentialId,
          transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
        supportedAlgorithmIDs: [-7, -257],
      });

      if (challengeStore.size > 5000) pruneExpiredChallenges();
      challengeStore.set(`reg:${userId}`, {
        challenge: options.challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
      });

      res.json(options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération des options';
      res.status(500).json({ error: msg });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/register/verify — vérifie et enregistre le credential
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.post(
  '/register/verify',
  authenticateJWT,
  webauthnLimiter,
  async (req: Request, res: Response) => {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const body   = req.body as RegistrationResponseJSON;

    const entry = challengeStore.get(`reg:${userId}`);
    if (!entry || Date.now() > entry.expiresAt) {
      challengeStore.delete(`reg:${userId}`);
      res.status(400).json({ error: "Session expir\u00e9e. Recommencez l'activation." });
      return;
    }
    challengeStore.delete(`reg:${userId}`);

    try {
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: entry.challenge,
        expectedOrigin: getExpectedOrigins(),
        expectedRPID: rpID,
        requireUserVerification: true,
      });

      if (!verified || !registrationInfo) {
        res.status(400).json({ error: 'Vérification biométrique échouée.' });
        return;
      }

      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

      await saveCredential({
        userId,
        credentialId: credential.id,
        publicKey:    Buffer.from(credential.publicKey),
        counter:      credential.counter,
        transports:   credential.transports ?? null,
        deviceType:   credentialDeviceType,
        backedUp:     credentialBackedUp,
      });

      res.json({ verified: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la vérification';
      res.status(400).json({ error: msg });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/login/options — génère les options d'authentification
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.post(
  '/login/options',
  webauthnLimiter,
  async (_req: Request, res: Response) => {
    try {
      const sessionId = crypto.randomUUID();

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: [],
        userVerification: 'preferred',
      });

      if (challengeStore.size > 5000) pruneExpiredChallenges();
      challengeStore.set(`auth:${sessionId}`, {
        challenge:  options.challenge,
        expiresAt:  Date.now() + CHALLENGE_TTL_MS,
      });

      res.json({ ...options, sessionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération du challenge';
      res.status(500).json({ error: msg });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/login/verify — vérifie et renvoie un JWT
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.post(
  '/login/verify',
  webauthnLimiter,
  async (req: Request, res: Response) => {
    const { response, sessionId } = req.body as {
      response: AuthenticationResponseJSON;
      sessionId: string;
    };

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId manquant' });
      return;
    }

    const entry = challengeStore.get(`auth:${sessionId}`);
    if (!entry || Date.now() > entry.expiresAt) {
      challengeStore.delete(`auth:${sessionId}`);
      res.status(400).json({ error: 'Session expirée. Recommencez la connexion biométrique.' });
      return;
    }
    challengeStore.delete(`auth:${sessionId}`);

    const credentialId = response?.id;
    if (!credentialId) {
      res.status(400).json({ error: 'Réponse biométrique invalide.' });
      return;
    }

    try {
      const credential = await findCredentialById(credentialId);
      if (!credential) {
        res.status(400).json({
          error:
            'Face ID non reconnu. Activez Face ID depuis les paramètres de votre compte.',
          code: 'webauthn_credential_not_found',
        });
        return;
      }

      const user = db.users.get(credential.userId);
      if (!user) {
        res.status(400).json({ error: 'Compte introuvable.' });
        return;
      }

      const denied = loginAccessDeniedReason(user);
      if (denied) {
        res.status(403).json({
          error: denied,
          code: user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending',
        });
        return;
      }

      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response,
        expectedChallenge: entry.challenge,
        expectedOrigin:    getExpectedOrigins(),
        expectedRPID:      rpID,
        credential: {
          id:         credential.credentialId,
          publicKey:  new Uint8Array(credential.publicKey),
          counter:    credential.counter,
          transports: (credential.transports ?? []) as AuthenticatorTransportFuture[],
        },
        requireUserVerification: true,
      });

      if (!verified) {
        res.status(400).json({ error: 'Authentification biométrique échouée.' });
        return;
      }

      await updateCredentialCounter(credential.credentialId, authenticationInfo.newCounter);

      trackEvent('user_login_biometric', user.id);
      trackUserActive(user.id);

      const token = signTokenForUser(user);
      setAuthCookie(res, token, true);
      res.json({ token, user: publicProfile(user, true, user.id) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur d'authentification";
      res.status(400).json({ error: msg });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/webauthn/credential/:credentialId — supprime un credential
// ─────────────────────────────────────────────────────────────────────────────
webauthnRouter.delete(
  '/credential/:credentialId',
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId       = (req as Request & { user: { id: string } }).user.id;
    const credentialId = req.params.credentialId;

    try {
      const deleted = await deleteCredential(credentialId, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Credential introuvable ou non autorisé.' });
        return;
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Erreur lors de la suppression du credential.' });
    }
  }
);
