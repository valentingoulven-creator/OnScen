import { useTranslation } from 'react-i18next';

interface SpotifySalonDeprecatedNoticeProps {
  salonTitle?: string;
  variant?: 'full' | 'compact';
  onBack?: () => void;
  backLabel?: string;
}

/** Legacy Spotify salons — read-only deprecation message (no playback or connect gates). */
export function SpotifySalonDeprecatedNotice({
  salonTitle,
  variant = 'full',
  onBack,
  backLabel,
}: SpotifySalonDeprecatedNoticeProps) {
  const { t } = useTranslation();
  const compact = variant === 'compact';

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2 text-center'
          : 'flex flex-col items-center justify-center gap-4 px-6 py-10 text-center max-w-md mx-auto'
      }
    >
      <span className={compact ? 'text-xl' : 'text-3xl'} aria-hidden>
        🎧
      </span>
      {salonTitle && !compact ? (
        <p className="text-sm text-gray-400 truncate max-w-full">{salonTitle}</p>
      ) : null}
      <p className={compact ? 'text-xs text-amber-300/90 leading-snug' : 'text-amber-300 text-sm leading-snug'}>
        {t('salon.spotifyDeprecated.title')}
      </p>
      <p className={compact ? 'text-[10px] text-gray-500 leading-snug' : 'text-[11px] text-gray-500 max-w-sm leading-snug'}>
        {t('salon.spotifyDeprecated.body')}
      </p>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={
            compact
              ? 'w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-300 hover:text-white'
              : 'px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-bold text-white'
          }
        >
          {backLabel ?? t('salon.spotifyDeprecated.backToMap')}
        </button>
      ) : null}
    </div>
  );
}
