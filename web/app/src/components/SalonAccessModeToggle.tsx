import { useTranslation } from 'react-i18next';

interface SalonAccessModeToggleProps {
  accessMode: 'public' | 'invite';
  disabled?: boolean;
  onChange: (mode: 'public' | 'invite') => void;
}

export function SalonAccessModeToggle({
  accessMode,
  disabled,
  onChange,
}: SalonAccessModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div
      className="salon-access-mode-toggle shrink-0 flex items-center rounded-full border border-[#2a2a3a] bg-[#0b0b0f]/80 p-0.5"
      role="group"
      aria-label={t('salon.youtubeHost.manageAccess', { defaultValue: "Gérer l'accès" })}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={accessMode === 'public'}
        onClick={() => onChange('public')}
        className={`salon-access-mode-toggle__btn px-2 sm:px-2.5 py-1 rounded-full text-[10px] font-semibold transition disabled:opacity-50 ${
          accessMode === 'public'
            ? 'bg-[#42426a] text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <span className="sm:hidden" aria-hidden>
          🌍
        </span>
        <span className="hidden sm:inline">{t('salon.public', { defaultValue: 'Public' })}</span>
        <span className="sr-only sm:hidden">{t('salon.public', { defaultValue: 'Public' })}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={accessMode === 'invite'}
        onClick={() => onChange('invite')}
        className={`salon-access-mode-toggle__btn px-2 sm:px-2.5 py-1 rounded-full text-[10px] font-semibold transition disabled:opacity-50 ${
          accessMode === 'invite'
            ? 'bg-[#42426a] text-white'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <span className="sm:hidden" aria-hidden>
          🔒
        </span>
        <span className="hidden sm:inline">
          {t('salon.youtubeHost.accessInvite', { defaultValue: 'Invitation' })}
        </span>
        <span className="sr-only sm:hidden">
          {t('salon.youtubeHost.accessInvite', { defaultValue: 'Invitation' })}
        </span>
      </button>
    </div>
  );
}
