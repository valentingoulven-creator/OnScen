import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { SpotifyPlaylistSummary } from '../types';
import type { CreateSalonPlaylistSelection } from './CreateSalonPlaylistPicker';

interface CreateSalonSpotifyPlaylistPickerProps {
  token: string;
  value: CreateSalonPlaylistSelection | null;
  onChange: (selection: CreateSalonPlaylistSelection | null) => void;
}

export function CreateSalonSpotifyPlaylistPicker({
  token,
  value,
  onChange,
}: CreateSalonSpotifyPlaylistPickerProps) {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealAccount, setIsRealAccount] = useState(false);
  const [spotifySessionValid, setSpotifySessionValid] = useState(true);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsReconnect(false);
    api
      .getSpotifyPlaylists(token)
      .then((r) => {
        if (cancelled) return;
        setPlaylists(r.playlists);
        setIsRealAccount(r.isRealAccount);
        setSpotifySessionValid(r.spotifySessionValid !== false);
        if (r.spotifySessionValid === false) {
          setNeedsReconnect(true);
          if (r.spotifySessionCode === 'spotify_scope_missing') {
            setError(t('salon.spotifySearch.errorPlaylistScopeMissing'));
          } else if (r.spotifySessionCode === 'spotify_premium_required') {
            setError(t('salon.spotifySearch.errorPremiumRequired'));
          } else if (r.spotifySessionCode) {
            setError(t('salon.spotifySearch.playlistSessionError'));
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('salon.spotifySearch.playlistError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const reconnectSpotify = async () => {
    setConnectingSpotify(true);
    setError(null);
    try {
      const { url } = await api.getSpotifyOAuthUrl(token, { reconnect: true });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platform.connectError'));
      setConnectingSpotify(false);
    }
  };

  const pickFromList = (playlistId: string) => {
    const p = playlists.find((x) => x.playlistId === playlistId);
    if (!p) return;
    setPlaylistUrl('');
    onChange({ playlistId: p.playlistId, title: p.title });
  };

  const pickFromUrl = () => {
    const url = playlistUrl.trim();
    if (!url) return;
    onChange({ playlistUrl: url, title: t('salon.spotifySearch.defaultPlaylistTitle') });
  };

  return (
    <div className="space-y-2">
      <span className="text-xs text-gray-400">{t('salon.spotifySearch.createPlaylistLabel')}</span>

      {value ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2">
          <span className="text-lg" aria-hidden>
            📋
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white font-medium truncate">{value.title}</p>
            <p className="text-[10px] text-gray-500 truncate">
              {value.playlistId || value.playlistUrl || t('salon.spotifySearch.playlistUrlPlaceholder')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlaylistUrl('');
              onChange(null);
            }}
            className="text-[10px] text-gray-400 hover:text-white px-2 py-1"
          >
            {t('salon.spotifySearch.remove')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-gray-500 leading-snug">
            {isRealAccount && spotifySessionValid
              ? t('salon.spotifySearch.playlistRealHint')
              : isRealAccount && !spotifySessionValid
                ? t('salon.spotifySearch.playlistSessionError')
                : t('salon.spotifySearch.playlistDemoHint')}
          </p>

          {loading ? (
            <p className="text-xs text-gray-500">{t('salon.spotifySearch.playlistLoading')}</p>
          ) : playlists.length > 0 ? (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) pickFromList(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm text-white"
              aria-label={t('salon.spotifySearch.createPlaylistPickLabel')}
            >
              <option value="" disabled>
                {t('salon.spotifySearch.createPlaylistPickLabel')}
              </option>
              {playlists.map((p) => (
                <option key={p.playlistId} value={p.playlistId}>
                  {p.title}
                  {p.itemCount != null ? ` (${p.itemCount})` : ''}
                </option>
              ))}
            </select>
          ) : !loading && isRealAccount && spotifySessionValid ? (
            <p className="text-[10px] text-gray-500">{t('salon.spotifySearch.createPlaylistEmpty')}</p>
          ) : null}

          <input
            type="url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            onBlur={pickFromUrl}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                pickFromUrl();
              }
            }}
            placeholder={t('salon.spotifySearch.playlistUrlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-xs text-white placeholder:text-gray-500"
          />

          {error && <p className="text-[10px] text-red-400">{error}</p>}

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

          <p className="text-[10px] text-gray-600">{t('salon.spotifySearch.createPlaylistHint')}</p>
          <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>
        </>
      )}
    </div>
  );
}
