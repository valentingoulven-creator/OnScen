import { memo } from 'react';
import { TabIcon, type TabId } from './TabNavIcons';

type Tab = TabId;

interface MainTabNavProps {
  tab: Tab;
  liveViewActive: boolean;
  dmUnread: number;
  onSelectTab: (id: Tab) => void;
  /** Bottom bar (classic) or row under search (appa2). */
  placement?: 'bottom' | 'header';
  className?: string;
}

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['actualite', 'Accueil'],
  ['map', 'Carte'],
  ['live', 'Direct'],
  ['dm', 'Messages'],
  ['reels', 'Reels'],
];

const LEFT_TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['actualite', 'Accueil'],
  ['map', 'Carte'],
];

const CENTER_TAB: readonly [Tab, string] = ['live', 'Direct'];

const RIGHT_TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['dm', 'Messages'],
  ['reels', 'Reels'],
];

function isTabActive(id: Tab, tab: Tab, liveViewActive: boolean): boolean {
  return tab === id || (id === 'live' && liveViewActive);
}

/** Per-tab accent colors — inactive (muted tint) and active (icon + subtle bg). */
const TAB_ACCENT: Record<
  Tab,
  { inactive: string; active: string; headerInactive: string; headerActive: string }
> = {
  actualite: {
    inactive: 'text-purple-400/55 bg-purple-500/10',
    active: 'text-purple-400 bg-purple-500/18',
    headerInactive:
      'text-purple-400/55 bg-[#16161f] ring-1 ring-inset ring-purple-500/15 shadow-sm shadow-black/25 hover:text-purple-300 hover:bg-purple-500/10',
    headerActive: 'text-purple-400 bg-purple-500/15 ring-1 ring-inset ring-purple-500/30',
  },
  map: {
    inactive: 'text-cyan-400/55 bg-cyan-500/10',
    active: 'text-cyan-400 bg-cyan-500/18',
    headerInactive:
      'text-cyan-400/55 bg-[#16161f] ring-1 ring-inset ring-cyan-500/15 shadow-sm shadow-black/25 hover:text-cyan-300 hover:bg-cyan-500/10',
    headerActive: 'text-cyan-400 bg-cyan-500/15 ring-1 ring-inset ring-cyan-500/30',
  },
  live: {
    inactive: 'text-red-400/55 bg-red-500/10',
    active: 'text-red-400 bg-red-500/18',
    headerInactive:
      'text-red-400/55 bg-[#16161f] ring-1 ring-inset ring-red-500/15 shadow-sm shadow-black/25 hover:text-red-300 hover:bg-red-500/10',
    headerActive: 'text-red-400 bg-red-500/15 ring-1 ring-inset ring-red-500/30',
  },
  dm: {
    inactive: 'text-blue-400/55 bg-blue-500/10',
    active: 'text-blue-400 bg-blue-500/18',
    headerInactive:
      'text-blue-400/55 bg-[#16161f] ring-1 ring-inset ring-blue-500/15 shadow-sm shadow-black/25 hover:text-blue-300 hover:bg-blue-500/10',
    headerActive: 'text-blue-400 bg-blue-500/15 ring-1 ring-inset ring-blue-500/30',
  },
  reels: {
    inactive: 'text-pink-400/55 bg-pink-500/10',
    active: 'text-pink-400 bg-pink-500/18',
    headerInactive:
      'text-pink-400/55 bg-[#16161f] ring-1 ring-inset ring-pink-500/15 shadow-sm shadow-black/25 hover:text-pink-300 hover:bg-pink-500/10',
    headerActive: 'text-pink-400 bg-pink-500/15 ring-1 ring-inset ring-pink-500/30',
  },
};

function tabButtonClass(
  id: Tab,
  active: boolean,
  elevated: boolean,
  placement: 'bottom' | 'header',
): string {
  const width = 'shrink-0';
  const accent = TAB_ACCENT[id];

  if (placement === 'bottom') {
    const vinyl = id === 'live' && elevated ? ' ms-tab-vinyl-hub' : '';
    const pop = elevated ? ' ms-tab-rail-btn--elevated' : '';
    const base =
      `${width} ms-tab-rail-btn flex items-center justify-center w-[var(--tab-nav-btn-size)] h-[var(--tab-nav-btn-size)] rounded-full relative active:opacity-70 touch-manipulation${vinyl}${pop}`;
    return `${base} ${active ? accent.active : accent.inactive}`;
  }

  const base = `${width} flex items-center justify-center whitespace-nowrap rounded-full px-1 sm:px-1.5 py-2 sm:py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold relative transition-colors active:scale-[0.98] touch-manipulation`;
  return `${base} ${active ? accent.headerActive : accent.headerInactive}`;
}

function navPlacementClass(placement: 'bottom' | 'header'): string {
  if (placement === 'header') {
    return 'py-0.5 px-2 sm:px-3 -mt-1 bg-transparent';
  }
  return 'ms-tab-bar-bottom';
}

function navInnerClass(placement: 'bottom' | 'header'): string {
  if (placement === 'header') {
    return 'flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 max-w-full';
  }
  return 'ms-tab-rail';
}

function tabAriaLabel(id: Tab, label: string, dmUnread: number): string {
  if (id !== 'dm' || dmUnread <= 0) return label;
  const n = dmUnread > 99 ? 99 : dmUnread;
  return n === 1 ? 'Messages, 1 non lu' : `Messages, ${n} non lus`;
}

interface TabButtonProps {
  id: Tab;
  label: string;
  active: boolean;
  elevated: boolean;
  placement: 'bottom' | 'header';
  dmUnread: number;
  onSelectTab: (id: Tab) => void;
}

function TabButton({ id, label, active, elevated, placement, dmUnread, onSelectTab }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectTab(id)}
      className={tabButtonClass(id, active, elevated, placement)}
      aria-label={tabAriaLabel(id, label, dmUnread)}
      aria-current={active ? 'page' : undefined}
      data-tab={id}
    >
      {id === 'live' && active && (
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      <span className="relative inline-flex items-center justify-center">
        <TabIcon
          tab={id}
          className={placement === 'bottom' && id === 'live' && elevated ? 'w-8 h-8 shrink-0' : undefined}
        />
        <span className="sr-only">{tabAriaLabel(id, label, dmUnread)}</span>
        {id === 'dm' && dmUnread > 0 && (
          <span
            className="absolute -top-1 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-pink-600 text-white text-[10px] font-bold leading-none flex items-center justify-center shrink-0 ring-2 ring-[var(--ms-bg,#0b0b0f)]"
            aria-hidden="true"
          >
            {dmUnread > 99 ? '99+' : dmUnread}
          </span>
        )}
      </span>
      {placement === 'bottom' && elevated && (
        <span className="ms-tab-rail-label" aria-hidden="true">
          {label}
        </span>
      )}
    </button>
  );
}

export const MainTabNav = memo(function MainTabNav({
  tab,
  liveViewActive,
  dmUnread,
  onSelectTab,
  placement = 'bottom',
  className = '',
}: MainTabNavProps) {
  const renderTab = ([id, label]: readonly [Tab, string]) => (
    <TabButton
      key={id}
      id={id}
      label={label}
      active={isTabActive(id, tab, liveViewActive)}
      elevated={placement === 'bottom' && tab === id}
      placement={placement}
      dmUnread={dmUnread}
      onSelectTab={onSelectTab}
    />
  );

  return (
    <nav
      className={`${placement === 'header' ? 'shrink-0 flex w-full justify-center' : ''} ${navPlacementClass(placement)} ${className}`}
      aria-label="Navigation principale"
    >
      {placement === 'header' ? (
        <div className={navInnerClass(placement)}>{TABS.map(renderTab)}</div>
      ) : (
        <div className={navInnerClass(placement)} data-active-tab={tab}>
          <div className="ms-tab-rail__wave" aria-hidden="true" />
          <div className="ms-tab-rail__cluster ms-tab-rail__left">{LEFT_TABS.map(renderTab)}</div>
          <div className="ms-tab-rail__hub">{renderTab(CENTER_TAB)}</div>
          <div className="ms-tab-rail__cluster ms-tab-rail__right">{RIGHT_TABS.map(renderTab)}</div>
        </div>
      )}
    </nav>
  );
});
