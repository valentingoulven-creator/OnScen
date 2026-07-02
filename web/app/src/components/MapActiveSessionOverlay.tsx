import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { ProfileCurrentListening } from './ProfileCurrentListening';
import type { CurrentListening, Live, Salon, User } from '../types';

type MapActiveSalonSession = {
  id: string;
  title?: string;
  isHost?: boolean;
};

type MapActiveLiveSession = {
  id: string;
  isHost?: boolean;
};

interface MapActiveSessionOverlayProps {
  token: string;
  user: User;
  salonSession?: MapActiveSalonSession | null;
  liveSession?: MapActiveLiveSession | null;
  onOpenSalon: () => void;
  onOpenLive: () => void;
}

function listeningFromSalon(salon: Salon): CurrentListening {
  const ps = salon.playbackState;
  return {
    title: ps?.title?.trim() || salon.title?.trim() || 'Salon',
    artist: ps?.artist?.trim() || salon.hostName?.trim() || '',
    albumArtUrl: ps?.albumArtUrl,
    platform: 'youtube',
    isPlaying: ps?.isPlaying,
  };
}

function listeningFromLive(live: Live): CurrentListening {
  const ps = live.playbackState;
  return {
    title: live.title?.trim() || ps?.title?.trim() || 'Direct',
    artist: ps?.artist?.trim() || live.hostName?.trim() || '',
    albumArtUrl: ps?.albumArtUrl,
    platform: 'youtube',
    isPlaying: ps?.isPlaying ?? true,
  };
}

function userListeningMatchesSalon(user: User, salonId: string): boolean {
  return user.salonId === salonId && Boolean(user.currentListening);
}

/** Carte salon / live active — coin haut-droit de la carte (style profil « En écoute »). */
export function MapActiveSessionOverlay({
  token,
  user,
  salonSession,
  liveSession,
  onOpenSalon,
  onOpenLive,
}: MapActiveSessionOverlayProps) {
  const { t } = useTranslation();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [salonMissing, setSalonMissing] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [liveMissing, setLiveMissing] = useState(false);

  const liveId = liveSession?.id ?? null;
  const salonId = salonSession?.id ?? null;
  const showLive = Boolean(liveId);
  const showSalon = Boolean(salonId) && !showLive;

  useEffect(() => {
    if (!showSalon || !salonId) {
      setSalon(null);
      return;
    }
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
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showSalon, salonId, token]);

  useEffect(() => {
    if (!showLive || !liveId) {
      setLive(null);
      setLiveMissing(false);
      return;
    }
    let cancelled = false;
    void api
      .getLive(token, liveId)
      .then(({ live: loaded }) => {
        if (cancelled) return;
        // `GET /lives/:id` renvoie le live même terminé (isActive: false, ex. rediffusion) —
        // sans ce contrôle, un live tout juste arrêté restait affiché ici (chip carte).
        if (loaded.isActive === false) {
          setLive(null);
          setLiveMissing(true);
        } else {
          setLive(loaded);
          setLiveMissing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLive(null);
          setLiveMissing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showLive, liveId, token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onSalonUpdated = (updated: Salon) => {
      if (showSalon && updated.id === salonId) {
        setSalon(updated);
        setSalonMissing(false);
      }
    };
    const onSalonEnded = (payload: { salonId?: string }) => {
      if (showSalon && payload?.salonId === salonId) {
        setSalon(null);
        setSalonMissing(true);
      }
    };
    const onLiveUpdated = (updated: Live) => {
      if (!showLive || updated.id !== liveId) return;
      if (updated.isActive === false) {
        setLive(null);
        setLiveMissing(true);
      } else {
        setLive(updated);
        setLiveMissing(false);
      }
    };
    const onLiveEnded = (payload: { liveId?: string }) => {
      if (showLive && payload?.liveId === liveId) {
        setLive(null);
        setLiveMissing(true);
      }
    };

    socket.on('salon_updated', onSalonUpdated);
    socket.on('salon_ended', onSalonEnded);
    socket.on('live_updated', onLiveUpdated);
    socket.on('live_ended', onLiveEnded);
    return () => {
      socket.off('salon_updated', onSalonUpdated);
      socket.off('salon_ended', onSalonEnded);
      socket.off('live_updated', onLiveUpdated);
      socket.off('live_ended', onLiveEnded);
    };
  }, [showLive, showSalon, salonId, liveId]);

  if (showLive && liveId) {
    if (liveMissing) return null;

    const listening =
      user.liveId === liveId && user.currentListening
        ? user.currentListening
        : live
          ? listeningFromLive(live)
          : null;

    if (!listening) return null;

    return (
      <div className="ms-map-active-session">
        <ProfileCurrentListening
          listening={listening}
          compact
          mapChip
          statusActiveLabel={t('live.liveBadge', { defaultValue: 'En direct' })}
          statusPausedLabel={t('live.liveBadge', { defaultValue: 'En direct' })}
          statusLabelClassName="text-red-400"
          onClick={onOpenLive}
          clickAriaLabel={t('live.returnToLive', { defaultValue: 'Reprendre le live' })}
        />
      </div>
    );
  }

  if (showSalon && salonId) {
    if (salonMissing) return null;

    const listening =
      salon
        ? listeningFromSalon(salon)
        : userListeningMatchesSalon(user, salonId) && user.currentListening
          ? user.currentListening
          : null;

    if (!listening) return null;

    const isHost = salonSession?.isHost ?? user.salonId === salonId;
    return (
      <div className="ms-map-active-session">
        <ProfileCurrentListening
          listening={listening}
          compact
          mapChip
          onClick={onOpenSalon}
          clickAriaLabel={
            isHost
              ? t('map.hostedSalonBannerOpen', { defaultValue: 'Ouvrir le salon' })
              : t('salon.returnTo', { defaultValue: 'Revenir au salon' })
          }
        />
      </div>
    );
  }

  return null;
}
