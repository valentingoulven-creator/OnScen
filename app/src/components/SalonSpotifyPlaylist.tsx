import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSpotifyPlaylistLibrary } from '../hooks/useSpotifyPlaylistLibrary';
import { toSpotifyPlaylistRef, isSpotifyPlaylistUrlInput } from '../lib/spotifyPlaylistSession';
import { SpotifyPlaylistPickerFields } from './SpotifyPlaylistPickerFields';
import { PoweredBySpotify } from './PoweredBySpotify';
import type { PlaybackState, SalonQueueItem } from '../types';

interface SalonSpotifyPlaylistProps {
  salonId: string;
  token: string;
  onTrackChanged: (state: PlaybackState) => void;
  onQueueChanged?: (queue: SalonQueueItem[]) => void;
}

export function SalonSpotifyPlaylist({
  salonId,
  token,
  onTrackChanged,
  onQueueChanged,
}: SalonSpotifyPlaylistProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const library = useSpotifyPlaylistLibrary(token);

  useEffect(() => {
    if (library.playlists.length && !selectedId) {
      setSelectedId(library.playlists[0].playlistId);
    }
  }, [library.playlists, selectedId]);

  const launch = async () => {
    const urlInput = playlistUrl.trim();
    const usingPublicUrl = Boolean(urlInput);

    if (!library.isRealAccount) {
      library.setError(t('salon.spotifySearch.playlistDemoHint'));
      return;
    }

    if (!library.spotifySessionValid) {
      library.setError(t('salon.spotifySearch.playlistSessionError'));
      return;
    }

    if (usingPublicUrl && !isSpotifyPlaylistUrlInput(urlInput)) {
      library.setError(t('salon.spotifySearch.playlistUrlInvalid'));
      return;
    }

    const body = toSpotifyPlaylistRef(
      usingPublicUrl ? { playlistUrl: urlInput } : selectedId ? { playlistId: selectedId } : null
    );

    if (!body) {
      library.setError(t('salon.spotifySearch.playlistPickRequired'));
      return;
    }

    setLoadingPlay(true);
    library.setError(null);

    try {
      const verified = await library.verifyPlaylistAccess(body);
      if (!verified) return;

      const result = await api.salonLoadPlaylist(token, salonId, body);
      onTrackChanged(result.playbackState);
      onQueueChanged?.(result.queue);
      setPlaylistUrl('');
    } catch (e) {
      library.reportApiError(e, 'salon.spotifySearch.playlistLoadError');
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
          <p className="text-[10px] text-gray-600 leading-snug">{t('salon.spotifySearch.playlistChronoHint')}</p>

          <SpotifyPlaylistPickerFields
            playlists={library.playlists}
            loading={library.loading}
            isRealAccount={library.isRealAccount}
            spotifySessionValid={library.spotifySessionValid}
            libraryUnavailable={library.libraryUnavailable}
            needsReconnect={library.needsReconnect}
            connectingSpotify={library.connectingSpotify}
            error={library.error}
            playlistUrl={playlistUrl}
            onPlaylistUrlChange={setPlaylistUrl}
            onPickFromList={setSelectedId}
            onPickFromUrl={() => undefined}
            onReconnect={library.reconnectSpotify}
            selectedPlaylistId={selectedId}
            selectMode="controlled"
            showEmptyHint={false}
            inputClassName="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white placeholder:text-gray-500"
            selectClassName="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
          />

          <button
            type="button"
            disabled={loadingPlay}
            onClick={launch}
            className="w-full py-2 rounded-xl bg-[#1DB954]/90 hover:bg-[#1DB954] text-black text-sm font-semibold disabled:opacity-50 transition"
          >
            {loadingPlay ? t('salon.spotifySearch.playlistLoading') : t('salon.spotifySearch.playlistLaunch')}
          </button>

          <PoweredBySpotify className="text-[10px] text-[#1DB954]/70 text-center" />
        </div>
      )}
    </div>
  );
}
