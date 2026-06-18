import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { PlaybackState, SalonQueueItem, YoutubeSearchResult } from '../types';

interface SalonYouTubeSearchProps {
  salonId: string;
  token: string;
  currentTitle: string;
  currentArtist: string;
  onTrackChanged?: (state: PlaybackState) => void;
  onQueueChanged?: (queue: SalonQueueItem[]) => void;
  /** queue = file directe (hôte/VIP). propose = PROPOSITIONS pour l'hôte (auditeur). */
  submitMode?: 'queue' | 'propose';
  /** Dans l'onglet panneau hôte — masque l'en-tête redondant. */
  embedded?: boolean;
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
  onQueueChanged,
  submitMode = 'queue',
  embedded = false,
}: SalonYouTubeSearchProps) {
  const { t } = useTranslation();
  const isProposeMode = submitMode === 'propose';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!infoToast) return;
    const timer = window.setTimeout(() => setInfoToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [infoToast]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setDropdownOpen(false);
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
          setError(e instanceof Error ? e.message : t('salon.youtubeSearch.errorGeneric'));
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, t]);

  const clearSearchUi = () => {
    setQuery('');
    setResults([]);
    setDropdownOpen(false);
  };

  const trackBodyFromResult = (item: YoutubeSearchResult) => ({
    trackId: item.videoId,
    title: item.title,
    artist: item.artist,
    trackLink: item.externalUrl,
  });

  const addResult = async (item: YoutubeSearchResult) => {
    setAddingId(item.videoId);
    setError(null);
    try {
      if (isProposeMode) {
        await api.proposeSalonTrack(token, salonId, {
          title: item.title,
          artist: item.artist,
          youtubeUrl: item.externalUrl,
        });
        setInfoToast(t('salon.youtubeSearch.proposeSuccess'));
        clearSearchUi();
        return;
      }

      const { queue } = await api.salonAddToQueue(token, salonId, trackBodyFromResult(item));
      onQueueChanged?.(queue);
      setInfoToast(t('salon.youtubeSearch.addSuccess'));
      clearSearchUi();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isProposeMode
            ? t('salon.youtubeSearch.proposeError')
            : t('salon.youtubeSearch.addError')
      );
    } finally {
      setAddingId(null);
    }
  };

  const submitQuery = async () => {
    const q = query.trim();
    if (!q || addingId) return;
    if (results.length > 0) {
      await addResult(results[0]);
      return;
    }
    const videoId = parseYoutubeVideoId(q);
    if (videoId) {
      await addResult({
        videoId,
        title: t('salon.youtubeSearch.defaultTrackTitle'),
        artist: 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  };

  const trimmedQuery = query.trim();
  const showDropdown = dropdownOpen && trimmedQuery.length >= 2;
  const showEmpty = !searching && !error && results.length === 0 && trimmedQuery.length >= 2;

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showDropdown, query, searching, results.length, error]);

  const actionLabel = isProposeMode ? t('salon.youtubeSearch.propose') : t('salon.youtubeSearch.add');

  return (
    <div ref={rootRef} className="relative space-y-2">
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
            {isProposeMode ? t('salon.youtubeSearch.proposeTrack') : t('salon.youtubeSearch.addToQueue')}
          </p>
          <span className="text-[10px] text-gray-500 truncate max-w-[55%]">
            {currentTitle}
            {currentArtist ? ` · ${currentArtist}` : ''}
          </span>
        </div>
      ) : null}

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" aria-hidden>
          ▶
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setDropdownOpen(true);
          }}
          onFocus={() => trimmedQuery.length >= 2 && setDropdownOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitQuery();
            }
            if (e.key === 'Escape') {
              setDropdownOpen(false);
            }
          }}
          placeholder={t('salon.youtubeSearch.placeholder')}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          autoComplete="off"
          aria-label={t('salon.youtubeSearch.placeholder')}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        {showDropdown &&
          createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl overflow-hidden"
              role="listbox"
            >
              {searching && results.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">{t('salon.youtubeSearch.searching')}</p>
              ) : null}
              {error && !searching ? (
                <p className="text-xs text-red-400 text-center py-3 px-3">{error}</p>
              ) : null}
              {showEmpty ? (
                <p className="text-xs text-gray-500 text-center py-3 px-3 leading-snug">
                  {t('salon.youtubeSearch.noResultsHint')}
                </p>
              ) : null}
              {!searching && results.length > 0 ? (
                <ul className="max-h-52 overflow-y-auto py-1">
                  {results.map((item) => (
                    <li key={item.videoId}>
                      <button
                        type="button"
                        disabled={addingId !== null}
                        onClick={() => addResult(item)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-[#1a1a26] text-left disabled:opacity-50 transition"
                        role="option"
                      >
                        <div className="relative shrink-0">
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="w-14 h-10 rounded-md object-cover bg-[#1e1e2f]"
                          />
                          <span className="absolute bottom-0.5 right-0.5 bg-[#e62117] rounded px-1 text-[7px] font-bold text-white leading-none py-px tracking-tight">
                            YouTube
                          </span>
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-white font-medium truncate">{item.title}</span>
                          <span className="block text-[10px] text-gray-500 truncate">{item.artist}</span>
                        </span>
                        <span className="text-[10px] text-purple-300 font-bold shrink-0">
                          {addingId === item.videoId ? '…' : actionLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>,
            document.body
          )}
      </div>

      <p className="text-[10px] text-gray-600 leading-snug">
        {isProposeMode ? t('salon.youtubeSearch.proposeHint') : t('salon.youtubeSearch.addHint')}
      </p>

      {infoToast ? (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-green-950/95 border border-green-500/40 text-sm text-green-100 shadow-lg text-center"
          role="status"
        >
          {infoToast}
        </div>
      ) : null}
    </div>
  );
}
