import { useTranslation } from 'react-i18next';

export function UserDevBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide text-cyan-400/90 shrink-0 ${className}`}
      title={t('user.devBadgeTitle', { defaultValue: 'Compte développeur' })}
    >
      {t('user.devBadge', { defaultValue: 'Dev' })}
    </span>
  );
}
