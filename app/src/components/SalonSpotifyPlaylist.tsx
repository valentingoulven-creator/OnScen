import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import type { PlaybackState, SalonQueueItem, SpotifyPlaylistSummary } from '../types';

interface SalonSpotifyPlaylistProps {
  salonId: string;
  token: string;
  onTrackChanged: (state: PlaybackState) => void;
  onQueueChanged?: (queue: SalonQueueItem[]) => void;
}

const SPOTIFY_RECONNECT_CODES = new Set([
  'spotify_token_expired',
  'spotify_scope_missing',
  'spotify_not_connected',
]);

export function SalonSpotifyPlaylist({
  salonId,
  token,
  onTrackChanged,
  onQueueChanged,
}: SalonSpotifyPlaylistProps) {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [isRealAccount, setIsRealAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    api
      .getSpotifyPlaylists(token)
      .then((r) => {
        if (cancelled) return;
        setPlaylists(r.playlists);
        setIsRealAccount(r.isRealAccount);
        if (r.playlists.length) setSelectedId(r.playlists[0].playlistId);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('salon.spotifySearch.playlistError'));
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const reconnectSpotify = async () => {
    setConnectingSpotify(true);
    setError(null);
    try {
      const { url } = await api.getSpotifyOAuthUrl(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.connectError'));
      setConnectingSpotify(false);
    }
  };

  const launch = async () => {
    if (!isRealAccount) {
      setError(t('salon.spotifySearch.playlistDemoHint'));
      return;
    }
    const body = playlistUrl.trim()
      ? { playlistUrl: playlistUrl.trim() }
      : selectedId
        ? { playlistId: selectedId }
        : null;
    if (!body) {
      setError(t('salon.spotifySearch.playlistPickRequired'));
      return;
    }
    setLoadingPlay(true);
    setError(null);
    setNeedsReconnect(false);
    try {
      const r = await api.salonLoadPlaylist(token, salonId, body);
      onTrackChanged(r.playbackState);
      onQueueChanged?.(r.queue);
      setPlaylistUrl('');
    } catch (e) {
      if (e instanceof ApiRequestError && e.code && SPOTIFY_RECONNECT_CODES.has(e.code)) {
        setNeedsReconnect(true);
      }
      setError(e instanceof Error ? e.message : t('salon.spotifySearch.playlistLoadError'));
    } finally {
      setLoadingPlay(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-1 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
            {t('salon.spotifySearch.playlistHostLabel')}
          </span>
          <span className="inline-flex items-center bg-[#1DB954] rounded px-1 text-[7px] font-bold text-black leading-none py-px tracking-tight">
            Spotify
          </span>
        </span>
        <span className="text-[10px] text-gray-500">{expanded ? 'Masquer ▲' : 'Afficher ▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-gray-500 leading-snug">
            {isRealAccount
              ? t('salon.spotifySearch.playlistRealHint')
              : t('salon.spotifySearch.playlistDemoHint')}
          </p>
          <p className="text-[10px] text-gray-600 leading-snug">
            {t('salon.spotifySearch.playlistChronoHint')}
          </p>

          {loadingList ? (
            <p className="text-xs text-gray-500 text-center py-1">{t('salon.spotifySearch.playlistLoading')}</p>
          ) : playlists.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
            >
              {playlists.map((p) => (
                <option key={p.playlistId} value={p.playlistId}>
                  {p.title}
                  {p.itemCount != null ? ` (${p.itemCount})` : ''}
                </option>
              ))}
            </select>
          ) : null}

          <input
            type="url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder={t('salon.spotifySearch.playlistUrlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white placeholder:text-gray-500"
          />

          <button
            type="button"
            disabled={loadingPlay}
            onClick={launch}
            className="w-full py-2 rounded-xl bg-[#1DB954]/90 hover:bg-[#1DB954] text-black text-sm font-semibold disabled:opacity-50 transition"
          >
            {loadingPlay ? t('salon.spotifySearch.playlistLoading') : t('salon.spotifySearch.playlistLaunch')}
          </button>

          {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
          {needsReconnect && (
            <button
              type="button"
              onClick={reconnectSpotify}
              disabled={connectingSpotify}
              className="w-full py-2 rounded-xl border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] text-xs font-semibold hover:bg-[#1DB954]/20 disabled:opacity-50 transition"
            >
              {connectingSpotify
                ? t('platform.redirecting')
                : t('salon.spotifySearch.playlistReconnectSpotify')}
            </button>
          )}
          <p className="text-[10px] text-[#1DB954]/70 text-center">{t('salon.spotifySearch.poweredBy')}</p>
        </div>
      )}
    </div>
  );
}
