import { useTranslation } from 'react-i18next';
import { donTierEmoji } from '../lib/liveReactions';
import type { LiveDonationOption } from '../types';

interface LiveViewerRewardsStripProps {
  options: LiveDonationOption[];
  onSelect: (amount: number) => void;
  disabled?: boolean;
}

/** Catalogue récompenses visible pour les spectateurs (scroll horizontal). */
export function LiveViewerRewardsStrip({
  options,
  onSelect,
  disabled = false,
}: LiveViewerRewardsStripProps) {
  const { t } = useTranslation();

  if (options.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-[#1e1e2f] bg-[#0b0b0f]">
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-pink-300/80">
        {t('live.viewerRewardsTitle')}
      </p>
      <div className="overflow-x-auto px-3 pb-2.5">
        <div className="flex gap-2 w-max">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.amount)}
              className="flex flex-col items-center justify-center min-w-[5.5rem] max-w-[7.5rem] py-2 px-2.5 rounded-xl border border-pink-500/35 bg-pink-950/40 text-pink-100 hover:border-pink-400 hover:bg-pink-900/45 active:scale-95 transition disabled:opacity-50 min-h-[44px]"
              aria-label={`${opt.label} — ${opt.amount} euros`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {donTierEmoji(opt.amount)}
              </span>
              <span className="text-[10px] font-semibold mt-1 text-center line-clamp-2 leading-tight">
                {opt.label}
              </span>
              <span className="text-xs font-bold text-pink-200 mt-0.5">{opt.amount} €</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
