import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { AdminPrimaryNav, type AdminPrimaryTab, type AdminPrimaryTabId } from '../components/AdminPrimaryNav';
import { filterAdminTabs, isAdminTabAllowed, resolveStaffRole } from '../lib/adminStaffRoles';
import { AdminAccountsTab } from './AdminAccountsTab';
import { AdminAccessTab } from './AdminAccessTab';
import { AdminContentTab } from './AdminContentTab';
import { AdminSupportTab, type SupportSubTab } from './AdminSupportTab';
import { AdminSponsorsTab } from './AdminSponsorsTab';
import { AdminAgentsTab } from './AdminAgentsTab';
import { AnalyticsPage, type AnalyticsSubTab } from './AnalyticsPage';

type AdminTab = AdminPrimaryTabId;
/** Legacy aliases — reports → Support ; costs / donations → Analytics */
type AdminInitialTab = AdminTab | 'reports' | 'costs' | 'donations';

function resolveInitialTab(initialTab: AdminInitialTab): {
  tab: AdminTab;
  supportSubTab: SupportSubTab;
  analyticsSubTab: AnalyticsSubTab;
} {
  if (initialTab === 'reports') {
    return { tab: 'support', supportSubTab: 'reports', analyticsSubTab: 'overview' };
  }
  if (initialTab === 'costs') {
    return { tab: 'analytics', supportSubTab: 'messages', analyticsSubTab: 'costs' };
  }
  if (initialTab === 'donations') {
    return { tab: 'analytics', supportSubTab: 'messages', analyticsSubTab: 'donations' };
  }
  return { tab: initialTab, supportSubTab: 'messages', analyticsSubTab: 'overview' };
}

interface AdminPageProps {
  onBack?: () => void;
  initialTab?: AdminInitialTab;
  highlightSupportMessageId?: string;
  onOpenSalon?: (salonId: string, salonTitle?: string) => void;
}

export function AdminPage({
  onBack,
  initialTab = 'accounts',
  highlightSupportMessageId,
  onOpenSalon,
}: AdminPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const staffRole = resolveStaffRole(user);
  const resolved = resolveInitialTab(initialTab);
  const [tab, setTab] = useState<AdminTab>(resolved.tab);
  const [supportSubTab, setSupportSubTab] = useState<SupportSubTab>(resolved.supportSubTab);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<AnalyticsSubTab>(resolved.analyticsSubTab);

  useEffect(() => {
    const next = resolveInitialTab(initialTab);
    setTab(next.tab);
    setSupportSubTab(next.supportSubTab);
    setAnalyticsSubTab(next.analyticsSubTab);
  }, [initialTab]);

  const tabs = useMemo(
    (): AdminPrimaryTab[] => [
      {
        id: 'accounts',
        icon: '👤',
        label: t('admin.tabs.accounts'),
        hint: t('admin.tabHints.accounts'),
      },
      {
        id: 'access',
        icon: '🔐',
        label: t('admin.tabs.access'),
        hint: t('admin.tabHints.access'),
      },
      {
        id: 'content',
        icon: '📁',
        label: t('admin.tabs.content'),
        hint: t('admin.tabHints.content'),
      },
      {
        id: 'analytics',
        icon: '📊',
        label: t('admin.tabs.analytics'),
        shortLabel: t('admin.tabs.analyticsShort'),
        hint: t('admin.tabHints.analytics'),
      },
      {
        id: 'support',
        icon: '💬',
        label: t('admin.tabs.support'),
        hint: t('admin.tabHints.support'),
      },
      {
        id: 'sponsors',
        icon: '⭐',
        label: t('admin.tabs.sponsors'),
        hint: t('admin.tabHints.sponsors'),
      },
      {
        id: 'agents',
        icon: '🤖',
        label: t('admin.tabs.agents'),
        shortLabel: t('admin.tabs.agentsShort'),
        hint: t('admin.tabHints.agents'),
      },
    ],
    [t],
  );

  const visibleTabs = useMemo(() => filterAdminTabs(tabs, staffRole), [tabs, staffRole]);

  useEffect(() => {
    if (!isAdminTabAllowed(tab, staffRole) && visibleTabs[0]) {
      setTab(visibleTabs[0].id);
    }
  }, [tab, staffRole, visibleTabs]);

  const activeMeta = visibleTabs.find((item) => item.id === tab) ?? visibleTabs[0] ?? tabs[0];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0b0b0f] text-white">
      <header className="shrink-0 z-10 bg-[#0b0b0f]/95 backdrop-blur-sm border-b border-[#1e1e2f] ms-safe-area-top">
        <div className="max-w-lg lg:max-w-5xl mx-auto w-full min-w-0 px-4 pt-3 pb-0">
          <div className="flex items-start gap-2 min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#14141c] border border-[#2a2a3a] text-purple-300 hover:text-white hover:border-purple-500/40 transition touch-manipulation"
                aria-label={t('admin.back')}
              >
                <span aria-hidden>←</span>
              </button>
            ) : null}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400/90">
                {staffRole === 'dev' ? t('admin.badgeDev', { defaultValue: 'Accès Dev' }) : t('admin.badge')}
              </p>
              <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">{t('admin.title')}</h1>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug truncate">
                {activeMeta.hint ?? activeMeta.label}
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-lg lg:max-w-5xl mx-auto w-full min-w-0 mt-2">
          <AdminPrimaryNav
            tabs={visibleTabs}
            activeTab={tab}
            onChange={setTab}
            ariaLabel={t('admin.navLabel')}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 max-w-lg lg:max-w-5xl mx-auto w-full pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {tab === 'accounts' && <AdminAccountsTab />}
        {tab === 'access' && <AdminAccessTab />}
        {tab === 'content' && <AdminContentTab onOpenSalon={onOpenSalon} />}
        {tab === 'analytics' && <AnalyticsPage embedded initialSubTab={analyticsSubTab} />}
        {tab === 'support' && (
          <AdminSupportTab
            highlightMessageId={highlightSupportMessageId}
            initialSubTab={supportSubTab}
          />
        )}
        {tab === 'sponsors' && <AdminSponsorsTab />}
        {tab === 'agents' && <AdminAgentsTab />}
      </div>
    </div>
  );
}
