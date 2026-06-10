import { useTranslation } from 'react-i18next';

interface SalonReturnBarProps {
  salonTitle?: string;
  onReturn: () => void;
}

export function SalonReturnBar({ salonTitle, onReturn }: SalonReturnBarProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onReturn}
      className="ms-salon-return-bar w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-200 bg-purple-950/70 border-t border-purple-500/30 hover:bg-purple-900/70 active:scale-[0.99] transition cursor-pointer"
      aria-label={salonTitle ? t('salon.returnToWithTitle', { title: salonTitle }) : t('salon.returnTo')}
    >
      <span className="text-sm shrink-0" aria-hidden>
        🎵
      </span>
      <span className="truncate">
        {salonTitle ? t('salon.returnToWithTitle', { title: salonTitle }) : t('salon.returnTo')}
      </span>
      <span className="text-purple-400 shrink-0" aria-hidden>
        →
      </span>
    </button>
  );
}
