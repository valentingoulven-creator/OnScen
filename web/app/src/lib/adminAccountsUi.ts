import type { AccessManagedUser, AccountStatus } from '../types';

export type PlatformPlanId = 'free' | 'onscen_plus' | 'onscen_ultra';

export const PLATFORM_PLAN_OPTIONS: { id: PlatformPlanId; labelKey: string }[] = [
  { id: 'free', labelKey: 'admin.accounts.platformPlanFree' },
  { id: 'onscen_plus', labelKey: 'admin.accounts.platformPlanPlus' },
  { id: 'onscen_ultra', labelKey: 'admin.accounts.platformPlanUltra' },
];

export const BLOCK_DURATION_OPTIONS: { days: number | null; labelKey: string }[] = [
  { days: 1, labelKey: 'admin.accounts.blockDays1' },
  { days: 7, labelKey: 'admin.accounts.blockDays7' },
  { days: 30, labelKey: 'admin.accounts.blockDays30' },
  { days: 90, labelKey: 'admin.accounts.blockDays90' },
  { days: null, labelKey: 'admin.accounts.blockPermanent' },
];

export function formatDate(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatIsoDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAuditAt(iso: string, locale: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusLabel(status: AccountStatus, t: (key: string) => string): string {
  if (status === 'active') return t('admin.accounts.statusActive');
  if (status === 'pending') return t('admin.accounts.statusPending');
  return t('admin.accounts.statusBlocked');
}

export function statusBadgeClass(status: AccountStatus): string {
  if (status === 'active') return 'bg-green-500/20 text-green-400';
  if (status === 'pending') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

export function platformPlanBadgeClass(planId: PlatformPlanId | undefined): string {
  if (planId === 'onscen_ultra') return 'bg-amber-500/20 text-amber-300';
  if (planId === 'onscen_plus') return 'bg-purple-500/20 text-purple-300';
  return 'bg-gray-500/20 text-gray-300';
}

export function resolvePlatformPlanLabel(
  user: AccessManagedUser,
  t: (key: string) => string
): string {
  if (user.platformPlanLabel) return user.platformPlanLabel;
  const planId = user.platformPlanId ?? 'free';
  const option = PLATFORM_PLAN_OPTIONS.find((p) => p.id === planId);
  return option ? t(option.labelKey) : t('admin.accounts.platformPlanFree');
}

export function formatBlockedUntil(ts: number | undefined, locale: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function blockDaysRemaining(blockedUntil: number | undefined): number | null {
  if (!blockedUntil) return null;
  const ms = blockedUntil - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatRelativeLastSeen(ts: number | undefined, locale: string): string {
  if (!ts) return '—';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return locale.startsWith('en') ? 'just now' : "à l'instant";
  if (mins < 60) return locale.startsWith('en') ? `${mins} min ago` : `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return locale.startsWith('en') ? `${hours} h ago` : `il y a ${hours} h`;
  return formatDateTime(ts, locale);
}

export function isBotEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith('@bot.local') || lower.includes('@bot.') || lower.includes('bot@');
}

export function relationshipLabel(
  u: AccessManagedUser,
  t: (key: string) => string
): string | undefined {
  if (u.relationshipStatus === 'celibataire') return t('admin.accounts.relationshipCelibataire');
  if (u.relationshipStatus === 'en_couple') return t('admin.accounts.relationshipEnCouple');
  if (u.relationshipStatusCustom) return u.relationshipStatusCustom;
  return undefined;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const AUDIT_ACTION_KEYS: Record<string, string> = {
  user_approve: 'admin.accounts.auditApprove',
  user_block: 'admin.accounts.auditBlock',
  user_unblock: 'admin.accounts.auditUnblock',
  user_promote_admin: 'admin.accounts.auditPromoteAdmin',
  user_promote_dev: 'admin.accounts.auditPromoteDev',
  user_demote_admin: 'admin.accounts.auditDemote',
  user_revoke_sessions: 'admin.accounts.auditRevokeSessions',
  user_resend_verification: 'admin.accounts.auditResendVerification',
};

export function auditActionLabel(action: string, t: (key: string) => string): string {
  const key = AUDIT_ACTION_KEYS[action];
  return key ? t(key) : action.replace(/_/g, ' ');
}
