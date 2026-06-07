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
  ['map', 'Carte'],
  ['actualite', 'Actualité'],
  ['live', 'Direct'],
  ['dm', 'Messages'],
  ['reels', 'Reels'],
];

function isTabActive(id: Tab, tab: Tab, liveViewActive: boolean): boolean {
  return tab === id || (id === 'live' && liveViewActive);
}

function tabButtonClass(id: Tab, active: boolean, placement: 'bottom' | 'header'): string {
  const width = 'shrink-0';

  if (placement === 'bottom') {
    const base =
      `${width} flex items-center justify-center w-[var(--tab-nav-btn-size)] h-[var(--tab-nav-btn-size)] rounded-full relative transition-colors active:opacity-70 touch-manipulation`;
    if (!active) {
      return `${base} text-gray-500 bg-transparent`;
    }
    switch (id) {
      case 'live':
        return `${base} text-red-400 bg-red-500/15`;
      case 'reels':
        return `${base} text-pink-400 bg-pink-500/15`;
      case 'actualite':
        return `${base} text-amber-400 bg-amber-500/15`;
      default:
        return `${base} text-white bg-white/10`;
    }
  }

  const base = `${width} flex items-center justify-center whitespace-nowrap rounded-full px-2 sm:px-3 py-2.5 sm:py-3 min-h-[44px] text-xs sm:text-sm font-semibold relative transition-colors active:scale-[0.98] touch-manipulation`;

  if (!active) {
    return `${base} text-gray-400 bg-[#12121a]/80 backdrop-blur-md ring-1 ring-inset ring-white/[0.08] shadow-sm shadow-black/25 hover:text-gray-200 hover:bg-[#1a1a28]/90`;
  }

  switch (id) {
    case 'live':
      return `${base} text-red-400 bg-red-500/15 ring-1 ring-inset ring-red-500/30`;
    case 'reels':
      return `${base} text-pink-400 bg-pink-500/15 ring-1 ring-inset ring-pink-500/30`;
    case 'actualite':
      return `${base} text-amber-400 bg-amber-500/15 ring-1 ring-inset ring-amber-500/30`;
    default:
      return `${base} text-purple-400 bg-purple-500/15 ring-1 ring-inset ring-purple-500/30`;
  }
}

function navPlacementClass(placement: 'bottom' | 'header'): string {
  if (placement === 'header') {
    return 'py-0.5 px-2 sm:px-3 -mt-1 bg-transparent';
  }
  return 'ms-tab-bar-instagram';
}

function navInnerClass(placement: 'bottom' | 'header'): string {
  if (placement === 'header') {
    return 'flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 max-w-full';
  }
  return 'flex items-center justify-center gap-3 sm:gap-4';
}

export function MainTabNav({
  tab,
  liveViewActive,
  dmUnread,
  onSelectTab,
  placement = 'bottom',
  className = '',
}: MainTabNavProps) {
  return (
    <nav
      className={`${placement === 'header' ? 'shrink-0 flex w-full justify-center' : ''} ${navPlacementClass(placement)} ${className}`}
      aria-label="Navigation principale"
    >
      <div className={navInnerClass(placement)}>
      {TABS.map(([id, label]) => {
        const active = isTabActive(id, tab, liveViewActive);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTab(id)}
            className={tabButtonClass(id, active, placement)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            {id === 'live' && active && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="relative inline-flex items-center justify-center">
              <TabIcon tab={id} />
              <span className="sr-only">{label}</span>
              {id === 'dm' && dmUnread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shrink-0 ring-2 ring-[var(--ms-bg,#0b0b0f)]">
                  {dmUnread > 99 ? '99+' : dmUnread}
                </span>
              )}
            </span>
          </button>
        );
      })}
      </div>
    </nav>
  );
}
