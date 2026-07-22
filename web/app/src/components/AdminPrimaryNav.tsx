import { AdminScrollTabBar } from './AdminScrollTabBar';

export type AdminPrimaryTabId =
  | 'accounts'
  | 'access'
  | 'content'
  | 'analytics'
  | 'support'
  | 'sponsors'
  | 'agents'
  | 'integrations';

export type AdminPrimaryTab = {
  id: AdminPrimaryTabId;
  label: string;
  shortLabel?: string;
  icon: string;
  hint?: string;
};

export function AdminPrimaryNav({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
}: {
  tabs: AdminPrimaryTab[];
  activeTab: AdminPrimaryTabId;
  onChange: (id: AdminPrimaryTabId) => void;
  ariaLabel: string;
}) {
  return (
    <AdminScrollTabBar className="-mx-4 px-4" aria-label={ariaLabel} variant="underline">
      {tabs.map((item) => {
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            title={item.hint ?? item.label}
            className={`relative shrink-0 min-h-11 px-3 sm:px-4 py-2.5 text-xs font-bold whitespace-nowrap transition touch-manipulation ${
              active ? 'text-purple-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="text-sm leading-none opacity-90" aria-hidden>
                {item.icon}
              </span>
              <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </span>
            {active ? (
              <span
                className="absolute bottom-0 left-2 right-2 sm:left-3 sm:right-3 h-0.5 bg-purple-500 rounded-full"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </AdminScrollTabBar>
  );
}
