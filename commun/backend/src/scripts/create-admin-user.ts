/**
 * Crée ou met à jour un compte administrateur (mot de passe temporaire + changement obligatoire à la connexion).
 *
 * Usage msdev (depuis commun/backend/) :
 *   $env:ADMIN_EMAIL='admin@getsoundy.com'; $env:ADMIN_PASSWORD='Bonjour123!'; npx ts-node src/scripts/create-admin-user.ts
 *
 * Usage production (VPS) :
 *   ADMIN_EMAIL=admin@getsoundy.com ADMIN_PASSWORD='...' APP_ENV=production node dist/commun/scripts/create-admin-user.js
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { db, type User } from '../models/schema';
import { applyProfileDefaults } from '../lib/profile';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import {
  loadPersistedStoreAsync,
  savePersistedStore,
  usesPostgresPersistence,
} from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { closePool } from '../db/pool';
import { getMsdevEnvPath } from '../paths';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: getMsdevEnvPath() });

const email = (
  process.env.ADMIN_EMAIL ||
  process.env.PROD_ADMIN_EMAIL ||
  'admin@getsoundy.com'
)
  .trim()
  .toLowerCase();
const password = (process.env.ADMIN_PASSWORD || process.env.PROD_ADMIN_PASSWORD || '').trim();
const username = (
  process.env.ADMIN_USERNAME ||
  process.env.PROD_ADMIN_USERNAME ||
  email.split('@')[0] ||
  'admin'
).trim();

async function main(): Promise<void> {
  if (!password) {
    console.error('[create-admin] ADMIN_PASSWORD ou PROD_ADMIN_PASSWORD requis.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('[create-admin] Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  const loaded = await loadPersistedStoreAsync();
  console.log(
    `[create-admin] Store ${loaded ? 'chargé' : 'vide'} — ${db.users.size} utilisateur(s) en mémoire`
  );

  const existing = [...db.users.values()].find((u) => u.email === email);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.isAdmin = true;
    existing.mustChangePassword = true;
    existing.accountStatus = 'active';
    existing.emailVerified = true;
    existing.onboardingCompleted = true;
    if (!existing.acceptedTermsAt) {
      existing.acceptedTermsAt = Date.now();
      existing.acceptedTermsVersion = CURRENT_TERMS_VERSION;
    }
    db.users.set(existing.id, existing);
    console.log(`[create-admin] Compte admin mis à jour : ${email} (${existing.id})`);
  } else {
    let user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username,
      email,
      passwordHash,
      isAdmin: true,
      mustChangePassword: true,
      accountStatus: 'active',
      emailVerified: true,
      onboardingCompleted: true,
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
    console.log(`[create-admin] Compte admin créé : ${email} (${user.id})`);
  }

  if (usesPostgresPersistence()) {
    await savePersistedStoreToPostgres();
    console.log('[create-admin] Persisté dans PostgreSQL.');
  } else {
    savePersistedStore();
    console.log('[create-admin] Persisté dans store.json (msdev).');
  }

  console.log('[create-admin] Connexion possible — changement de mot de passe requis à la première connexion.');
}

main()
  .catch((err) => {
    console.error('[create-admin] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
