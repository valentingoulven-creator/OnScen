import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import {
  isPlatformConnected,
  PLATFORM_LABELS,
  type ConnectPlatform,
} from '../lib/platformConnect';
import { PLATFORM_STATUS_REFRESH_EVENT } from '../lib/platformStatusEvents';
import type { User } from '../types';

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
  if (platform === 'spotify') return 'border-green-500/40 bg-green-500/5';
  if (platform === 'instagram') return 'border-pink-500/40 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-[#1a1a26]';
  return 'border-red-500/40 bg-red-500/5';
}

function platformCompactClasses(platform: ConnectPlatform): string {
  if (platform === 'spotify') return 'text-green-400 border-green-500/40 bg-green-500/10';
  if (platform === 'instagram') return 'text-pink-400 border-pink-500/40 bg-gradient-to-r from-pink-500/15 to-purple-500/15';
  return 'text-red-400 border-red-500/40 bg-red-500/10';
}

function platformConnectButtonClasses(platform: ConnectPlatform, available: boolean): string {
  const base = 'w-full py-2.5 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50';
  if (platform === 'spotify') {
    return `${base} ${available ? 'bg-green-600 hover:bg-green-500' : 'bg-green-600 opacity-40 cursor-not-allowed'}`;
  }
  if (platform === 'instagram') {
    return `${base} ${available ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 hover:from-pink-400 hover:via-purple-400 hover:to-orange-300' : 'bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 opacity-40 cursor-not-allowed'}`;
  }
  return `${base} ${available ? 'bg-red-600 hover:bg-red-500' : 'bg-red-600 opacity-40 cursor-not-allowed'}`;
}

export function PlatformConnectCard({
  token,
  platform,
  connectedPlatforms,
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
  const [spotifyOAuthAvailable, setSpotifyOAuthAvailable] = useState(false);
  const [instagramOAuthAvailable, setInstagramOAuthAvailable] = useState(false);
  const [platformLink, setPlatformLink] = useState<PlatformLink | undefined>();
  const [spotifySessionValid, setSpotifySessionValid] = useState<boolean | undefined>();
  const [spotifySessionCode, setSpotifySessionCode] = useState<string | undefined>();
  const [spotifyNeedsScopeReconnect, setSpotifyNeedsScopeReconnect] = useState(false);
  const [spotifyProduct, setSpotifyProduct] = useState<string | undefined>();
  const [spotifyPremium, setSpotifyPremium] = useState<boolean | undefined>();

  const linked = isPlatformConnected(connectedPlatforms, platform, platformLinks ?? (platformLink ? [platformLink] : undefined));
  const spotifyNeedsReconnect =
    platform === 'spotify' && linked && spotifySessionValid === false;
  const spotifyPremiumRequired =
    platform === 'spotify' &&
    linked &&
    (spotifySessionCode === 'spotify_premium_required' || spotifyPremium === false);
  const spotifyScopeMissing =
    platform === 'spotify' &&
    linked &&
    (spotifySessionCode === 'spotify_scope_missing' || spotifyNeedsScopeReconnect);
  const meta = PLATFORM_LABELS[platform];

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    setStatusError(null);
    api
      .getPlatformStatus(token)
      .then((s) => {
        setYoutubeOAuthAvailable(s.youtubeOAuthAvailable);
        setSpotifyOAuthAvailable(s.spotifyOAuthAvailable);
        setInstagramOAuthAvailable(s.instagramOAuthAvailable);
        setPlatformLink(s.links.find((l) => l.platform === platform));
        setSpotifySessionValid(s.spotifySessionValid);
        setSpotifySessionCode(s.spotifySessionCode);
        setSpotifyNeedsScopeReconnect(Boolean(s.spotifyNeedsScopeReconnect));
        setSpotifyProduct(s.spotifyProduct);
        setSpotifyPremium(s.spotifyPremium);
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

  const connectSpotify = async (options?: { reconnect?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.getSpotifyOAuthUrl(token, { reconnect: options?.reconnect });
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

  const disconnect = async () => {
    const msg =
      platform === 'instagram'
        ? t('platform.disconnectConfirmInstagram', { label: meta.label })
        : t('platform.disconnectConfirmHost', { label: meta.label });
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.disconnectPlatform(token, platform);
      onUserUpdated?.(r.user);
      loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.disconnectError'));
    } finally {
      setBusy(false);
    }
  };

  const displayName = linked
    ? platformLink?.displayName ??
      (platform === 'spotify'
        ? t('platform.linkedSpotify')
        : platform === 'youtube'
          ? t('platform.linkedYoutube')
          : platform === 'instagram'
            ? t('platform.linkedInstagram')
            : t('platform.linkedGeneric'))
    : platform === 'instagram'
      ? t('platform.instagramHint')
      : t('platform.hostRequired');

  const avatarUrl = linked ? platformLink?.avatarUrl : undefined;
  const topArtists = linked && platform === 'spotify' ? platformLink?.topArtists : undefined;

  if (compact && linked) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${platformCompactClasses(platform)}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
        ) : (
          meta.emoji
        )}{' '}
        {displayName}
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
            />
          ) : (
            <span className="text-lg shrink-0">{meta.emoji}</span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{meta.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">{displayName}</p>
            {topArtists?.length ? (
              <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                {t('platform.topArtists', { artists: topArtists.slice(0, 3).join(', ') })}
              </p>
            ) : null}
          </div>
        </div>
        {linked ? (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full bg-[#12121a] border shrink-0 ${
              spotifyPremiumRequired
                ? 'border-red-500/40 text-red-400'
                : spotifyNeedsReconnect
                  ? 'border-amber-500/40 text-amber-400'
                  : 'border-[#2d2d3d] text-green-400'
            }`}
          >
            {spotifyPremiumRequired
              ? t('platform.spotifyPremiumBadge')
              : platform === 'spotify' && spotifyPremium === true
                ? t('platform.spotifyPremiumOk')
                : spotifyNeedsReconnect
                  ? t('platform.sessionExpired')
                  : t('platform.connected')}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {linked ? (
          <button
            type="button"
            onClick={disconnect}
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
          </>
        ) : platform === 'spotify' ? (
          <button
            type="button"
            onClick={spotifyOAuthAvailable ? () => connectSpotify({ reconnect: spotifyScopeMissing }) : undefined}
            disabled={busy || !spotifyOAuthAvailable || statusLoading}
            title={!spotifyOAuthAvailable ? t('platform.configureSpotifyServer') : undefined}
            className={platformConnectButtonClasses('spotify', spotifyOAuthAvailable)}
          >
            {busy ? t('platform.redirecting') : statusLoading ? t('platform.loading') : t(meta.connectKey)}
          </button>
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
      {platform === 'spotify' && spotifyPremiumRequired && !statusLoading && !statusError && (
        <p className="text-[10px] text-red-400 mt-2 leading-snug">
          {spotifyProduct === 'free' || spotifyProduct === 'open'
            ? t('platform.spotifyFreeNoHost')
            : t('platform.spotifyPremiumRequiredHint')}
        </p>
      )}
      {platform === 'spotify' && spotifyScopeMissing && !spotifyPremiumRequired && !statusLoading && !statusError && (
        <p className="text-[10px] text-amber-400 mt-2 leading-snug">
          {t('platform.spotifyScopeReconnectHint')}{' '}
          <button
            type="button"
            onClick={() => connectSpotify({ reconnect: true })}
            disabled={busy || !spotifyOAuthAvailable}
            className="underline hover:text-amber-300 disabled:opacity-50"
          >
            {t('salon.spotifySearch.playlistReconnectSpotify')}
          </button>
        </p>
      )}
      {platform === 'spotify' &&
        spotifyNeedsReconnect &&
        !spotifyScopeMissing &&
        !spotifyPremiumRequired &&
        !statusLoading &&
        !statusError && (
        <p className="text-[10px] text-amber-400 mt-2 leading-snug">
          {t('platform.spotifySessionExpiredHint')}{' '}
          <button
            type="button"
            onClick={() => connectSpotify({ reconnect: true })}
            disabled={busy || !spotifyOAuthAvailable}
            className="underline hover:text-amber-300 disabled:opacity-50"
          >
            {t('salon.spotifySearch.playlistReconnectSpotify')}
          </button>
        </p>
      )}
      {platform === 'spotify' && linked && spotifyPremium === true && !spotifyPremiumRequired && !statusLoading && !statusError && (
        <p className="text-[10px] text-green-400/80 mt-2 leading-snug">{t('platform.spotifyPremiumOk')}</p>
      )}
      {platform === 'spotify' && !statusLoading && !statusError && (
        <p className="text-[10px] text-gray-500 mt-2 leading-snug">{t('platform.spotifyScopesHint')}</p>
      )}
      {platform === 'spotify' && !statusLoading && !statusError && (
        <p className="text-[10px] text-green-400/70 mt-1 leading-snug">{t('platform.spotifyPremiumHostHint')}</p>
      )}
      {platform === 'spotify' && !linked && !spotifyOAuthAvailable && !statusLoading && !statusError && (
        <p className="text-[10px] text-gray-500 mt-1 leading-snug">{t('platform.spotifyEnvHint')}</p>
      )}
      {platform === 'spotify' && !linked && spotifyOAuthAvailable && !statusLoading && !statusError && (
        <p className="text-[10px] text-amber-400/80 mt-1 leading-snug">{t('platform.spotifyDevQuotaHint')}</p>
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
    </div>
  );
}
