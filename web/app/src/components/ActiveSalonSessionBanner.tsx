import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { MapHostedSalonBanner } from './MapHostedSalonBanner';
import type { Salon, User } from '../types';

interface ActiveSalonSessionBannerProps {
  salonId: string;
  fallbackTitle?: string;
  isHost?: boolean;
  token: string;
  user: User;
  onReturn: () => void;
  onSalonEnded?: () => void;
}

/** Bandeau global — session salon active (hôte ou auditeur), tous onglets sauf salon plein écran. */
export function ActiveSalonSessionBanner({
  salonId,
  fallbackTitle,
  isHost = false,
  token,
  user,
  onReturn,
  onSalonEnded,
}: ActiveSalonSessionBannerProps) {
  const { t } = useTranslation();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonMissing, setSalonMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getSalon(token, salonId)
      .then(({ salon: loaded }) => {
        if (!cancelled) {
          setSalon(loaded);
          setSalonMissing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSalon(null);
          setSalonMissing(true);
          onSalonEnded?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, salonId, onSalonEnded]);

  const ctaLabel = isHost
    ? t('map.hostedSalonBannerOpen', { defaultValue: 'Ouvrir' })
    : t('salon.returnTo', { defaultValue: 'Revenir au salon' });

  if (salonMissing) return null;

  return (
    <div className="shrink-0 z-30 w-full min-w-0 pointer-events-auto">
      <MapHostedSalonBanner
        salonId={salonId}
        salonTitle={salon?.title ?? fallbackTitle}
        hostName={salon?.hostName ?? user.username}
        hostUsernameColor={salon?.hostUsernameColor ?? user.usernameColor}
        hostUsernameWaveFrom={salon?.hostUsernameWaveFrom ?? user.usernameWaveFrom}
        hostUsernameWaveTo={salon?.hostUsernameWaveTo ?? user.usernameWaveTo}
        hostAvatarUrl={salon?.hostAvatarUrl}
        albumArtUrl={salon?.playbackState?.albumArtUrl}
        platform={salon?.platform}
        listenersCount={salon?.listenersCount ?? 0}
        ctaLabel={ctaLabel}
        onReturn={onReturn}
        onSalonEnded={onSalonEnded}
      />
    </div>
  );
}
