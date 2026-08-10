import { useTranslation } from 'react-i18next';

export type ProfileTab = 'profil' | 'reels' | 'compositions' | 'programmation' | 'lives';

export function parseProfileTab(tab: string | null): ProfileTab {
  if (tab === 'events') return 'programmation';
  if (
    tab === 'compositions' ||
    tab === 'reels' ||
    tab === 'lives' ||
    tab === 'profil' ||
    tab === 'programmation'
  ) {
    return tab;
  }
  return 'profil';
}

interface ProfileTabBarProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  showReels?: boolean;
  showCompositions?: boolean;
  showProgrammation?: boolean;
  showLives?: boolean;
  /** Libellés alternatifs pour profils visités (ex. « Ses reels »). */
  reelsLabel?: string;
  livesLabel?: string;
}

export function ProfileTabBar({
  active,
  onChange,
  showReels,
  showCompositions = true,
  showProgrammation = true,
  showLives,
  reelsLabel,
  livesLabel,
}: ProfileTabBarProps) {
  const { t } = useTranslation();
  const tabs: [ProfileTab, string][] = [['profil', t('profile.tabProfil')]];
  if (showReels) tabs.push(['reels', reelsLabel ?? t('profile.tabReels')]);
  if (showCompositions) tabs.push(['compositions', t('profile.tabCompositions')]);
  if (showProgrammation) tabs.push(['programmation', t('profile.tabProgrammation')]);
  if (showLives) tabs.push(['lives', livesLabel ?? t('profile.tabLives')]);

  return (
    <div className="border-t border-[#1e1e2f]/80 overflow-x-auto scrollbar-none max-w-lg mx-auto w-full">
      <div className="flex min-w-max sm:min-w-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`relative flex-1 min-w-[4.5rem] px-2 py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${
              active === id ? 'text-white' : 'text-gray-500 hover:text-gray-300 active:text-gray-200'
            }`}
          >
            {label}
            {active === id ? (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ boxShadow: '0 0 8px rgba(168,85,247,0.7)' }}
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
