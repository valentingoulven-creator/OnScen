import type { AdminPrimaryTabId } from '../components/AdminPrimaryNav';

export type StaffRole = 'admin' | 'dev';

/** Onglets accessibles aux comptes Admin opérationnels. */
export const ADMIN_OPERATIONAL_TAB_IDS: AdminPrimaryTabId[] = [
  'accounts',
  'content',
  'support',
  'sponsors',
];

/** Onglets réservés aux comptes Dev (infra, accès, analytics, agents). */
export const ADMIN_DEV_ONLY_TAB_IDS: AdminPrimaryTabId[] = [
  'access',
  'analytics',
  'agents',
];

export function resolveStaffRole(user: {
  staffRole?: StaffRole | null;
  isAdmin?: boolean;
} | null | undefined): StaffRole | null {
  if (!user) return null;
  if (user.staffRole === 'admin' || user.staffRole === 'dev') return user.staffRole;
  if (user.isAdmin) return 'dev';
  return null;
}

export function isAdminTabAllowed(tab: AdminPrimaryTabId, role: StaffRole | null | undefined): boolean {
  if (role === 'dev') return true;
  if (role === 'admin') return ADMIN_OPERATIONAL_TAB_IDS.includes(tab);
  return false;
}

export function filterAdminTabs<T extends { id: AdminPrimaryTabId }>(
  tabs: T[],
  role: StaffRole | null | undefined
): T[] {
  return tabs.filter((tab) => isAdminTabAllowed(tab.id, role));
}
