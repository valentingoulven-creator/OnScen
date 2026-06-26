import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminScrollTabBar } from '../components/AdminScrollTabBar';
import { AdminAccountsTab } from './AdminAccountsTab';
import { AdminAccessTab } from './AdminAccessTab';
import { AdminContentTab } from './AdminContentTab';
import { AdminSupportTab, type SupportSubTab } from './AdminSupportTab';
import { AdminSponsorsTab } from './AdminSponsorsTab';
import { AdminAgentsTab } from './AdminAgentsTab';
import { AnalyticsPage, type AnalyticsSubTab } from './AnalyticsPage';

type AdminTab = 'accounts' | 'access' | 'content' | 'analytics' | 'support' | 'sponsors' | 'agents';
/** Legacy aliases — reports → Support ; costs → Analytics → Coûts */
type AdminInitialTab = AdminTab | 'reports' | 'costs';

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

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'accounts', label: t('admin.tabs.accounts') },
    { id: 'access', label: t('admin.tabs.access') },
    { id: 'content', label: t('admin.tabs.content') },
    { id: 'analytics', label: t('admin.tabs.analytics') },
    { id: 'support', label: t('admin.tabs.support') },
    { id: 'sponsors', label: t('admin.tabs.sponsors') },
    { id: 'agents', label: t('admin.tabs.agents') },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0b0b0f] text-white">
      <header className="shrink-0 z-10 bg-[#0b0b0f]/95 border-b border-[#1e1e2f] px-4 py-3 ms-safe-area-top">
        <div className="flex items-center gap-3 max-w-lg mx-auto min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} className="text-purple-400 text-sm shrink-0">
              ←
            </button>
          )}
          <h1 className="text-lg font-bold flex-1 min-w-0 truncate">{t('admin.title')}</h1>
        </div>
        <AdminScrollTabBar className="mt-3 -mx-4 px-4" aria-label={t('admin.title')}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 px-2.5 py-1.5 min-h-8 sm:px-4 sm:py-2 sm:min-h-0 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition ${
                tab === item.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1a1a26] text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </AdminScrollTabBar>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 max-w-lg mx-auto w-full pb-6">
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
