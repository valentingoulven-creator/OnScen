import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import {
  isProfilePlatformConnected,
  PLATFORM_LABELS,
  type ConnectPlatform,
  type PlatformLinkSummary,
} from '../lib/platformConnect';
import { PLATFORM_STATUS_REFRESH_EVENT } from '../lib/platformStatusEvents';
import type { User } from '../types';
import { ConfirmModal } from './ConfirmModal';

type PlatformLink = {
  platform: ConnectPlatform;
  externalUserId: string;
  connectedAt: number;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  topArtists?: string[];
  isRealOAuth?: boolean;
};

interface PlatformConnectCardProps {
  token: string;
  platform: ConnectPlatform;
  connectedPlatforms?: User['connectedPlatforms'];
  platformLinks?: User['platformLinks'];
  compact?: boolean;
  onUserUpdated?: (user: User) => void;
}

function platformCardClasses(platform: ConnectPlatform, linked: boolean): string {
  if (!linked) return 'border-[#2d2d3d] bg-[#1a1a26]';
  if (platform === 'instagram') return 'border-pink-500/40 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-[#1a1a26]';
  return 'border-red-500/40 bg-red-500/5';
}

function platformCompactClasses(platform: ConnectPlatform): string {
  if (platform === 'instagram') return 'text-pink-400 border-pink-500/40 bg-pink-500/10';
  return 'text-red-400 border-red-500/40 bg-red-500/10';
}

function platformConnectButtonClasses(platform: ConnectPlatform, available: boolean): string {
  const base = 'w-full py-2.5 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50';
  if (platform === 'instagram') {
    return `${base} ${available ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 hover:from-pink-400 hover:via-purple-400 hover:to-orange-300' : 'bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 opacity-40 cursor-not-allowed'}`;
  }
  return `${base} ${available ? 'bg-red-600 hover:bg-red-500' : 'bg-red-600 opacity-40 cursor-not-allowed'}`;
}

export function PlatformConnectCard({
  token,
  platform,
  connectedPlatforms: _connectedPlatforms,
  platformLinks,
  compact,
  onUserUpdated,
}: PlatformConnectCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [youtubeOAuthAvailable, setYoutubeOAuthAvailable] = useState(false);
  const [youtubeMockConnectAvailable, setYoutubeMockConnectAvailable] = useState(false);
  const [instagramOAuthAvailable, setInstagramOAuthAvailable] = useState(false);
  const [platformLink, setPlatformLink] = useState<PlatformLink | undefined>();
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  const mergedPlatformLinks: PlatformLinkSummary[] = [
    ...(platformLinks ?? []),
    ...(platformLink && !platformLinks?.some((l) => l.platform === platform) ? [platformLink] : []),
  ];
  const linked = isProfilePlatformConnected(
    platform,
    mergedPlatformLinks.length ? mergedPlatformLinks : undefined
  );
  const meta = PLATFORM_LABELS[platform];

  const linkFromUser = platformLinks?.find((l) => l.platform === platform);

  const activeLink = useMemo((): PlatformLink | undefined => {
    if (!linkFromUser && !platformLink) return undefined;
    const name =
      platformLink?.displayName?.trim() ||
      linkFromUser?.displayName?.trim() ||
      platformLink?.email?.trim() ||
      linkFromUser?.email?.trim();
    return {
      platform,
      externalUserId: platformLink?.externalUserId ?? linkFromUser?.externalUserId ?? '',
      connectedAt: platformLink?.connectedAt ?? linkFromUser?.connectedAt ?? 0,
      ...(name ? { displayName: name } : {}),
      ...((platformLink?.avatarUrl ?? linkFromUser?.avatarUrl)
        ? { avatarUrl: platformLink?.avatarUrl ?? linkFromUser?.avatarUrl }
        : {}),
      ...((platformLink?.email ?? linkFromUser?.email)
        ? { email: platformLink?.email ?? linkFromUser?.email }
        : {}),
      isRealOAuth: platformLink?.isRealOAuth ?? linkFromUser?.isRealOAuth,
    };
  }, [linkFromUser, platform, platformLink]);

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    setStatusError(null);
    api
      .getPlatformStatus(token)
      .then((s) => {
        setYoutubeOAuthAvailable(s.youtubeOAuthAvailable);
        setYoutubeMockConnectAvailable(Boolean(s.youtubeMockConnectAvailable));
        setInstagramOAuthAvailable(s.instagramOAuthAvailable);
        setPlatformLink(s.links.find((l) => l.platform === platform));
      })
      .catch((e) => {
        setStatusError(e instanceof Error ? e.message : t('errors.network'));
      })
      .finally(() => setStatusLoading(false));
  }, [token, platform, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, linked]);

  useEffect(() => {
    const onRefresh = () => loadStatus();
    window.addEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
  }, [loadStatus]);

  const connectMock = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.connectPlatform(token, platform);
      onUserUpdated?.(r.user);
      loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.connectError'));
    } finally {
      setBusy(false);
    }
  };

  const connectYoutube = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.getYoutubeOAuthUrl(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.connectError'));
      setBusy(false);
    }
  };

  const connectInstagram = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.getInstagramOAuthUrl(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.connectError'));
      setBusy(false);
    }
  };

  const performDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.disconnectPlatform(token, platform);
      onUserUpdated?.(r.user);
      loadStatus();
      setDisconnectConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.disconnectError'));
    } finally {
      setBusy(false);
    }
  };

  const linkedAccountName = linked ? activeLink?.displayName?.trim() : undefined;
  const accountSubtitle = linked
    ? linkedAccountName ??
      (platform === 'youtube'
        ? t('platform.linkedYoutube')
        : platform === 'instagram'
          ? t('platform.linkedInstagram')
          : t('platform.linkedGeneric'))
    : platform === 'instagram'
      ? t('platform.instagramHint')
      : t('platform.hostRequired');

  const avatarUrl = linked ? activeLink?.avatarUrl : undefined;

  if (compact && linked) {
    return (
      <span
        title={linkedAccountName ? accountSubtitle : undefined}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${platformCompactClasses(platform)}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" loading="lazy" decoding="async" />
        ) : (
          meta.emoji
        )}{' '}
        {accountSubtitle}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${platformCardClasses(platform, linked)}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {linked && avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-[#2d2d3d] shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-lg shrink-0">{meta.emoji}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{meta.label}</p>
            <p
              className={`mt-0.5 truncate ${
                linked && linkedAccountName
                  ? 'text-sm font-semibold text-gray-100'
                  : linked
                    ? 'text-[10px] text-gray-500'
                    : 'text-[10px] text-gray-500'
              }`}
            >
              {accountSubtitle}
            </p>
          </div>
        </div>
        {linked ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 border-[#2d2d3d] text-green-400">
            {t('platform.connected')}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {linked ? (
          <button
            type="button"
            onClick={() => setDisconnectConfirmOpen(true)}
            disabled={busy}
            className="w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
          >
            {t('platform.disconnect')}
          </button>
        ) : platform === 'youtube' ? (
          <>
            <button
              type="button"
              onClick={youtubeOAuthAvailable ? connectYoutube : undefined}
              disabled={busy || !youtubeOAuthAvailable || statusLoading}
              title={!youtubeOAuthAvailable ? t('platform.configureYoutubeServer') : undefined}
              className={platformConnectButtonClasses('youtube', youtubeOAuthAvailable)}
            >
              {busy ? t('platform.redirecting') : statusLoading ? t('platform.loading') : t(meta.connectKey)}
            </button>
            {!youtubeOAuthAvailable && !statusLoading && (
              <button
                type="button"
                onClick={connectMock}
                disabled={busy}
                className="w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
              >
                {t('platform.demoConnectYoutube')}
              </button>
            )}
            {youtubeOAuthAvailable && youtubeMockConnectAvailable && !statusLoading && (
              <button
                type="button"
                onClick={connectMock}
                disabled={busy}
                className="w-full py-2 rounded-lg border border-[#2d2d3d] text-xs text-gray-400 hover:text-white disabled:opacity-50"
              >
                {t('platform.demoConnectYoutube')}
              </button>
            )}
          </>
        ) : platform === 'instagram' ? (
          <button
            type="button"
            onClick={instagramOAuthAvailable ? connectInstagram : undefined}
            disabled={busy || !instagramOAuthAvailable || statusLoading}
            title={!instagramOAuthAvailable ? t('platform.configureInstagramServer') : undefined}
            className={platformConnectButtonClasses('instagram', instagramOAuthAvailable)}
          >
            {busy ? t('platform.redirecting') : statusLoading ? t('platform.loading') : t(meta.connectKey)}
          </button>
        ) : (
          <button
            type="button"
            onClick={connectMock}
            disabled={busy}
            className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? t('platform.connecting') : t(meta.connectKey)}
          </button>
        )}
      </div>
      {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
      {statusError && (
        <p className="text-[10px] text-amber-400 mt-2 leading-snug">
          {statusError}{' '}
          <button
            type="button"
            onClick={loadStatus}
            disabled={statusLoading}
            className="underline hover:text-amber-300 disabled:opacity-50"
          >
            {t('platform.retryStatus')}
          </button>
        </p>
      )}
      {platform === 'youtube' && !linked && !statusLoading && !statusError && (
        <p className="text-[10px] text-gray-500 mt-2 leading-snug">{t('platform.youtubeScopesHint')}</p>
      )}
      {platform === 'youtube' && !linked && !youtubeOAuthAvailable && !statusLoading && !statusError && (
        <p className="text-[10px] text-gray-500 mt-1 leading-snug">{t('platform.youtubeEnvHint')}</p>
      )}
      {platform === 'instagram' && !linked && !instagramOAuthAvailable && !statusLoading && !statusError && (
        <p className="text-[10px] text-gray-500 mt-2 leading-snug">{t('platform.instagramEnvHint')}</p>
      )}
      <ConfirmModal
        open={disconnectConfirmOpen}
        title={t('platform.disconnectConfirmTitle', {
          label: meta.label,
          defaultValue: 'Déconnecter {{label}} ?',
        })}
        description={
          platform === 'instagram'
            ? t('platform.disconnectConfirmInstagramDesc', {
                defaultValue: 'Votre profil n’affichera plus ce compte lié.',
              })
            : t('platform.disconnectConfirmHostDesc', {
                label: meta.label,
                defaultValue: 'Vous ne pourrez plus héberger de salon {{label}}.',
              })
        }
        cancelLabel={t('common.cancel', { defaultValue: 'Annuler' })}
        confirmLabel={t('platform.disconnect')}
        destructive
        loading={busy}
        loadingLabel={t('platform.disconnecting', { defaultValue: 'Déconnexion…' })}
        onCancel={() => {
          if (!busy) setDisconnectConfirmOpen(false);
        }}
        onConfirm={() => void performDisconnect()}
      />
    </div>
  );
}
