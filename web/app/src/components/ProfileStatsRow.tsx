import { useTranslation } from 'react-i18next';
import { formatCompactCount } from '../lib/formatCount';

interface ProfileStatsRowProps {
  followers?: number | null;
  following?: number | null;
  thirdValue: number;
  onFollowingClick?: () => void;
}

export function ProfileStatsRow({
  followers,
  following,
  thirdValue,
  onFollowingClick,
}: ProfileStatsRowProps) {
  const { t } = useTranslation();
  const items = [
    {
      value: followers != null ? formatCompactCount(followers) : '0',
      label: t('profile.statsFollowers'),
      onClick: undefined as (() => void) | undefined,
    },
    {
      value: following != null ? formatCompactCount(following) : '—',
      label: t('profile.statsFollowing'),
      onClick: onFollowingClick,
    },
    {
      value: formatCompactCount(thirdValue),
      label: t('profile.statsSalons'),
      onClick: undefined as (() => void) | undefined,
    },
  ];

  return (
    <div className="mt-2.5 w-full max-w-sm">
      <div className="flex items-stretch">
        {items.map((item, index) => {
          const inner = (
            <>
              <p className="text-[15px] sm:text-base font-semibold text-white tabular-nums leading-none">
                {item.value}
              </p>
              <p
                className={`text-[11px] mt-1 leading-tight ${
                  item.onClick
                    ? 'text-gray-500 group-hover:text-purple-300/90 transition-colors'
                    : 'text-gray-500'
                }`}
              >
                {item.label}
              </p>
            </>
          );

          const divider =
            index > 0 ? (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-px bg-white/[0.06]"
                aria-hidden
              />
            ) : null;

          if (item.onClick) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="group relative flex-1 min-w-0 min-h-[44px] px-1.5 py-1 text-center rounded-lg hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500/40"
              >
                {divider}
                {inner}
              </button>
            );
          }

          return (
            <div
              key={item.label}
              className="relative flex-1 min-w-0 min-h-[44px] px-1.5 py-1 text-center"
            >
              {divider}
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
