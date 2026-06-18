import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, User, ListeningRole } from '../models/schema';
import { authenticateJWT, signToken } from '../middleware/auth';
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
import {
  ensurePlatformAccountsFromLegacy,
  migratePlaintextPlatformTokens,
} from '../lib/platformConnect';
import { schedulePersist } from '../lib/persist';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import { buildUserDataExport } from '../lib/accountDataExport';
import { deleteUserAccountCascade } from '../lib/accountDeletion';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import { isValidProfileType } from '../lib/profileTypes';
import {
  assertRegistrationAllowed,
  consumeInviteCode,
  getAccessPolicy,
  loginAccessDeniedReason,
  resolveInitialAccountStatus,
} from '../lib/accessControl';
import { isOAuthOnlyPasswordHash } from '../lib/oauthAccount';

export const authRouter = Router();

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

authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, acceptTerms, termsVersion, inviteCode } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Champs requis manquants' });
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
  if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
    res.status(400).json({
      error: 'Les conditions ont été mises à jour. Rechargez la page et acceptez la nouvelle version.',
    });
    return;
  }
  const exists = [...db.users.values()].some((u) => u.email === email || u.username === username);
  if (exists) {
    res.status(400).json({ error: 'Utilisateur déjà existant' });
    return;
  }
  const accountStatus = resolveInitialAccountStatus();
  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(password, 10);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la création du compte' });
    return;
  }
  let user: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
    accountStatus,
  };
  user = applyProfileDefaults(user);
  if (getAccessPolicy().registrationMode === 'invite_only' && inviteCode) {
    consumeInviteCode(String(inviteCode));
  }
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();

  if (accountStatus === 'pending') {
    res.status(202).json({
      pending: true,
      message:
        'Inscription enregistrée. Un administrateur doit valider votre compte avant la première connexion.',
      user: publicProfile(user, true, user.id),
    });
    return;
  }

  const token = signToken({ id: user.id, username: user.username });
  res.status(201).json({ token, user: publicProfile(user, true, user.id) });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user) {
    res.status(400).json({ error: 'Identifiants invalides' });
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
    res.status(400).json({ error: 'Identifiants invalides' });
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
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  migratePlaintextPlatformTokens(user);
  db.users.set(user.id, user);
  const stayLoggedIn = rememberMe !== false;
  const token = signToken({ id: user.id, username: user.username }, stayLoggedIn);
  trackEvent('user_login', user.id);
  trackUserActive(user.id);
  res.json({ token, user: publicProfile(user, true, user.id), rememberMe: stayLoggedIn });
});

authRouter.get('/me', authenticateJWT, (req: Request, res: Response) => {
  const user = db.users.get((req as Request & { user: { id: string } }).user.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  migratePlaintextPlatformTokens(user);
  db.users.set(user.id, user);
  res.json({ user: publicProfile(user, true, user.id) });
});

authRouter.get('/me/export', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  applyProfileDefaults(user);
  const exportData = buildUserDataExport(user);
  const filename = `melosong-export-${user.username.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.json`;
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

authRouter.patch('/profile', authenticateJWT, (req: Request, res: Response) => {
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
    shareDistance,
    locationPrecision,
    usernameColor,
    usernameWaveFrom,
    usernameWaveTo,
    instagramHandle,
    youtubeChannel,
    spotifyUrl,
  } = req.body;

  if (username && typeof username === 'string') {
    const name = username.trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Le pseudo doit faire au moins 2 caractères' });
      return;
    }
    const taken = [...db.users.values()].some((u) => u.id !== userId && u.username === name);
    if (taken) {
      res.status(400).json({ error: 'Ce pseudo est déjà pris' });
      return;
    }
    user.username = name;
  }
  if (bio !== undefined) user.bio = String(bio).slice(0, 500);
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
    /** Base64 d'une photo compressée max 2 Mo ≈ 2,8 M de caractères (facteur 4/3). */
    const MAX_PHOTO_CHARS = Math.ceil(2 * 1024 * 1024 * (4 / 3)) + 64;
    const incoming = profilePhotos.map(String);
    const oversized = incoming.find((p) => p.startsWith('data:image/') && p.length > MAX_PHOTO_CHARS);
    if (oversized) {
      res.status(413).json({ error: 'Chaque photo ne peut pas dépasser 2 Mo.' });
      return;
    }
    const intendedCount = countPersistableProfilePhotos(incoming);
    syncProfilePhotos(user, sanitizeIncomingProfilePhotos(incoming));
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
    const url = avatarUrl.trim().slice(0, 2000);
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
  if (spotifyUrl !== undefined) {
    const url = String(spotifyUrl).trim().slice(0, 500);
    if (url) user.spotifyUrl = url;
    else delete user.spotifyUrl;
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
  if (!/^[a-zA-Z0-9_\-\.àâäéèêëîïôùûüç]+$/i.test(username)) {
    res.json({ available: false, reason: 'Caractères non autorisés dans le pseudo' });
    return;
  }
  const taken = [...db.users.values()].some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  res.json({ available: !taken, reason: taken ? 'Ce pseudo est déjà pris' : null });
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
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  } catch {
    res.status(500).json({ error: 'Erreur interne lors de la mise à jour du mot de passe' });
    return;
  }
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  res.json({ ok: true });
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
  deleteUserAccountCascade(userId);
  schedulePersist();
  res.json({ ok: true });
});
