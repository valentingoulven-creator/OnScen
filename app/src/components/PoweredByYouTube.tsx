import { useTranslation } from 'react-i18next';

interface PoweredByYouTubeProps {
  className?: string;
  compact?: boolean;
}

export function PoweredByYouTube({ className = '', compact = false }: PoweredByYouTubeProps) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 ${className}`}
      title={t('salon.youtubeSearch.poweredByHint', 'Lecture via YouTube IFrame API')}
    >
      <span
        className={`inline-block rounded-sm bg-red-600 text-white font-bold leading-none ${
          compact ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'
        }`}
        aria-hidden
      >
        ▶
      </span>
      {t('salon.youtubeSearch.poweredBy', 'Powered by YouTube')}
    </span>
  );
}
