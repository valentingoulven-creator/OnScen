import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';

/** Coût bcrypt pour les mots de passe utilisateurs (register / change / reset). */
const BCRYPT_SALT_ROUNDS = 12;
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { db, User, ListeningRole } from '../models/schema';
import {
  authenticateJWT,
  clearAuthCookie,
  revokeSessionFromRequest,
  setAuthCookie,
  signTokenForUser,
} from '../middleware/auth';
import { getJwtSecret, JWT_SIGN_OPTIONS } from '../lib/jwtSecret';
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from '../lib/loginAttemptLimit';
import { reconcileHostSalonsWithPostgres } from '../lib/pgSalonsLives';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import {
  applyAgeSettings,
  applyProfileDefaults,
  applyRelationshipSettings,
  publicProfile,
  syncProfilePhotos,
  sanitizeIncomingProfilePhotos,
  countPersistableProfilePhotos,
  MAX_PROFILE_PHOTOS,
} from '../lib/profile';
import { trackEvent, trackUserActive } from '../lib/analytics';
import {
  USERNAME_COLOR_WAVE,
  parseUsernameColorInput,
  parseUsernameWaveHexInput,
} from '../lib/usernameColor';
import { applyPrivacySettings } from '../lib/locationPrivacy';
import { generateUserId } from '../lib/userIds';
import {
  ensurePlatformAccountsFromLegacy,
  migratePlaintextPlatformTokens,
  isPlatformConnected,
} from '../lib/platformConnect';
import { schedulePersist } from '../lib/persist';
import { invalidateGlobalSearchIndex } from '../lib/globalSearchIndex';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import { bumpUserTokenVersion } from '../lib/tokenVersion';
import { sanitizePlainText } from '../lib/sanitizeUserText';
import { buildUserDataExport } from '../lib/accountDataExport';
import { deleteUserAccountCascade } from '../lib/accountDeletion';
import { prepareUserAccountDeletion } from '../lib/accountDeletionPrep';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import { acceptCurrentTerms, userNeedsTermsReacceptance } from '../lib/termsAcceptance';
import { isValidProfileType } from '../lib/profileTypes';
import { moderateImageSources, moderationRejectionMessage } from '../lib/contentModeration';
import { validateImageMagicBytes } from '../lib/imageValidation';
import { profilePhotoUploadLimiter } from '../lib/uploadRateLimits';
import {
  persistProfilePhotoUrls,
  deleteProfilePhotoIfLocal,
  PROFILE_PHOTO_DATA_RE,
} from '../lib/profilePhotoAssets';
import {
  assertRegistrationAllowed,
  consumeInviteCode,
  getAccessPolicy,
  loginAccessDeniedReason,
  resolveInitialAccountStatus,
} from '../lib/accessControl';
import { isOAuthOnlyPasswordHash } from '../lib/oauthAccount';
import { revokeAndDisconnectYoutube } from '../lib/youtubeOAuth';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../lib/mailer';

export const authRouter = Router();

const exportDataLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop d’exports de données. Réessayez dans une heure.',
    code: 'export_rate_limited',
  },
  skip: () => isMsdevRuntime(),
  store: createRateLimitStore('auth-export'),
});

const JWT_SECRET = getJwtSecret();

/** Per-user profile cache: 30-second TTL. Cleared on profile write. */
const profileCache = new Map<string, { data: object; expiresAt: number }>();
const PROFILE_CACHE_TTL = 30_000;
const PROFILE_CACHE_MAX_SIZE = 1000;

/** Evict all expired entries; also called when the cache exceeds its size limit. */
function pruneProfileCache(): void {
  const now = Date.now();
  for (const [key, entry] of profileCache.entries()) {
    if (now > entry.expiresAt) profileCache.delete(key);
  }
}

export function invalidateProfileCache(userId: string) {
  // Cache keys have the form "${targetId}:${viewerId}" — remove all entries
  // where the target profile is the updated user.
  const prefix = `${userId}:`;
  for (const key of profileCache.keys()) {
    if (key.startsWith(prefix)) profileCache.delete(key);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_\-.àâäéèêëîïôùûüç]+$/i;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const USERNAME_MIN = 2;
const USERNAME_MAX = 30;

authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, acceptTerms, termsVersion, inviteCode, confirmAge } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }
  if (typeof username !== 'string' || username.trim().length < USERNAME_MIN) {
    res.status(400).json({ error: `Le pseudo doit faire au moins ${USERNAME_MIN} caractères` });
    return;
  }
  if (username.trim().length > USERNAME_MAX) {
    res.status(400).json({ error: `Le pseudo ne peut pas dépasser ${USERNAME_MAX} caractères` });
    return;
  }
  if (!USERNAME_RE.test(username.trim())) {
    res.status(400).json({ error: 'Le pseudo contient des caractères non autorisés' });
    return;
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'Adresse e-mail invalide' });
    return;
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    res.status(400).json({ error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères` });
    return;
  }
  if (password.length > PASSWORD_MAX) {
    res.status(400).json({ error: `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX} caractères` });
    return;
  }
  const regCheck = assertRegistrationAllowed({ inviteCode });
  if (!regCheck.ok) {
    res.status(regCheck.status).json({ error: regCheck.error });
    return;
  }
  if (!acceptTerms) {
    res.status(400).json({
      error: 'Vous devez accepter les CGU et la Politique de confidentialité',
    });
    return;
  }
  if (confirmAge !== true) {
    res.status(400).json({
      error: 'Vous devez confirmer avoir au moins 13 ans pour créer un compte',
      code: 'age_not_confirmed',
    });
    return;
  }
  if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
    res.status(400).json({
      error: 'Les conditions ont été mises à jour. Rechargez la page et acceptez la nouvelle version.',
    });
    return;
  }
  const exists = Boolean(db.users.findByEmailExact(email) || db.users.findByUsernameExact(username));
  if (exists) {
    res.status(400).json({
      error: 'Impossible de créer le compte avec ces identifiants. Vérifiez le pseudo et l’e-mail.',
      code: 'registration_rejected',
    });
    return;
  }
  const accountStatus = resolveInitialAccountStatus();
  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la création du compte' });
    return;
  }
  // Bypass email verification for test accounts or when explicitly disabled in env.
  // SKIP_EMAIL_VERIFICATION=true is for development/E2E only — never set in production.
  const bypassEmails = (process.env.EMAIL_VERIFICATION_BYPASS_LIST ?? '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const skipVerification =
    process.env.SKIP_EMAIL_VERIFICATION === 'true' ||
    bypassEmails.includes(email.toLowerCase());

  const verificationToken = skipVerification ? undefined : crypto.randomBytes(32).toString('hex');
  const verificationTokenExpiry = skipVerification
    ? undefined
    : Date.now() + 24 * 60 * 60 * 1000; // 24h

  let user: User = {
    id: generateUserId(),
    username,
    email,
    passwordHash,
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    memberSince: Date.now(),
    acceptedTermsAt: Date.now(),
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    ageConfirmedAt: Date.now(),
    accountStatus,
    onboardingCompleted: false,
    emailVerified: skipVerification,
    verificationToken,
    verificationTokenExpiry,
  };
  user = applyProfileDefaults(user);
  if (getAccessPolicy().registrationMode === 'invite_only' && inviteCode) {
    consumeInviteCode(String(inviteCode));
  }
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  // Send verification email (graceful — no SMTP = skip, signup still proceeds)
  if (!skipVerification && verificationToken) {
    const appUrl = process.env.WEB_APP_URL ?? 'https://getsoundy.com';
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
    void sendVerificationEmail({ toEmail: email, username, verificationUrl });
  }

  if (accountStatus === 'pending') {
    res.status(202).json({
      pending: true,
      message:
        'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.',
      user: publicProfile(user, true, user.id),
    });
    return;
  }

  if (!skipVerification) {
    res.status(201).json({
      emailVerificationRequired: true,
      emailVerificationSent: true,
      message:
        'Compte créé. Consultez vos e-mails pour activer votre compte avant de vous connecter.',
      email: user.email,
    });
    return;
  }

  const token = signTokenForUser(user);
  setAuthCookie(res, token, true);
  res.status(201).json({
    token,
    user: publicProfile(user, true, user.id),
    emailVerificationSent: !skipVerification,
    emailVerified: skipVerification,
  });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email requis.' });
    return;
  }
  if (await isLoginBlocked(email)) {
    res.status(429).json({
      error: 'Trop de tentatives pour ce compte. Réessayez dans 15 minutes.',
      code: 'login_rate_limited',
    });
    return;
  }
  const user = db.users.findByEmailExact(email);
  if (!user) {
    await recordLoginFailure(email);
    res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    return;
  }
  let passwordMatch: boolean;
  try {
    passwordMatch = await bcrypt.compare(password, user.passwordHash);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la connexion' });
    return;
  }
  if (!passwordMatch) {
    await recordLoginFailure(email);
    res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    return;
  }
  await clearLoginFailures(email);
  const denied = loginAccessDeniedReason(user);
  if (denied) {
    res.status(403).json({
      error: denied,
      code: user.accountStatus === 'blocked' ? 'account_blocked' : 'account_pending',
    });
    return;
  }
  if (user.emailVerified === false) {
    res.status(403).json({
      error: "Votre adresse e-mail n'est pas encore vérifiée. Consultez vos e-mails ou demandez un nouveau lien.",
      code: 'email_not_verified',
      email: user.email,
    });
    return;
  }

  const stayLoggedIn = rememberMe !== false;

  // If 2FA is enabled, issue a short-lived temp token instead of a full JWT.
  if (user.twoFactorEnabled && user.totpSecret && !user.totpSecret.startsWith('pending:')) {
    const tempToken = jwt.sign(
      { id: user.id, username: user.username, scope: '2fa_pending', rememberMe: stayLoggedIn },
      JWT_SECRET,
      { ...JWT_SIGN_OPTIONS, expiresIn: '5m' }
    );
    res.json({ requires2FA: true, tempToken });
    return;
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  migratePlaintextPlatformTokens(user);
  db.users.set(user.id, user);
  const token = signTokenForUser(user, stayLoggedIn);
  setAuthCookie(res, token, stayLoggedIn);
  trackEvent('user_login', user.id);
  trackUserActive(user.id);
  res.json({ token, user: publicProfile(user, true, user.id), rememberMe: stayLoggedIn });
});

/** Logout: clears cookie and revokes JWT (tokenVersion bump). */
authRouter.post('/logout', (req: Request, res: Response) => {
  revokeSessionFromRequest(req);
  clearAuthCookie(res);
  schedulePersist();
  res.json({ ok: true });
});

authRouter.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  try {
    await reconcileHostSalonsWithPostgres(userId);
  } catch (err) {
    console.warn('[auth/me] reconcile salons hôte:', err);
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  migratePlaintextPlatformTokens(user);
  db.users.set(user.id, user);
  const authToken = (req as Request & { authToken?: string }).authToken;
  res.json({
    user: publicProfile(user, true, user.id),
    currentTermsVersion: CURRENT_TERMS_VERSION,
    termsReacceptanceRequired: userNeedsTermsReacceptance(user),
    ...(authToken ? { token: authToken } : {}),
  });
});

authRouter.post('/accept-terms', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { termsVersion } = req.body ?? {};
  if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
    res.status(400).json({ error: 'Version des CGU obsolète — rechargez la page.' });
    return;
  }
  acceptCurrentTerms(user);
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({
    ok: true,
    user: publicProfile(user, true, user.id),
    currentTermsVersion: CURRENT_TERMS_VERSION,
    termsReacceptanceRequired: false,
  });
});

authRouter.get('/me/export', exportDataLimiter, authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  applyProfileDefaults(user);
  const exportData = buildUserDataExport(user);
  const filename = `soundy-export-${user.username.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
});

authRouter.get('/profile/:userId', authenticateJWT, (req: Request, res: Response) => {
  const targetId = req.params.userId;
  const me = (req as Request & { user: { id: string } }).user.id;
  const cacheKey = `${targetId}:${me}`;
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json(cached.data);
    return;
  }
  const user = db.users.get(targetId);
  if (!user) {
    res.status(404).json({ error: 'Profil introuvable' });
    return;
  }
  const result = { user: publicProfile(user, user.id === me, me) };
  if (profileCache.size >= PROFILE_CACHE_MAX_SIZE) pruneProfileCache();
  profileCache.set(cacheKey, { data: result, expiresAt: Date.now() + PROFILE_CACHE_TTL });
  res.setHeader('Cache-Control', 'private, max-age=30');
  res.json(result);
});

authRouter.patch('/profile', authenticateJWT, profilePhotoUploadLimiter, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const {
    username,
    bio,
    interests,
    favoriteGenres,
    favoriteArtists,
    city,
    listeningRole,
    profileType,
    avatarUrl,
    profilePhotos,
    relationshipStatus,
    relationshipStatusCustom,
    birthDate,
    age,
    showAge,
    hideBirthDateOnProfile,
    hideBioOnProfile,
    shareDistance,
    locationPrecision,
    usernameColor,
    usernameWaveFrom,
    usernameWaveTo,
    instagramHandle,
    youtubeChannel,
  } = req.body;

  if (username && typeof username === 'string') {
    const name = username.trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Le pseudo doit faire au moins 2 caractères' });
      return;
    }
    const existingWithName = db.users.findByUsernameExact(name);
    const taken = Boolean(existingWithName && existingWithName.id !== userId);
    if (taken) {
      res.status(400).json({ error: 'Ce pseudo est déjà pris' });
      return;
    }
    user.username = name;
    invalidateGlobalSearchIndex();
  }
  if (bio !== undefined) user.bio = sanitizePlainText(String(bio).slice(0, 500));
  if (hideBioOnProfile !== undefined) {
    if (typeof hideBioOnProfile !== 'boolean') {
      res.status(400).json({ error: 'hideBioOnProfile doit être un booléen.' });
      return;
    }
    user.hideBioOnProfile = hideBioOnProfile;
  }
  if (Array.isArray(interests)) user.interests = interests.map(String).slice(0, 12);
  if (Array.isArray(favoriteGenres)) user.favoriteGenres = favoriteGenres.map(String).slice(0, 10);
  if (Array.isArray(favoriteArtists)) user.favoriteArtists = favoriteArtists.map(String).slice(0, 10);
  if (city !== undefined) {
    user.city = String(city).slice(0, 80);
    applyPrivacySettings(user, {});
  }
  if (listeningRole && ['auditeur', 'host', 'les_deux'].includes(listeningRole)) {
    user.listeningRole = listeningRole as ListeningRole;
  }
  if (profileType === null || profileType === '') {
    delete user.profileType;
  } else if (typeof profileType === 'string' && isValidProfileType(profileType)) {
    user.profileType = profileType;
  }
  if (
    relationshipStatus !== undefined ||
    relationshipStatusCustom !== undefined
  ) {
    const relResult = applyRelationshipSettings(user, {
      relationshipStatus,
      relationshipStatusCustom,
    });
    if (!relResult.ok) {
      res.status(400).json({ error: relResult.error });
      return;
    }
  }
  if (
    birthDate !== undefined ||
    age !== undefined ||
    showAge !== undefined ||
    hideBirthDateOnProfile !== undefined
  ) {
    const ageResult = applyAgeSettings(user, { birthDate, age, showAge, hideBirthDateOnProfile });
    if (!ageResult.ok) {
      res.status(400).json({ error: ageResult.error });
      return;
    }
  }
  if (shareDistance !== undefined || locationPrecision !== undefined) {
    applyPrivacySettings(user, { shareDistance, locationPrecision });
  }

  const parsedColor = parseUsernameColorInput(usernameColor);
  if (parsedColor !== undefined) {
    if (parsedColor === null) {
      delete user.usernameColor;
    } else {
      user.usernameColor = parsedColor;
    }
  } else if (usernameColor !== undefined) {
    res.status(400).json({ error: 'Couleur de pseudo invalide (hex ou wave)' });
    return;
  }

  const parsedWaveFrom = parseUsernameWaveHexInput(usernameWaveFrom);
  if (parsedWaveFrom !== undefined) {
    if (parsedWaveFrom === null) delete user.usernameWaveFrom;
    else user.usernameWaveFrom = parsedWaveFrom;
  } else if (usernameWaveFrom !== undefined) {
    res.status(400).json({ error: 'Couleur wave invalide (hex)' });
    return;
  }

  const parsedWaveTo = parseUsernameWaveHexInput(usernameWaveTo);
  if (parsedWaveTo !== undefined) {
    if (parsedWaveTo === null) delete user.usernameWaveTo;
    else user.usernameWaveTo = parsedWaveTo;
  } else if (usernameWaveTo !== undefined) {
    res.status(400).json({ error: 'Couleur wave invalide (hex)' });
    return;
  }

  if (
    parsedColor === undefined &&
    (user.usernameWaveFrom || user.usernameWaveTo) &&
    user.usernameColor !== USERNAME_COLOR_WAVE
  ) {
    user.usernameColor = USERNAME_COLOR_WAVE;
  }

  if (Array.isArray(profilePhotos)) {
    /** Base64 d'une photo compressée max 2 Mo → 2,8 M de caractères (facteur 4/3). */
    const MAX_PHOTO_CHARS = Math.ceil(2 * 1024 * 1024 * (4 / 3)) + 64;
    const incoming = profilePhotos.map(String);
    for (const p of incoming) {
      if (!p.startsWith('data:image/')) continue;
      if (p.length > MAX_PHOTO_CHARS) {
        res.status(413).json({ error: 'Chaque photo ne peut pas dépasser 2 Mo.' });
        return;
      }
      const match = PROFILE_PHOTO_DATA_RE.exec(p);
      if (!match) {
        res.status(400).json({ error: 'Format de photo non pris en charge (JPEG, PNG, WebP, GIF).' });
        return;
      }
      const buffer = Buffer.from(match[2], 'base64');
      if (!validateImageMagicBytes(buffer, match[1])) {
        res.status(400).json({ error: 'Photo invalide ou corrompue.' });
        return;
      }
    }
    const moderation = await moderateImageSources(incoming, 'profile_photo');
    if (!moderation.allowed) {
      res.status(422).json({ error: moderationRejectionMessage(moderation) });
      return;
    }
    let persisted: string[];
    try {
      persisted = await persistProfilePhotoUrls(incoming);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Photo invalide.',
      });
      return;
    }
    const previousPhotos = [...(user.profilePhotos ?? [])];
    const intendedCount = countPersistableProfilePhotos(persisted);
    syncProfilePhotos(user, sanitizeIncomingProfilePhotos(persisted));
    for (const old of previousPhotos) {
      if (old && !persisted.includes(old)) deleteProfilePhotoIfLocal(old);
    }
    const savedCount = countPersistableProfilePhotos(user.profilePhotos ?? []);
    if (intendedCount > 0 && savedCount === 0) {
      res.status(400).json({
        error:
          'Les photos du profil n\'ont pas pu être enregistrées. Réessayez ou utilisez des images plus légères.',
      });
      return;
    }
    if (intendedCount > savedCount) {
      res.status(400).json({
        error:
          'Certaines photos n\'ont pas pu être enregistrées. Réduisez le nombre ou la taille des images.',
      });
      return;
    }
  } else if (avatarUrl && typeof avatarUrl === 'string') {
    let url = avatarUrl.trim().slice(0, 2000);
    if (PROFILE_PHOTO_DATA_RE.test(url)) {
      try {
        const [savedUrl] = await persistProfilePhotoUrls([url]);
        url = savedUrl;
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Photo invalide.',
        });
        return;
      }
    }
    const moderation = await moderateImageSources([url], 'avatar');
    if (!moderation.allowed) {
      res.status(422).json({ error: moderationRejectionMessage(moderation) });
      return;
    }
    const existing = user.profilePhotos?.length ? [...user.profilePhotos] : [];
    if (existing.length === 0) {
      syncProfilePhotos(user, [url]);
    } else {
      existing[0] = url;
      syncProfilePhotos(user, existing.slice(0, MAX_PROFILE_PHOTOS));
    }
  }

  if (instagramHandle !== undefined) {
    const handle = String(instagramHandle).replace(/^@/, '').trim().slice(0, 64);
    if (handle) user.instagramHandle = handle;
    else delete user.instagramHandle;
  }
  if (youtubeChannel !== undefined) {
    const ch = String(youtubeChannel).trim().slice(0, 200);
    if (ch) user.youtubeChannel = ch;
    else delete user.youtubeChannel;
  }

  const saved: User = {
    ...user,
    profilePhotos: user.profilePhotos ? [...user.profilePhotos] : undefined,
    interests: user.interests ? [...user.interests] : undefined,
    favoriteGenres: user.favoriteGenres ? [...user.favoriteGenres] : undefined,
    favoriteArtists: user.favoriteArtists ? [...user.favoriteArtists] : undefined,
    connectedPlatforms: user.connectedPlatforms ? [...user.connectedPlatforms] : undefined,
  };
  db.users.set(userId, saved);
  invalidateProfileCache(userId);
  schedulePersistUserToPg(saved);
  schedulePersist();
  res.json({ user: publicProfile(saved, true, saved.id) });
});

authRouter.patch('/ghost-mode', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  user.isGhostMode = Boolean(req.body.isGhostMode);
  db.users.set(userId, user);
  schedulePersist();
  res.json({ isGhostMode: user.isGhostMode });
});

/** Vérification disponibilité du pseudo (sans auth) */
authRouter.get('/check-username', (req: Request, res: Response) => {
  const username = String(req.query.username || '').trim();
  if (username.length < 2) {
    res.json({ available: false, reason: 'Pseudo trop court (min. 2 caractères)' });
    return;
  }
  if (username.length > 30) {
    res.json({ available: false, reason: 'Pseudo trop long (max. 30 caractères)' });
    return;
  }
  if (!/^[a-zA-Z0-9_\-.àâäéèêëîïôùûüç]+$/i.test(username)) {
    res.json({ available: false, reason: 'Caractères non autorisés dans le pseudo' });
    return;
  }
  const taken = Boolean(db.users.findByUsernameLower(username));
  res.json({ available: !taken, reason: taken ? 'Ce pseudo n\'est pas disponible' : null });
});

/** Changement de mot de passe */
authRouter.post('/change-password', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    return;
  }
  let valid: boolean;
  try {
    valid = await bcrypt.compare(currentPassword, user.passwordHash);
  } catch {
    res.status(500).json({ error: 'Erreur interne' });
    return;
  }
  if (!valid) {
    res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    return;
  }
  try {
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.mustChangePassword = false;
    bumpUserTokenVersion(user);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du mot de passe' });
    return;
  }
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({ ok: true, user: publicProfile(user, true, user.id) });
});

/** Suppression du compte */
authRouter.delete('/account', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  const { password, confirmation } = req.body ?? {};
  const oauthOnly = isOAuthOnlyPasswordHash(user.passwordHash);

  if (oauthOnly) {
    if (confirmation !== 'SUPPRIMER') {
      res.status(400).json({ error: 'Tapez SUPPRIMER pour confirmer la suppression' });
      return;
    }
  } else {
    if (!password) {
      res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
      return;
    }
    let deleteValid: boolean;
    try {
      deleteValid = await bcrypt.compare(password, user.passwordHash);
    } catch {
      res.status(500).json({ error: 'Erreur interne' });
      return;
    }
    if (!deleteValid) {
      res.status(400).json({ error: 'Mot de passe incorrect' });
      return;
    }
  }
  // RGPD : révoquer le jeton OAuth YouTube auprès de Google avant la cascade de
  // suppression, plutôt que de simplement le supprimer en base (voir audit RGPD-3).
  if (isPlatformConnected(user, 'youtube')) {
    try {
      await revokeAndDisconnectYoutube(user);
    } catch (e) {
      console.warn('[account-deletion] révocation YouTube échouée (suppression du compte poursuivie):', e);
    }
  }

  await prepareUserAccountDeletion(userId);
  deleteUserAccountCascade(userId);
  schedulePersist();
  res.json({ ok: true });
});

authRouter.post('/complete-onboarding', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  user.onboardingCompleted = true;
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({ user: publicProfile(user, true, user.id) });
});

/** Vérification de l'adresse e-mail via token */
authRouter.get('/verify-email', (req: Request, res: Response) => {
  const token = String(req.query.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: 'Token manquant' });
    return;
  }
  const user = [...db.users.values()].find((u) => u.verificationToken === token);
  if (!user) {
    res.status(400).json({ error: 'Token de vérification invalide ou déjà utilisé' });
    return;
  }
  if (user.verificationTokenExpiry && Date.now() > user.verificationTokenExpiry) {
    res.status(400).json({ error: 'Token de vérification expiré. Contacte le support pour en recevoir un nouveau.' });
    return;
  }
  user.emailVerified = true;
  delete user.verificationToken;
  delete user.verificationTokenExpiry;
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({ ok: true, message: 'Adresse e-mail vérifiée avec succès !' });
});

/** Demande de réinitialisation de mot de passe */
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Adresse e-mail requise' });
    return;
  }
  // Always return 200 to avoid email enumeration
  const user = db.users.findByEmailLower(email);
  if (!user) {
    res.json({ ok: true });
    return;
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1h
  user.resetToken = resetTokenHash; // stocker le hash en DB, jamais le token brut
  user.resetTokenExpiry = resetTokenExpiry;
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  const appUrl = process.env.WEB_APP_URL ?? 'https://getsoundy.com';
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`; // envoyer le token brut par email
  void sendPasswordResetEmail({ toEmail: user.email, username: user.username, resetUrl });

  res.json({ ok: true });
});

/** Réinitialisation du mot de passe avec token */
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    return;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    return;
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = [...db.users.values()].find((u) => u.resetToken === tokenHash);
  if (!user) {
    res.status(400).json({ error: 'Token invalide ou déjà utilisé' });
    return;
  }
  if (user.resetTokenExpiry && Date.now() > user.resetTokenExpiry) {
    res.status(400).json({ error: 'Token expiré. Refais une demande de réinitialisation.' });
    return;
  }
  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du mot de passe' });
    return;
  }
  user.passwordHash = passwordHash;
  bumpUserTokenVersion(user);
  delete user.resetToken;
  delete user.resetTokenExpiry;
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({ ok: true, message: 'Mot de passe réinitialisé avec succès !' });
});
