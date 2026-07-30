import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatSalonAudienceLabel } from '../lib/salonAudience';
import { ConfirmModal } from './ConfirmModal';
import type { Live } from '../types';

interface ActiveLiveBannerProps {
  liveId: string;
  token: string;
  isHost?: boolean;
  onReturn: () => void;
  /** Spectateur : quitter le live (leave_live + fin session). */
  onLeaveLive?: () => void;
  /** Hôte : arrêter le live (API stop + fin session). */
  onStopLive?: () => void | Promise<void>;
}

function ViewerEyeIcon() {
  return (
    <svg
      className="active-live-banner__viewer-icon"
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

function LiveCameraIcon() {
  return (
    <svg
      className="w-4 h-4 text-red-200"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

/** Bandeau global — live actif (hôte ou spectateur) hors page live plein écran. */
export function ActiveLiveBanner({
  liveId,
  token,
  isHost = false,
  onReturn,
  onLeaveLive,
  onStopLive,
}: ActiveLiveBannerProps) {
  const { t } = useTranslation();
  const [live, setLive] = useState<Live | null>(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getLive(token, liveId)
      .then(({ live: loaded }) => {
        if (cancelled) return;
        setLive(loaded);
        setViewersCount(loaded.viewersCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, liveId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onUpdate = (updated: Live) => {
      if (updated.id !== liveId) return;
      setLive(updated);
      if (typeof updated.viewersCount === 'number') {
        setViewersCount(updated.viewersCount);
      }
    };

    socket.on('live_updated', onUpdate);
    return () => {
      socket.off('live_updated', onUpdate);
    };
  }, [liveId]);

  const title = live?.title?.trim() || t('live.title', { defaultValue: 'Direct' });
  const thumbnailUrl = live?.playbackState?.albumArtUrl?.trim() || null;
  const audienceLabel = formatSalonAudienceLabel(viewersCount, t).replace(/^👥\s*/, '');
  const canLeave = Boolean(isHost ? onStopLive : onLeaveLive);
  const leaveShortLabel = isHost
    ? t('live.stopLiveShort', { defaultValue: 'Arrêter' })
    : t('live.leaveLiveShort');
  const leaveFullLabel = isHost
    ? t('live.stopLive', { defaultValue: 'Arrêter le live' })
    : t('live.leaveLive');

  const handleLeaveClick = () => {
    if (isHost && onStopLive) {
      setShowStopConfirm(true);
      return;
    }
    onLeaveLive?.();
  };

  const handleConfirmStop = async () => {
    if (!onStopLive) return;
    setStopping(true);
    try {
      await onStopLive();
      setShowStopConfirm(false);
    } finally {
      setStopping(false);
    }
  };

  return (
    <>
      <div className="active-live-banner shrink-0 z-30 w-full pointer-events-auto">
        <button
          type="button"
          onClick={onReturn}
          aria-label={t('live.returnToLive', { defaultValue: 'Reprendre le live' })}
          className="active-live-banner__main"
        >
          <span className="active-live-banner__accent" aria-hidden />

          <span className="active-live-banner__thumb" aria-hidden>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" loading="lazy" />
            ) : (
              <span className="active-live-banner__thumb-fallback">
                <LiveCameraIcon />
              </span>
            )}
          </span>

          <span className="active-live-banner__live" aria-hidden>
            <span className="active-live-banner__live-dot live-indicator-dot" />
            {t('live.liveBadge', { defaultValue: 'EN DIRECT' })}
          </span>

          <span className="active-live-banner__body">
            <span className="active-live-banner__title">{title}</span>
            <span className="active-live-banner__subtitle">
              {isHost
                ? t('live.activeBannerSubtitle', { defaultValue: 'Votre live est en cours' })
                : t('live.activeBannerSubtitleViewer', {
                    defaultValue: 'Le direct continue en arrière-plan',
                  })}
            </span>
          </span>

          {viewersCount > 0 ? (
            <span className="active-live-banner__viewers">
              <ViewerEyeIcon />
              <span>{audienceLabel}</span>
            </span>
          ) : null}
        </button>

        <div className="active-live-banner__actions">
          <button
            type="button"
            onClick={onReturn}
            className="active-live-banner__cta"
          >
            {t('live.returnToLiveBtn', { defaultValue: 'Reprendre' })}
          </button>

          {canLeave ? (
            <button
              type="button"
              onClick={handleLeaveClick}
              aria-label={leaveFullLabel}
              className="active-live-banner__leave"
            >
              {leaveShortLabel}
            </button>
          ) : null}
        </div>
      </div>

      {isHost && onStopLive ? (
        <ConfirmModal
          open={showStopConfirm}
          title={t('live.stopLiveConfirmTitle', { defaultValue: 'Arrêter le live ?' })}
          description={t('live.stopLiveConfirmDescription', {
            defaultValue:
              'Le live sera coupé pour tous les spectateurs. Cette action est définitive.',
          })}
          confirmLabel={t('live.stopLive', { defaultValue: 'Arrêter le live' })}
          loading={stopping}
          loadingLabel={t('live.stopLiveStopping', { defaultValue: 'Arrêt…' })}
          onCancel={() => setShowStopConfirm(false)}
          onConfirm={() => void handleConfirmStop()}
        />
      ) : null}
    </>
  );
}
