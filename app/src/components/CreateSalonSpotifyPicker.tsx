import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { SpotifySearchResult } from '../types';

export interface CreateSalonSpotifySelection {
  trackLink: string;
  trackTitle: string;
  artist: string;
}

interface CreateSalonSpotifyPickerProps {
  token: string;
  value: CreateSalonSpotifySelection | null;
  onChange: (selection: CreateSalonSpotifySelection | null) => void;
}

export function CreateSalonSpotifyPicker({ token, value, onChange }: CreateSalonSpotifyPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
    setOpen(true);
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

  const pickResult = (item: SpotifySearchResult) => {
    onChange({
      trackLink: item.externalUrl,
      trackTitle: item.name,
      artist: item.artist,
    });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="space-y-2">
      <span className="text-xs text-gray-400">{t('salon.spotifySearch.createLabel')}</span>

      {value ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2">
          <span className="text-lg" aria-hidden>
            🎧
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white font-medium truncate">{value.trackTitle}</p>
            {value.artist ? (
              <p className="text-[10px] text-gray-500 truncate">{value.artist}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-gray-400 hover:text-white px-2 py-1"
          >
            {t('salon.spotifySearch.remove')}
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            placeholder={t('salon.spotifySearch.placeholder')}
            className="w-full rounded-xl bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2 text-sm text-white placeholder:text-gray-500"
            aria-label={t('salon.spotifySearch.placeholder')}
          />
          {open && (searching || results.length > 0 || error) ? (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#0b0b0f]">
              {searching ? (
                <p className="px-3 py-2 text-xs text-gray-500">{t('salon.spotifySearch.searching')}</p>
              ) : error ? (
                <p className="px-3 py-2 text-xs text-red-400">{error}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">{t('salon.spotifySearch.noResults')}</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a26]"
                  >
                    {r.albumArtUrl ? (
                      <div className="relative shrink-0">
                        <img src={r.albumArtUrl} alt="" className="w-10 h-10 rounded object-cover" />
                        <span className="absolute bottom-0 right-0 bg-[#1DB954] rounded px-0.5 text-[6px] font-bold text-black leading-none py-px">
                          Spotify
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg shrink-0" aria-hidden>
                        🎧
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{r.artist}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
          <p className="text-[10px] text-gray-600">{t('salon.spotifySearch.createHint')}</p>
          <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>
        </>
      )}
    </div>
  );
}
