import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpotifyPlaylistLibrary } from '../hooks/useSpotifyPlaylistLibrary';
import { isSpotifyPlaylistUrlInput } from '../lib/spotifyPlaylistSession';
import { SpotifyPlaylistPickerFields } from './SpotifyPlaylistPickerFields';
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
  const [playlistUrl, setPlaylistUrl] = useState('');
  const library = useSpotifyPlaylistLibrary(token);

  const pickFromList = (playlistId: string) => {
    const playlist = library.playlists.find((p) => p.playlistId === playlistId);
    if (!playlist) return;
    library.setError(null);
    setPlaylistUrl('');
    onChange({ playlistId: playlist.playlistId, title: playlist.title });
  };

  const pickFromUrl = () => {
    const url = playlistUrl.trim();
    if (!url) return;
    if (!isSpotifyPlaylistUrlInput(url)) {
      library.setError(t('salon.spotifySearch.playlistUrlInvalid'));
      return;
    }
    library.setError(null);
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
            onPickFromList={pickFromList}
            onPickFromUrl={pickFromUrl}
            onReconnect={library.reconnectSpotify}
          />
          <p className="text-[10px] text-gray-600">{t('salon.spotifySearch.createPlaylistHint')}</p>
          <p className="text-[10px] text-gray-600">{t('salon.spotifySearch.createPlaylistPublicUrlHint')}</p>
          <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>
        </>
      )}
    </div>
  );
}
