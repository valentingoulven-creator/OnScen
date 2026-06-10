import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { PlaybackState, SpotifySearchResult } from '../types';

interface SalonSpotifySearchProps {
  salonId: string;
  token: string;
  currentTitle: string;
  currentArtist: string;
  onTrackChanged: (state: PlaybackState) => void;
}

function parseSpotifyTrackId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  return (
    raw.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)?.[1] ??
    raw.match(/^spotify:track:([a-zA-Z0-9]+)$/)?.[1] ??
    (raw.length <= 30 && /^[a-zA-Z0-9]+$/.test(raw) ? raw : null)
  );
}

export function SalonSpotifySearch({
  salonId,
  token,
  currentTitle,
  currentArtist,
  onTrackChanged,
}: SalonSpotifySearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    setDropdownOpen(true);
    debounceRef.current = setTimeout(() => {
      api
        .searchSpotify(token, q)
        .then((r) => setResults(r.results))
        .catch((e) => {
          setResults([]);
          setError(e instanceof Error ? e.message : t('salon.spotifySearch.errorGeneric'));
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, t]);

  const playResult = async (item: SpotifySearchResult) => {
    setChangingId(item.id);
    setError(null);
    try {
      const { playbackState } = await api.salonChangeTrack(token, salonId, {
        trackId: item.id,
        title: item.name,
        artist: item.artist,
        trackLink: item.externalUrl,
        albumArtUrl: item.albumArtUrl || undefined,
      });
      onTrackChanged(playbackState);
      setQuery('');
      setResults([]);
      setDropdownOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('salon.spotifySearch.changeError'));
    } finally {
      setChangingId(null);
    }
  };

  const submitQuery = async () => {
    const q = query.trim();
    if (!q || changingId) return;
    if (results.length > 0) {
      await playResult(results[0]);
      return;
    }
    const trackId = parseSpotifyTrackId(q);
    if (trackId) {
      await playResult({
        id: trackId,
        uri: `spotify:track:${trackId}`,
        name: t('salon.spotifySearch.defaultTrackTitle'),
        artist: 'Spotify',
        albumArtUrl: '',
        externalUrl: `https://open.spotify.com/track/${trackId}`,
      });
    }
  };

  const showDropdown =
    dropdownOpen && query.trim().length >= 2 && (searching || results.length > 0 || Boolean(error));

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
          {t('salon.spotifySearch.changeTrack')}
        </p>
        <span className="text-[10px] text-gray-500 truncate max-w-[55%]">
          {currentTitle}
          {currentArtist ? ` · ${currentArtist}` : ''}
        </span>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" aria-hidden>
          🎧
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setDropdownOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitQuery();
            }
            if (e.key === 'Escape') {
              setDropdownOpen(false);
            }
          }}
          placeholder={t('salon.spotifySearch.placeholder')}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"
          autoComplete="off"
          aria-label={t('salon.spotifySearch.placeholder')}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        {showDropdown && (
          <div
            className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl overflow-hidden"
            role="listbox"
          >
            {searching && (
              <p className="text-xs text-gray-500 text-center py-3">{t('salon.spotifySearch.searching')}</p>
            )}
            {error && !searching && (
              <p className="text-xs text-red-400 text-center py-3 px-3">{error}</p>
            )}
            {!searching && !error && results.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-3 px-3 leading-snug">
                {t('salon.spotifySearch.noResultsHint')}
              </p>
            )}
            {!searching && results.length > 0 && (
              <ul className="max-h-52 overflow-y-auto py-1">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={changingId !== null}
                      onClick={() => playResult(item)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-[#1a1a26] text-left disabled:opacity-50 transition"
                      role="option"
                    >
                      <div className="relative shrink-0">
                        {item.albumArtUrl ? (
                          <img
                            src={item.albumArtUrl}
                            alt=""
                            className="w-14 h-10 rounded-md object-cover bg-[#1e1e2f]"
                          />
                        ) : (
                          <div className="w-14 h-10 rounded-md bg-[#1e1e2f] flex items-center justify-center text-lg">
                            🎧
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 bg-[#1DB954] rounded px-1 text-[7px] font-bold text-black leading-none py-px tracking-tight">
                          Spotify
                        </span>
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-white font-medium truncate">{item.name}</span>
                        <span className="block text-[10px] text-gray-500 truncate">{item.artist}</span>
                      </span>
                      <span className="text-[10px] text-green-300 font-bold shrink-0">
                        {changingId === item.id ? '…' : t('salon.spotifySearch.play')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 leading-snug">{t('salon.spotifySearch.changeHint')}</p>
      <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>
    </div>
  );
}
