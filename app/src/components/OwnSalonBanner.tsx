import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Salon } from '../types';

interface OwnSalonBannerProps {
  salonId: string;
  salonTitle?: string;
  token: string;
  /** Ouvre le salon en plein écran pour le gérer. */
  onManage: () => void;
  /** Appelé quand le salon a été terminé côté serveur. */
  onSalonEnded?: () => void;
}

const POLL_INTERVAL_MS = 30_000;

export function OwnSalonBanner({
  salonId,
  salonTitle,
  token,
  onManage,
  onSalonEnded,
}: OwnSalonBannerProps) {
  const [listenersCount, setListenersCount] = useState<number | null>(null);
  const onSalonEndedRef = useRef(onSalonEnded);
  onSalonEndedRef.current = onSalonEnded;

  // Initial fetch + periodic poll for listener count.
  useEffect(() => {
    let cancelled = false;

    const fetchSalon = () => {
      api
        .getSalon(token, salonId)
        .then(({ salon }: { salon: Salon }) => {
          if (!cancelled) setListenersCount(salon.listenersCount ?? 0);
        })
        .catch(() => {
          /* silently ignore — poll will retry */
        });
    };

    fetchSalon();
    const intervalId = setInterval(fetchSalon, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token, salonId]);

  // Socket: real-time listener count + salon_ended detection.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onUpdated = (updated: Partial<Salon> & { id?: string }) => {
      if (updated.id !== salonId) return;
      if (typeof updated.listenersCount === 'number') {
        setListenersCount(updated.listenersCount);
      }
    };

    const onEnded = (payload: { salonId?: string }) => {
      if (payload?.salonId !== salonId) return;
      onSalonEndedRef.current?.();
    };

    socket.on('salon_updated', onUpdated);
    socket.on('salon_ended', onEnded);

    return () => {
      socket.off('salon_updated', onUpdated);
      socket.off('salon_ended', onEnded);
    };
  }, [salonId]);

  const audienceLabel =
    listenersCount === null
      ? null
      : listenersCount === 0
        ? 'Aucun auditeur'
        : `${listenersCount} auditeur${listenersCount > 1 ? 's' : ''}`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        salonTitle
          ? `Votre salon « ${salonTitle} » est actif${audienceLabel ? ` · ${audienceLabel}` : ''}`
          : `Votre salon est actif${audienceLabel ? ` · ${audienceLabel}` : ''}`
      }
      className="flex items-center gap-2.5 px-3 py-2 bg-indigo-950/95 border-t border-indigo-500/40 backdrop-blur-sm shrink-0"
    >
      {/* Pulsating dot — "live" */}
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
      </span>

      <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
        <span className="text-xs font-semibold text-indigo-200 truncate shrink-0 max-w-[50%]">
          {salonTitle ? `« ${salonTitle} »` : 'Votre salon'}
        </span>
        <span className="text-xs text-indigo-400 shrink-0 whitespace-nowrap">est actif</span>
        {audienceLabel !== null && (
          <span className="text-xs text-indigo-300/70 shrink-0 whitespace-nowrap">
            · {audienceLabel}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="shrink-0 px-3 py-1 text-xs font-bold text-white bg-indigo-600/80 hover:bg-indigo-500/90 rounded-full active:scale-95 transition border border-indigo-400/30"
      >
        Gérer
      </button>
    </div>
  );
}
