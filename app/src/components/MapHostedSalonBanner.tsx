import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../lib/socket';
import { formatSalonAudienceLabel } from '../lib/salonAudience';
import { UsernameDisplay } from './UsernameDisplay';
import type { Salon } from '../types';

const PLATFORM_BADGE: Record<
  'spotify' | 'youtube',
  { label: string; className: string }
> = {
  spotify: {
    label: 'Spotify',
    className: 'text-[#1DB954] border-[#1DB954]/30 bg-[#1DB954]/10',
  },
  youtube: {
    label: 'YouTube',
    className: 'text-red-400 border-red-500/30 bg-red-500/10',
  },
};

export interface MapHostedSalonBannerProps {
  salonId: string;
  salonTitle?: string;
  hostName: string;
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
  platform?: Salon['platform'];
  listenersCount?: number;
  onReturn: () => void;
  /** Salon terminé côté serveur (socket ou API). */
  onSalonEnded?: () => void;
}

/** Bandeau carte compact : salon hébergé actif — persiste tant que la session salon est ouverte. */
export function MapHostedSalonBanner({
  salonId,
  salonTitle,
  hostName,
  hostUsernameColor,
  hostUsernameWaveFrom,
  hostUsernameWaveTo,
  platform,
  listenersCount = 0,
  onReturn,
  onSalonEnded,
}: MapHostedSalonBannerProps) {
  const { t } = useTranslation();
  const onSalonEndedRef = useRef(onSalonEnded);
  onSalonEndedRef.current = onSalonEnded;
  const [liveListenersCount, setLiveListenersCount] = useState(listenersCount);

  useEffect(() => {
    setLiveListenersCount(listenersCount);
  }, [listenersCount]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onEnded = (payload: { salonId?: string }) => {
      if (payload?.salonId !== salonId) return;
      onSalonEndedRef.current?.();
    };

    const onSalonUpdated = (updated: Salon) => {
      if (updated.id !== salonId) return;
      if (typeof updated.listenersCount === 'number') {
        setLiveListenersCount(updated.listenersCount);
      }
    };

    socket.on('salon_ended', onEnded);
    socket.on('salon_updated', onSalonUpdated);
    return () => {
      socket.off('salon_ended', onEnded);
      socket.off('salon_updated', onSalonUpdated);
    };
  }, [salonId]);

  const title = salonTitle?.trim() || t('salon.title');
  const ariaLabel = salonTitle
    ? t('salon.returnToWithTitle', { title: salonTitle })
    : t('salon.returnTo');
  const audienceLabel = formatSalonAudienceLabel(liveListenersCount, t).replace(/^👥\s*/, '');
  const platformBadge = platform ? PLATFORM_BADGE[platform] : null;

  return (
    <button
      type="button"
      onClick={onReturn}
      aria-label={ariaLabel}
      className="shrink-0 z-20 flex w-full min-h-[2.75rem] items-center gap-2 border-b border-purple-500/35 bg-[#12121a]/95 px-3 py-2 text-left text-xs text-purple-100 shadow-md shadow-black/25 backdrop-blur-sm pointer-events-auto active:scale-[0.99] transition hover:border-purple-400/50 hover:bg-purple-950/85"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
      </span>

      <span className="min-w-0 flex-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <span className="min-w-0 truncate font-semibold text-white">{title}</span>
        <span className="hidden sm:inline text-white/25" aria-hidden>
          ·
        </span>
        <span className="min-w-0 flex items-center gap-1 text-white/70">
          <span className="shrink-0 text-white/45">{t('map.hostedSalonBannerHost')}</span>
          <UsernameDisplay
            username={hostName}
            usernameColor={hostUsernameColor}
            usernameWaveFrom={hostUsernameWaveFrom}
            usernameWaveTo={hostUsernameWaveTo}
            className="truncate font-medium"
          />
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {platformBadge && (
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformBadge.className}`}
          >
            {platformBadge.label}
          </span>
        )}
        <span className="hidden sm:inline text-white/50" aria-hidden>
          👥
        </span>
        <span className="text-[10px] sm:text-xs text-white/60 whitespace-nowrap">{audienceLabel}</span>
        <span className="shrink-0 rounded-full border border-purple-500/40 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
          {t('map.hostedSalonBannerOpen')}
        </span>
      </span>
    </button>
  );
}
