import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, User, ListeningRole, RelationshipStatus } from '../models/schema';
import { authenticateJWT, signToken } from '../middleware/auth';
import { applyProfileDefaults, publicProfile, syncProfilePhotos, MAX_PROFILE_PHOTOS } from '../lib/profile';
import { applyPrivacySettings } from '../lib/locationPrivacy';
import { ensurePlatformAccountsFromLegacy } from '../lib/platformConnect';
import { schedulePersist } from '../lib/persist';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Champs requis manquants' });
    return;
  }
  const exists = [...db.users.values()].some((u) => u.email === email || u.username === username);
  if (exists) {
    res.status(400).json({ error: 'Utilisateur déjà existant' });
    return;
  }
  let user: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    memberSince: Date.now(),
  };
  user = applyProfileDefaults(user);
  db.users.set(user.id, user);
  const token = signToken({ id: user.id, username: user.username });
  res.status(201).json({ token, user: publicProfile(user, true, user.id) });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(400).json({ error: 'Identifiants invalides' });
    return;
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  db.users.set(user.id, user);
  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, user: publicProfile(user, true, user.id) });
});

authRouter.get('/me', authenticateJWT, (req: Request, res: Response) => {
  const user = db.users.get((req as Request & { user: { id: string } }).user.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  applyProfileDefaults(user);
  ensurePlatformAccountsFromLegacy(user);
  db.users.set(user.id, user);
  res.json({ user: publicProfile(user, true, user.id) });
});

authRouter.get('/profile/:userId', authenticateJWT, (req: Request, res: Response) => {
  const user = db.users.get(req.params.userId);
  if (!user) {
    res.status(404).json({ error: 'Profil introuvable' });
    return;
  }
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ user: publicProfile(user, user.id === me, me) });
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
    avatarUrl,
    profilePhotos,
    relationshipStatus,
    shareDistance,
    locationPrecision,
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
  if (relationshipStatus === null || relationshipStatus === '') {
    delete user.relationshipStatus;
  } else if (relationshipStatus === 'celibataire' || relationshipStatus === 'en_couple') {
    user.relationshipStatus = relationshipStatus as RelationshipStatus;
  }
  if (shareDistance !== undefined || locationPrecision !== undefined) {
    applyPrivacySettings(user, { shareDistance, locationPrecision });
  }

  if (Array.isArray(profilePhotos)) {
    syncProfilePhotos(user, profilePhotos.map(String));
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

  const saved: User = {
    ...user,
    profilePhotos: user.profilePhotos ? [...user.profilePhotos] : undefined,
    interests: user.interests ? [...user.interests] : undefined,
    favoriteGenres: user.favoriteGenres ? [...user.favoriteGenres] : undefined,
    favoriteArtists: user.favoriteArtists ? [...user.favoriteArtists] : undefined,
    connectedPlatforms: user.connectedPlatforms ? [...user.connectedPlatforms] : undefined,
  };
  db.users.set(userId, saved);
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
