import { useTranslation } from 'react-i18next';
import type { SpotifyPlaylistSummary } from '../types';

export interface SpotifyPlaylistPickerFieldsProps {
  playlists: SpotifyPlaylistSummary[];
  loading: boolean;
  isRealAccount: boolean;
  spotifySessionValid: boolean;
  libraryUnavailable?: boolean;
  needsReconnect: boolean;
  connectingSpotify: boolean;
  error: string | null;
  playlistUrl: string;
  onPlaylistUrlChange: (value: string) => void;
  onPickFromList: (playlistId: string) => void;
  onPickFromUrl: () => void;
  onReconnect: () => void;
  /** Select contrôlé (salon) vs defaultValue (create). */
  selectedPlaylistId?: string;
  selectMode?: 'controlled' | 'uncontrolled';
  pickLabelKey?: string;
  showEmptyHint?: boolean;
  inputClassName?: string;
  selectClassName?: string;
}

export function SpotifyPlaylistPickerFields({
  playlists,
  loading,
  isRealAccount,
  spotifySessionValid,
  libraryUnavailable = false,
  needsReconnect,
  connectingSpotify,
  error,
  playlistUrl,
  onPlaylistUrlChange,
  onPickFromList,
  onPickFromUrl,
  onReconnect,
  selectedPlaylistId,
  selectMode = 'uncontrolled',
  pickLabelKey = 'salon.spotifySearch.createPlaylistPickLabel',
  showEmptyHint = true,
  inputClassName = 'w-full px-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-xs text-white placeholder:text-gray-500',
  selectClassName = 'w-full px-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm text-white',
}: SpotifyPlaylistPickerFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-[10px] text-gray-500 leading-snug">
        {isRealAccount && spotifySessionValid && libraryUnavailable
          ? t('salon.spotifySearch.playlistPublicUrlHint')
          : isRealAccount && spotifySessionValid
            ? t('salon.spotifySearch.playlistRealHint')
            : isRealAccount && !spotifySessionValid
              ? t('salon.spotifySearch.playlistSessionError')
              : t('salon.spotifySearch.playlistDemoHint')}
      </p>

      {loading ? (
        <p className="text-xs text-gray-500">{t('salon.spotifySearch.playlistLoading')}</p>
      ) : playlists.length > 0 ? (
        selectMode === 'controlled' ? (
          <select
            value={selectedPlaylistId ?? ''}
            onChange={(e) => onPickFromList(e.target.value)}
            className={selectClassName}
            aria-label={t(pickLabelKey)}
          >
            {playlists.map((p) => (
              <option key={p.playlistId} value={p.playlistId}>
                {p.title}
                {p.itemCount != null ? ` (${p.itemCount})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onPickFromList(e.target.value);
            }}
            className={selectClassName}
            aria-label={t(pickLabelKey)}
          >
            <option value="" disabled>
              {t(pickLabelKey)}
            </option>
            {playlists.map((p) => (
              <option key={p.playlistId} value={p.playlistId}>
                {p.title}
                {p.itemCount != null ? ` (${p.itemCount})` : ''}
              </option>
            ))}
          </select>
        )
      ) : showEmptyHint && !loading && isRealAccount && spotifySessionValid ? (
        <p className="text-[10px] text-gray-500">{t('salon.spotifySearch.createPlaylistEmpty')}</p>
      ) : null}

      <input
        type="url"
        value={playlistUrl}
        onChange={(e) => onPlaylistUrlChange(e.target.value)}
        onBlur={onPickFromUrl}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onPickFromUrl();
          }
        }}
        placeholder={t('salon.spotifySearch.playlistUrlPlaceholder')}
        className={inputClassName}
      />

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {needsReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          disabled={connectingSpotify}
          className="w-full py-2 rounded-xl border border-[#1DB954]/40 bg-[#1DB954]/10 text-[#1DB954] text-xs font-semibold hover:bg-[#1DB954]/20 disabled:opacity-50 transition"
        >
          {connectingSpotify
            ? t('platform.redirecting')
            : t('salon.spotifySearch.playlistReconnectSpotify')}
        </button>
      )}
    </>
  );
}
