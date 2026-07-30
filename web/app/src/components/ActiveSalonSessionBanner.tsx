import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { resolveActiveSalonHostRole } from '../lib/activeSalonHostRole';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { MapHostedSalonBanner } from './MapHostedSalonBanner';
import type { Salon, User } from '../types';

interface ActiveSalonSessionBannerProps {
  salonId: string;
  fallbackTitle?: string;
  isHost?: boolean;
  token: string;
  user: User;
  onReturn: () => void;
  onLeaveSalon: () => void;
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
  onLeaveSalon,
  onSalonEnded,
}: ActiveSalonSessionBannerProps) {
  const { t } = useTranslation();
  const { refreshUser, setUserFromProfile } = useAuth();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonMissing, setSalonMissing] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endingSalon, setEndingSalon] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

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

  const isSalonHost = useMemo(
    () =>
      resolveActiveSalonHostRole({
        salon,
        userId: user.id,
        salonId,
        sessionIsHost: isHost,
        userHostedSalonId: user.salonId,
      }),
    [salon, user.id, user.salonId, salonId, isHost]
  );

  const ctaLabel = isSalonHost
    ? t('map.hostedSalonBannerOpen', { defaultValue: 'Ouvrir' })
    : t('salon.returnTo', { defaultValue: 'Revenir au salon' });

  const closeLabel = isSalonHost
    ? t('map.hostedSalonBannerClose', { defaultValue: 'Fermer le salon' })
    : t('salon.leaveSalon', { defaultValue: 'Quitter le salon' });

  const handleClose = useCallback(() => {
    if (isSalonHost) {
      setEndError(null);
      setShowEndConfirm(true);
      return;
    }
    onLeaveSalon();
  }, [isSalonHost, onLeaveSalon]);

  const handleEndSalon = useCallback(async () => {
    setEndingSalon(true);
    setEndError(null);
    try {
      await api.deleteSalon(token, salonId);
      setUserFromProfile({ ...user, salonId: undefined, salonTitle: undefined });
      await refreshUser().catch(() => {});
      setShowEndConfirm(false);
      onSalonEnded?.();
      onLeaveSalon();
    } catch (e) {
      setEndError(e instanceof Error ? e.message : t('common.error', { defaultValue: 'Erreur' }));
    } finally {
      setEndingSalon(false);
    }
  }, [token, salonId, user, setUserFromProfile, refreshUser, onSalonEnded, onLeaveSalon, t]);

  if (salonMissing) return null;

  return (
    <>
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
          listenersCount={salon?.listenersCount ?? 0}
          ctaLabel={ctaLabel}
          closeLabel={closeLabel}
          onReturn={onReturn}
          onClose={handleClose}
          onSalonEnded={onSalonEnded}
        />
      </div>

      <ConfirmModal
        open={showEndConfirm}
        title={t('salon.endSalon', { defaultValue: 'Arrêter le salon' })}
        description={t('salon.endSalonConfirm', {
          defaultValue: 'Le salon sera arrêté pour tous les auditeurs. Cette action est définitive.',
        })}
        confirmLabel={t('map.hostedSalonBannerClose', { defaultValue: 'Fermer le salon' })}
        loading={endingSalon}
        loadingLabel={t('common.loading', { defaultValue: 'Chargement…' })}
        error={endError}
        onCancel={() => {
          if (!endingSalon) setShowEndConfirm(false);
        }}
        onConfirm={() => void handleEndSalon()}
      />
    </>
  );
}
