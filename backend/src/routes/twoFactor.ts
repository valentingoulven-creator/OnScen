import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import { db } from '../models/schema';
import { authenticateJWT, signToken } from '../middleware/auth';
import { getJwtSecret } from '../lib/jwtSecret';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import { schedulePersist } from '../lib/persist';
import { publicProfile } from '../lib/profile';

export const twoFactorRouter = Router();

const JWT_SECRET = getJwtSecret();

// ─── Rate limiter (validate endpoint : 5 attempts / 15 min) ─────────────────

const twoFAValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── TOTP secret encryption (AES-256-GCM) ───────────────────────────────────

/**
 * Encrypts a plain TOTP secret using `TOTP_ENCRYPTION_KEY` (64 hex chars = 32 bytes).
 * Falls back to plaintext storage if the env var is absent or too short (dev / msdev).
 */
function encryptSecret(plain: string): string {
  const keyHex = process.env.TOTP_ENCRYPTION_KEY ?? '';
  if (keyHex.length !== 64) return plain;
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypts a stored secret. Returns plaintext as-is if encryption is not configured. */
function decryptSecret(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) return stored;
  const keyHex = process.env.TOTP_ENCRYPTION_KEY ?? '';
  if (keyHex.length !== 64) return stored;
  const key = Buffer.from(keyHex, 'hex');
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

/** Generates 8 random single-use backup codes in the form `XXXX-XXXX`. */
function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}

/**
 * Compares `inputCode` against every hashed backup code.
 * Returns the index of the matched code, or -1 if none match.
 * Input may arrive as `XXXXXXXX` (no dash) or `XXXX-XXXX`.
 */
async function matchBackupCode(hashedCodes: string[], inputCode: string): Promise<number> {
  const cleaned = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalised = cleaned.length === 8 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : inputCode.toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalised, hashedCodes[i]).catch(() => false);
    if (match) return i;
  }
  return -1;
}

// ─── Temp-token payload shape ─────────────────────────────────────────────────

interface TwoFaTempPayload {
  id: string;
  username: string;
  scope: '2fa_pending';
  rememberMe: boolean;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/2fa/setup
 * Generates a new TOTP secret + QR code for the authenticated user.
 * The secret is stored as `pending:<secret>` and 2FA is NOT yet enabled.
 * The user must call /verify with a valid code to activate it.
 */
twoFactorRouter.post('/setup', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string; username: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (user.twoFactorEnabled) {
    res.status(400).json({ error: 'La double authentification est déjà activée' });
    return;
  }

  const secret = otplib.generateSecret();
  const appName = process.env.APP_NAME ?? 'MeloSong';
  const otpauthUrl = otplib.generateURI({
    label: user.email,
    issuer: appName,
    secret,
  });

  user.totpSecret = `pending:${secret}`;
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  let qrCode: string;
  try {
    qrCode = await QRCode.toDataURL(otpauthUrl);
  } catch {
    res.status(500).json({ error: 'Erreur lors de la génération du QR code' });
    return;
  }

  res.json({ otpauthUrl, qrCode });
});

/**
 * POST /api/auth/2fa/verify
 * Confirms the TOTP code entered by the user after scanning the QR code.
 * On success: encrypts the secret, enables 2FA, and returns 8 backup codes.
 */
twoFactorRouter.post('/verify', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (user.twoFactorEnabled) {
    res.status(400).json({ error: 'La double authentification est déjà activée' });
    return;
  }
  if (!user.totpSecret?.startsWith('pending:')) {
    res.status(400).json({ error: 'Aucune configuration en cours. Recommencez la procédure.' });
    return;
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Code requis' });
    return;
  }

  const secret = user.totpSecret.slice('pending:'.length);
  const verifyResult = otplib.verifySync({ token: code.replace(/\s/g, ''), secret });
  if (!verifyResult.valid) {
    res.status(400).json({ error: 'Code invalide. Vérifiez l\'heure de votre appareil et réessayez.' });
    return;
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 8)));

  user.totpSecret = encryptSecret(secret);
  user.twoFactorEnabled = true;
  user.twoFactorBackupCodes = hashedCodes;
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  res.json({ ok: true, backupCodes: plainCodes });
});

/**
 * POST /api/auth/2fa/disable
 * Disables 2FA. Requires a valid TOTP code or a backup code for confirmation.
 */
twoFactorRouter.post('/disable', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (!user.twoFactorEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'La double authentification n\'est pas activée' });
    return;
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Code requis' });
    return;
  }

  const secret = decryptSecret(user.totpSecret);
  const disableVerify = otplib.verifySync({ token: code.replace(/\s/g, ''), secret });
  let isValid = disableVerify.valid;

  if (!isValid && user.twoFactorBackupCodes?.length) {
    const idx = await matchBackupCode(user.twoFactorBackupCodes, code);
    if (idx >= 0) {
      user.twoFactorBackupCodes.splice(idx, 1);
      isValid = true;
    }
  }

  if (!isValid) {
    res.status(400).json({ error: 'Code invalide' });
    return;
  }

  delete user.totpSecret;
  delete user.twoFactorEnabled;
  delete user.twoFactorBackupCodes;
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  res.json({ ok: true });
});

/**
 * POST /api/auth/2fa/status
 * Returns whether 2FA is enabled for the authenticated user, and how many
 * backup codes remain. Does not expose secrets.
 */
twoFactorRouter.get('/status', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({
    twoFactorEnabled: user.twoFactorEnabled === true,
    backupCodesRemaining: user.twoFactorBackupCodes?.length ?? 0,
  });
});

/**
 * POST /api/auth/2fa/validate
 * Rate-limited (5 attempts / 15 min).
 * Validates a TOTP code (or backup code) against a short-lived temp token
 * issued by the login endpoint when 2FA is required.
 * On success returns a full JWT + user profile.
 */
twoFactorRouter.post('/validate', twoFAValidateLimiter, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string };
  if (!tempToken || !code) {
    res.status(400).json({ error: 'Token temporaire et code requis' });
    return;
  }

  let decoded: TwoFaTempPayload;
  try {
    decoded = jwt.verify(tempToken, JWT_SECRET) as TwoFaTempPayload;
  } catch {
    res.status(403).json({ error: 'Token temporaire invalide ou expiré. Reconnectez-vous.' });
    return;
  }

  if (decoded.scope !== '2fa_pending') {
    res.status(403).json({ error: 'Token invalide' });
    return;
  }

  const user = db.users.get(decoded.id);
  if (!user || !user.twoFactorEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'Utilisateur introuvable ou 2FA non configurée' });
    return;
  }

  const secret = decryptSecret(user.totpSecret);
  const cleanCode = code.replace(/\s/g, '');
  const validateResult = otplib.verifySync({ token: cleanCode, secret });
  let isValid = validateResult.valid;

  if (!isValid && user.twoFactorBackupCodes?.length) {
    const idx = await matchBackupCode(user.twoFactorBackupCodes, code);
    if (idx >= 0) {
      user.twoFactorBackupCodes.splice(idx, 1);
      db.users.set(user.id, user);
      schedulePersistUserToPg(user);
      schedulePersist();
      isValid = true;
    }
  }

  if (!isValid) {
    res.status(400).json({ error: 'Code invalide' });
    return;
  }

  const token = signToken({ id: user.id, username: user.username }, decoded.rememberMe);
  res.json({ token, user: publicProfile(user, true, user.id) });
});
