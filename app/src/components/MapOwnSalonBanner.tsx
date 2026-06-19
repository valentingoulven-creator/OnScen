import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../lib/socket';

interface MapOwnSalonBannerProps {
  salonId: string;
  salonTitle?: string;
  onReturn: () => void;
  /** Salon terminé côté serveur (socket ou API). */
  onSalonEnded?: () => void;
}

/** Bandeau carte : salon hébergé actif — persiste tant que la session salon est ouverte. */
export function MapOwnSalonBanner({
  salonId,
  salonTitle,
  onReturn,
  onSalonEnded,
}: MapOwnSalonBannerProps) {
  const { t } = useTranslation();
  const onSalonEndedRef = useRef(onSalonEnded);
  onSalonEndedRef.current = onSalonEnded;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onEnded = (payload: { salonId?: string }) => {
      if (payload?.salonId !== salonId) return;
      onSalonEndedRef.current?.();
    };

    socket.on('salon_ended', onEnded);
    return () => {
      socket.off('salon_ended', onEnded);
    };
  }, [salonId]);

  const label = salonTitle
    ? t('salon.returnToWithTitle', { title: salonTitle })
    : t('salon.returnTo');

  return (
    <button
      type="button"
      onClick={onReturn}
      aria-label={label}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-[35] flex max-w-[min(22rem,calc(100%-5.5rem))] items-center gap-2 rounded-full border border-purple-500/40 bg-[#12121a]/95 px-3 py-2 text-xs font-medium text-purple-100 shadow-lg shadow-black/40 backdrop-blur-sm pointer-events-auto active:scale-[0.98] transition hover:border-purple-400/60 hover:bg-purple-950/90"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-purple-400" aria-hidden>
        →
      </span>
    </button>
  );
}
