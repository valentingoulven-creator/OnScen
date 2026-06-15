import { db, type User } from '../models/schema';
import { MSDEV_DEMO_EMAILS } from './msdevDemoAccounts';

export type AccountStatus = 'active' | 'pending' | 'blocked';

export type AccessRegistrationMode = 'open' | 'invite_only' | 'admin_approval' | 'closed';

export interface AccessPolicy {
  registrationMode: AccessRegistrationMode;
  updatedAt: number;
}

export interface AccessInviteCode {
  id: string;
  code: string;
  label?: string;
  createdAt: number;
  createdById?: string;
  maxUses: number;
  useCount: number;
  expiresAt?: number;
  disabled: boolean;
}

let policy: AccessPolicy = {
  registrationMode: 'open',
  updatedAt: Date.now(),
};

const inviteCodes = new Map<string, AccessInviteCode>();

/** Activé via MSDEV_PUBLIC_TUNNEL=1 ou ACCESS_CONTROL_ENABLED=1 */
export function isAccessControlEnabled(): boolean {
  return (
    process.env.ACCESS_CONTROL_ENABLED === '1' ||
    process.env.MSDEV_PUBLIC_TUNNEL === '1'
  );
}

export function getTunnelStrictDefaultPolicy(): AccessPolicy {
  return {
    registrationMode: 'admin_approval',
    updatedAt: Date.now(),
  };
}

export function getAccessPolicy(): AccessPolicy {
  return { ...policy };
}

export function setAccessPolicy(next: Partial<AccessPolicy>): AccessPolicy {
  if (next.registrationMode) {
    policy = {
      registrationMode: next.registrationMode,
      updatedAt: Date.now(),
    };
  }
  return getAccessPolicy();
}

export function loadAccessControlFromPersist(
  savedPolicy?: AccessPolicy,
  savedCodes?: AccessInviteCode[]
): void {
  if (isAccessControlEnabled() && !savedPolicy) {
    policy = getTunnelStrictDefaultPolicy();
  } else if (savedPolicy?.registrationMode) {
    policy = { ...savedPolicy, updatedAt: savedPolicy.updatedAt ?? Date.now() };
  }
  inviteCodes.clear();
  for (const c of savedCodes ?? []) {
    if (c?.id && c.code) inviteCodes.set(c.id, { ...c });
  }
}

export function snapshotAccessControl(): {
  accessPolicy: AccessPolicy;
  accessInviteCodes: AccessInviteCode[];
} {
  return {
    accessPolicy: getAccessPolicy(),
    accessInviteCodes: [...inviteCodes.values()],
  };
}

export function getAccountStatus(user: User): AccountStatus {
  if (user.accountStatus === 'pending' || user.accountStatus === 'blocked') {
    return user.accountStatus;
  }
  return 'active';
}

export function isDemoAccount(user: User): boolean {
  return MSDEV_DEMO_EMAILS.includes(user.email as (typeof MSDEV_DEMO_EMAILS)[number]);
}

function isMsdevAccessEnv(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

function isProductionAccessEnv(): boolean {
  return process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function parseAdminEmails(): Set<string> {
  const raw = process.env.ACCESS_ADMIN_EMAILS?.trim();
  const defaults = isMsdevAccessEnv() ? ['listener@msdev.local', 'dj@msdev.local'] : [];
  const list = raw ? raw.split(/[,;]/).map((e) => e.trim().toLowerCase()).filter(Boolean) : defaults;
  return new Set(list);
}

function parseAdminUsernames(): Set<string> {
  const raw = process.env.ACCESS_ADMIN_USERNAMES?.trim();
  const defaults = isMsdevAccessEnv() ? ['soundy_dev'] : [];
  const list = raw
    ? raw.split(/[,;]/).map((u) => u.trim().toLowerCase()).filter(Boolean)
    : defaults;
  return new Set(list);
}

const adminEmails = () => parseAdminEmails();
const adminUsernames = () => parseAdminUsernames();

export function isAccessAdmin(user: User | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (isProductionAccessEnv()) return false;
  if (adminUsernames().has(user.username.trim().toLowerCase())) return true;
  return adminEmails().has(user.email.trim().toLowerCase());
}

/** Compte développeur / super-admin (alias public de isAccessAdmin). */
export function isDevUser(user: User | undefined): boolean {
  return isAccessAdmin(user);
}

/** Comptes autorisés à utiliser l'API (hors routes publiques d'auth). */
export function canUserUseApp(user: User): boolean {
  if (!isAccessControlEnabled()) return true;
  if (isAccessAdmin(user)) return true;
  if (isDemoAccount(user) && getAccountStatus(user) !== 'blocked') return true;
  return getAccountStatus(user) === 'active';
}

export function getPublicAccessConfig() {
  const p = getAccessPolicy();
  return {
    enabled: isAccessControlEnabled(),
    registrationMode: isAccessControlEnabled() ? p.registrationMode : 'open',
    inviteRequired: isAccessControlEnabled() && p.registrationMode === 'invite_only',
    registrationClosed:
      isAccessControlEnabled() &&
      (p.registrationMode === 'closed' || p.registrationMode === 'admin_approval'),
    adminApprovalRequired:
      isAccessControlEnabled() && p.registrationMode === 'admin_approval',
  };
}

export function assertRegistrationAllowed(body: {
  inviteCode?: string;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (!isAccessControlEnabled()) return { ok: true };

  const mode = getAccessPolicy().registrationMode;
  if (mode === 'closed') {
    return {
      ok: false,
      status: 403,
      error: 'Les inscriptions sont fermées. Demandez une invitation à l’administrateur.',
    };
  }
  if (mode === 'admin_approval') {
    return { ok: true };
  }
  if (mode === 'invite_only') {
    const code = String(body.inviteCode ?? '').trim();
    if (!code) {
      return {
        ok: false,
        status: 400,
        error: 'Code d’invitation requis pour créer un compte.',
      };
    }
    const valid = validateInviteCode(code);
    if (!valid.ok) {
      return { ok: false, status: 400, error: valid.error };
    }
    return { ok: true };
  }
  return { ok: true };
}

export function resolveInitialAccountStatus(): AccountStatus {
  if (!isAccessControlEnabled()) return 'active';
  if (getAccessPolicy().registrationMode === 'admin_approval') return 'pending';
  return 'active';
}

export function validateInviteCode(rawCode: string): { ok: true; invite: AccessInviteCode } | { ok: false; error: string } {
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return { ok: false, error: 'Code d’invitation invalide.' };
  const invite = [...inviteCodes.values()].find(
    (c) => !c.disabled && c.code.toUpperCase() === normalized
  );
  if (!invite) return { ok: false, error: 'Code d’invitation inconnu ou expiré.' };
  if (invite.expiresAt != null && invite.expiresAt < Date.now()) {
    return { ok: false, error: 'Ce code d’invitation a expiré.' };
  }
  if (invite.useCount >= invite.maxUses) {
    return { ok: false, error: 'Ce code d’invitation a atteint sa limite d’utilisation.' };
  }
  return { ok: true, invite };
}

export function consumeInviteCode(rawCode: string): boolean {
  const check = validateInviteCode(rawCode);
  if (!check.ok) return false;
  const invite = inviteCodes.get(check.invite.id);
  if (!invite) return false;
  invite.useCount += 1;
  inviteCodes.set(invite.id, invite);
  return true;
}

export function listInviteCodes(): AccessInviteCode[] {
  return [...inviteCodes.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function createInviteCode(input: {
  code?: string;
  label?: string;
  maxUses?: number;
  expiresAt?: number;
  createdById?: string;
}): AccessInviteCode {
  const code =
    (input.code?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') ||
      `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const invite: AccessInviteCode = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    code,
    label: input.label?.trim().slice(0, 80),
    createdAt: Date.now(),
    createdById: input.createdById,
    maxUses: Math.max(1, Math.min(500, Number(input.maxUses) || 1)),
    useCount: 0,
    expiresAt: input.expiresAt,
    disabled: false,
  };
  inviteCodes.set(invite.id, invite);
  return invite;
}

export function setInviteCodeDisabled(id: string, disabled: boolean): AccessInviteCode | null {
  const invite = inviteCodes.get(id);
  if (!invite) return null;
  invite.disabled = disabled;
  inviteCodes.set(id, invite);
  return invite;
}

export function deleteInviteCode(id: string): boolean {
  return inviteCodes.delete(id);
}

export function setUserAccountStatus(userId: string, status: AccountStatus): User | null {
  const user = db.users.get(userId);
  if (!user) return null;
  user.accountStatus = status;
  db.users.set(userId, user);
  return user;
}

function wouldRetainAdminWithoutFlag(user: User): boolean {
  if (isProductionAccessEnv()) return false;
  if (adminUsernames().has(user.username.trim().toLowerCase())) return true;
  return adminEmails().has(user.email.trim().toLowerCase());
}

function countEffectiveAdmins(excludeUserId?: string, excludeFlag = false): number {
  return [...db.users.values()].filter((u) => {
    if (u.email.endsWith('@bot.local')) return false;
    if (excludeUserId && u.id === excludeUserId && excludeFlag) {
      return wouldRetainAdminWithoutFlag(u);
    }
    return isAccessAdmin(u);
  }).length;
}

/** Promouvoir ou rétrograder un compte (flag `isAdmin` persisté). */
export function setUserIsAdmin(
  userId: string,
  isAdmin: boolean
): User | { error: string; status: number } {
  const user = db.users.get(userId);
  if (!user || user.email.endsWith('@bot.local')) {
    return { error: 'Utilisateur introuvable', status: 404 };
  }
  if (!isAdmin) {
    if (!user.isAdmin) {
      return { error: 'Ce compte n’est pas administrateur', status: 400 };
    }
    if (countEffectiveAdmins(userId, true) < 1) {
      return { error: 'Impossible de retirer le dernier administrateur', status: 400 };
    }
    user.isAdmin = false;
  } else {
    user.isAdmin = true;
    if (getAccountStatus(user) !== 'active') {
      user.accountStatus = 'active';
    }
  }
  db.users.set(userId, user);
  return user;
}

export function ensureAccessAdmins(): number {
  let changed = 0;
  for (const user of db.users.values()) {
    if (!isAccessAdmin(user)) continue;
    let touch = false;
    if (!user.isAdmin) {
      user.isAdmin = true;
      touch = true;
    }
    if (getAccountStatus(user) !== 'active') {
      user.accountStatus = 'active';
      touch = true;
    }
    if (touch) {
      db.users.set(user.id, user);
      changed += 1;
    }
  }
  return changed;
}

export function loginAccessDeniedReason(user: User): string | null {
  if (!isAccessControlEnabled()) return null;
  if (canUserUseApp(user)) return null;
  if (getAccountStatus(user) === 'pending') {
    return 'Votre compte est en attente de validation par un administrateur.';
  }
  if (getAccountStatus(user) === 'blocked') {
    return 'Votre compte a été suspendu. Contactez l’administrateur.';
  }
  return 'Accès refusé.';
}

export function isMsdevShortcutBlocked(): boolean {
  return isAccessControlEnabled();
}
