import type { StaffRole } from './adminStaffRoles';

/** Sous-onglets de l’onglet admin unifié Statistiques & coûts. */
export type AnalyticsSubTab = 'platform' | 'insights' | 'activity' | 'vps' | 'costs' | 'donations';

/** Alias legacy (deep links, ancien libellé « Vue d’ensemble »). */
export type AnalyticsSubTabInput = AnalyticsSubTab | 'overview';

/**
 * `insights` = dashboard analytique avancé (croissance/engagement/contenu/
 * monétisation/technique/acquisition) sur dataset MOCKÉ — réservé Dev pour
 * ne pas exposer de chiffres de démonstration aux admins opérationnels.
 * Voir `src/data/mockAnalyticsDashboard.ts`.
 */
const DEV_SUB_TABS: AnalyticsSubTab[] = ['platform', 'insights', 'activity', 'vps', 'costs', 'donations'];
const ADMIN_SUB_TABS: AnalyticsSubTab[] = ['platform'];

export function normalizeAnalyticsSubTab(tab: AnalyticsSubTabInput): AnalyticsSubTab {
  if (tab === 'overview') return 'activity';
  return tab;
}

export function getAnalyticsSubTabsForRole(role: StaffRole | null | undefined): AnalyticsSubTab[] {
  if (role === 'dev') return DEV_SUB_TABS;
  if (role === 'admin') return ADMIN_SUB_TABS;
  return [];
}

export function isAnalyticsSubTabAllowed(
  subTab: AnalyticsSubTab,
  role: StaffRole | null | undefined
): boolean {
  return getAnalyticsSubTabsForRole(role).includes(subTab);
}

export function defaultAnalyticsSubTab(role: StaffRole | null | undefined): AnalyticsSubTab {
  void role;
  return 'platform';
}
