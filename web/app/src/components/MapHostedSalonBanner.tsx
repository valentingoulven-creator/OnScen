import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../lib/socket';
import { formatSalonAudienceLabel } from '../lib/salonAudience';
import { UsernameDisplay } from './UsernameDisplay';
import type { Salon } from '../types';

function ViewerEyeIcon() {
  return (
    <svg
      className="map-hosted-salon-banner__viewer-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export interface MapHostedSalonBannerProps {
  salonId: string;
  salonTitle?: string;
  hostName: string;
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
  hostAvatarUrl?: string;
  albumArtUrl?: string;
  listenersCount?: number;
  /** Libellé du bouton d'action (défaut : Rejoindre). */
  ctaLabel?: string;
  /** Libellé du bouton fermer / quitter. */
  closeLabel?: string;
  onReturn: () => void;
  onClose?: () => void;
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
  hostAvatarUrl,
  albumArtUrl,
  listenersCount = 0,
  ctaLabel,
  closeLabel,
  onReturn,
  onClose,
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
  const thumbnailUrl = albumArtUrl?.trim() || hostAvatarUrl?.trim() || null;
  const actionLabel = ctaLabel ?? t('map.hostedSalonBannerJoin');
  const dismissLabel =
    closeLabel ??
    t('map.hostedSalonBannerClose', { defaultValue: 'Fermer le salon' });

  return (
    <div className="map-hosted-salon-banner shrink-0 z-20 w-full pointer-events-auto">
      <button
        type="button"
        onClick={onReturn}
        aria-label={ariaLabel}
        className="map-hosted-salon-banner__main"
      >
        <span className="map-hosted-salon-banner__accent" aria-hidden />

        {thumbnailUrl ? (
          <span className="map-hosted-salon-banner__thumb" aria-hidden>
            <img src={thumbnailUrl} alt="" loading="lazy" />
          </span>
        ) : null}

        <span className="map-hosted-salon-banner__live" aria-hidden>
          <span className="map-hosted-salon-banner__live-dot live-indicator-dot" />
          {t('map.hostedSalonBannerLive')}
        </span>

        <span className="map-hosted-salon-banner__body">
          <span className="map-hosted-salon-banner__title">{title}</span>
          <span className="map-hosted-salon-banner__host">
            <UsernameDisplay
              username={hostName}
              usernameColor={hostUsernameColor}
              usernameWaveFrom={hostUsernameWaveFrom}
              usernameWaveTo={hostUsernameWaveTo}
              className="map-hosted-salon-banner__host-name"
            />
          </span>
        </span>

        <span className="map-hosted-salon-banner__meta">
          <span className="map-hosted-salon-banner__viewers">
            <ViewerEyeIcon />
            <span>{audienceLabel}</span>
          </span>

          <span className="map-hosted-salon-banner__cta">{actionLabel}</span>
        </span>
      </button>

      {onClose ? (
        <button
          type="button"
          className="map-hosted-salon-banner__close"
          aria-label={dismissLabel}
          onClick={onClose}
        >
          {dismissLabel}
        </button>
      ) : null}
    </div>
  );
}
