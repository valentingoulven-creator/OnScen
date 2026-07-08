import bcrypt from 'bcryptjs';
import { db } from '../models/schema';
import { schedulePersist } from './persist';
import { CREATOR_MONETIZATION_MIN_AGE } from './ageGates';
import { MSDEV_LISTENER_ID } from '../seed-favorite-feed';
import { maskEmail } from './maskPii';

/** Compteur « Vous suivent » affiché pour listener@msdev.local (243k). */
export const MSDEV_LISTENER_FOLLOWERS_COUNT = 243_000;

/** Comptes démo msdev — mot de passe attendu : msdev123 */
export const MSDEV_DEMO_EMAILS = [
  'listener@msdev.local',
  'dj@msdev.local',
  'bass@msdev.local',
] as const;

export const MSDEV_DEMO_PASSWORD = 'msdev123';

/** Âge démo pour dons live / abonnements (≥ 18 ans). */
export const MSDEV_DEMO_AGE = 25;

/**
 * Après restauration du store persisté, réaligne les mots de passe démo
 * (inscription / changement manuel) pour que listener@msdev.local / msdev123 fonctionne.
 */
export async function ensureMsdevDemoCredentials(): Promise<void> {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return;

  const hash = await bcrypt.hash(MSDEV_DEMO_PASSWORD, 10);
  let changed = false;
  for (const user of db.users.values()) {
    if (!MSDEV_DEMO_EMAILS.includes(user.email as (typeof MSDEV_DEMO_EMAILS)[number])) continue;
    const ok = await bcrypt.compare(MSDEV_DEMO_PASSWORD, user.passwordHash);
    if (ok) continue;
    user.passwordHash = hash;
    db.users.set(user.id, user);
    changed = true;
    console.log(`[msdev] Mot de passe démo réinitialisé pour ${maskEmail(user.email)}`);
  }
  if (changed) schedulePersist();
}

/**
 * Après restauration du store persisté, réaligne le compteur « Vous suivent »
 * de l'auditeur démo (listener@msdev.local → 243k).
 */
/**
 * Après restauration du store persisté, assure que les comptes démo ont un âge
 * renseigné (sinon hostMonetizationEligible=false et les dons live restent masqués).
 */
export function ensureMsdevDemoMonetizationAges(): void {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return;

  let changed = false;
  for (const user of db.users.values()) {
    if (!MSDEV_DEMO_EMAILS.includes(user.email as (typeof MSDEV_DEMO_EMAILS)[number])) continue;
    if (typeof user.age === 'number' && user.age >= CREATOR_MONETIZATION_MIN_AGE) continue;
    user.age = MSDEV_DEMO_AGE;
    db.users.set(user.id, user);
    changed = true;
    console.log(`[msdev] Âge monétisation réinitialisé pour ${maskEmail(user.email)} (${MSDEV_DEMO_AGE} ans)`);
  }
  if (changed) schedulePersist();
}

export function ensureMsdevListenerFollowersCount(): void {
  if (process.env.APP_ENV !== 'msdev' && process.env.MSENV !== 'msdev') return;

  const user = db.users.get(MSDEV_LISTENER_ID);
  if (!user) return;
  if (user.favoritesCountOverride === MSDEV_LISTENER_FOLLOWERS_COUNT) return;

  user.favoritesCountOverride = MSDEV_LISTENER_FOLLOWERS_COUNT;
  db.users.set(user.id, user);
  schedulePersist();
  console.log(
    `[msdev] Compteur « Vous suivent » réinitialisé pour ${maskEmail(user.email)} (${MSDEV_LISTENER_FOLLOWERS_COUNT})`
  );
}
