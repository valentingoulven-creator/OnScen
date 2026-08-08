import bcrypt from 'bcryptjs';
import { db, type User } from './models/schema';
import { applyProfileDefaults } from './lib/profile';
import { CURRENT_TERMS_VERSION } from './lib/legalConstants';
import { schedulePersist } from './lib/persist';
import { maskEmail } from './lib/maskPii';

/**
 * Premier démarrage production : crée un admin si PROD_ADMIN_EMAIL / PROD_ADMIN_PASSWORD sont définis.
 */
export async function seedProductionAdmin(): Promise<boolean> {
  if (db.users.size > 0) return false;

  const email = process.env.PROD_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PROD_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    console.warn(
      '[onscen] Base vide — inscrivez-vous via l’app ou définissez PROD_ADMIN_EMAIL et PROD_ADMIN_PASSWORD dans .env'
    );
    return false;
  }

  const username = process.env.PROD_ADMIN_USERNAME?.trim() || email.split('@')[0] || 'admin';
  const passwordHash = await bcrypt.hash(password, 10);
  let user: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username,
    email,
    passwordHash,
    isAdmin: true,
    staffRole: 'dev' as const,
    mustChangePassword: true,
    emailVerified: true,
    onboardingCompleted: true,
    accountStatus: 'active',
    avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}`,
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    memberSince: Date.now(),
    acceptedTermsAt: Date.now(),
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
  };
  user = applyProfileDefaults(user);
  db.users.set(user.id, user);
  schedulePersist();
  console.log(`[onscen] Compte administrateur initial créé : ${maskEmail(email)}`);
  return true;
}
