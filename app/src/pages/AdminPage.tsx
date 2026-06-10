import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAccountsTab } from './AdminAccountsTab';
import { AdminAccessTab } from './AdminAccessTab';
import { AnalyticsPage } from './AnalyticsPage';

type AdminTab = 'accounts' | 'access' | 'analytics';

interface AdminPageProps {
  onBack?: () => void;
  initialTab?: AdminTab;
}

export function AdminPage({ onBack, initialTab = 'accounts' }: AdminPageProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>(initialTab);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'accounts', label: t('admin.tabs.accounts') },
    { id: 'access', label: t('admin.tabs.access') },
    { id: 'analytics', label: t('admin.tabs.analytics') },
  ];

  return (
    <div className="flex flex-col h-full min-h-dvh bg-[#0b0b0f] text-white">
      <header className="sticky top-0 z-10 bg-[#0b0b0f]/95 border-b border-[#1e1e2f] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {onBack && (
            <button type="button" onClick={onBack} className="text-purple-400 text-sm shrink-0">
              ←
            </button>
          )}
          <h1 className="text-lg font-bold flex-1">{t('admin.title')}</h1>
        </div>
        <nav
          className="flex gap-1 mt-3 max-w-lg mx-auto overflow-x-auto"
          aria-label={t('admin.title')}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                tab === item.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1a1a26] text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {tab === 'accounts' && <AdminAccountsTab />}
        {tab === 'access' && <AdminAccessTab />}
        {tab === 'analytics' && <AnalyticsPage embedded />}
      </div>
    </div>
  );
}
