import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { PlaybackState, YoutubeSearchResult } from '../types';

interface SalonYouTubeSearchProps {
  salonId: string;
  token: string;
  currentTitle: string;
  currentArtist: string;
  onTrackChanged: (state: PlaybackState) => void;
}

function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  return (
    raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/)?.[1] ??
    (raw.length <= 15 && /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : null)
  );
}

export function SalonYouTubeSearch({
  salonId,
  token,
  currentTitle,
  currentArtist,
  onTrackChanged,
}: SalonYouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
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
        .searchYoutube(token, q)
        .then((r) => setResults(r.results))
        .catch((e) => {
          setResults([]);
          setError(e instanceof Error ? e.message : 'Recherche impossible');
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token]);

  const playResult = async (item: YoutubeSearchResult) => {
    setChangingId(item.videoId);
    setError(null);
    try {
      const { playbackState } = await api.salonChangeTrack(token, salonId, {
        trackId: item.videoId,
        title: item.title,
        artist: item.artist,
        trackLink: item.externalUrl,
      });
      onTrackChanged(playbackState);
      setQuery('');
      setResults([]);
      setDropdownOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de changer de morceau');
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
    const videoId = parseYoutubeVideoId(q);
    if (videoId) {
      await playResult({
        videoId,
        title: 'Vidéo YouTube',
        artist: 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  };

  const showDropdown =
    dropdownOpen && query.trim().length >= 2 && (searching || results.length > 0 || Boolean(error));

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">Changer de morceau</p>
        <span className="text-[10px] text-gray-500 truncate max-w-[55%]">
          {currentTitle}
          {currentArtist ? ` · ${currentArtist}` : ''}
        </span>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" aria-hidden>
          ▶
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
          placeholder="Titre, artiste ou lien YouTube…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          autoComplete="off"
          aria-label="Rechercher un morceau YouTube"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        {showDropdown && (
          <div
            className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl overflow-hidden"
            role="listbox"
          >
            {searching && (
              <p className="text-xs text-gray-500 text-center py-3">Recherche YouTube…</p>
            )}
            {error && !searching && (
              <p className="text-xs text-red-400 text-center py-3 px-3">{error}</p>
            )}
            {!searching && !error && results.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-3 px-3 leading-snug">
                Aucun résultat — reformulez ou collez un lien youtube.com/watch?v=…
              </p>
            )}
            {!searching && results.length > 0 && (
              <ul className="max-h-52 overflow-y-auto py-1">
                {results.map((item) => (
                  <li key={item.videoId}>
                    <button
                      type="button"
                      disabled={changingId !== null}
                      onClick={() => playResult(item)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-[#1a1a26] text-left disabled:opacity-50 transition"
                      role="option"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="w-14 h-10 rounded-md object-cover bg-[#1e1e2f]"
                        />
                        {/* YouTube attribution — required by YouTube API Terms of Service */}
                        <span className="absolute bottom-0.5 right-0.5 bg-[#e62117] rounded px-1 text-[7px] font-bold text-white leading-none py-px tracking-tight">
                          YouTube
                        </span>
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-white font-medium truncate">{item.title}</span>
                        <span className="block text-[10px] text-gray-500 truncate">{item.artist}</span>
                      </span>
                      <span className="text-[10px] text-purple-300 font-bold shrink-0">
                        {changingId === item.videoId ? '…' : 'Lire'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 leading-snug">
        Recherche YouTube · lien direct accepté · le salon repart à 0:00 sur le nouveau morceau.
      </p>
    </div>
  );
}
