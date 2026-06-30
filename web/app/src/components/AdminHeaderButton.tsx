import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

interface AdminHeaderButtonProps {
  onClick: () => void;
  active?: boolean;
}

export function AdminHeaderButton({ onClick, active = false }: AdminHeaderButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user?.isAdmin) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={t('settings.adminPanel')}
      aria-label={t('settings.adminPanel')}
      className={`p-1.5 sm:p-2 rounded-full transition shrink-0 ${
        active
          ? 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
          : 'text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 opacity-80 hover:opacity-100'
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path
          d="M12 3 4 7v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4Z"
          strokeLinejoin="round"
        />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
