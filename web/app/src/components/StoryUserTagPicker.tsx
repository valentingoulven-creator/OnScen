import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { StoryTaggedUser, UserSearchHit } from '../types';

interface StoryUserTagPickerProps {
  token: string;
  tagged: StoryTaggedUser[];
  onChange: (tagged: StoryTaggedUser[]) => void;
  activeTagId?: string | null;
  onActiveTagChange?: (id: string | null) => void;
  maxTags?: number;
  /** Total tagués (stickers + mentions @ dans le texte), pour la limite globale. */
  totalTagCount?: number;
}

export function StoryUserTagPicker({
  token,
  tagged,
  onChange,
  activeTagId = null,
  onActiveTagChange,
  maxTags = 5,
  totalTagCount,
}: StoryUserTagPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, q)
        .then((r) => setResults(r.users))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  const effectiveTotal = totalTagCount ?? tagged.length;

  const addTag = (hit: UserSearchHit) => {
    if (tagged.some((t) => t.id === hit.id)) return;
    if (effectiveTotal >= maxTags) return;
    onChange([
      ...tagged,
      {
        id: hit.id,
        username: hit.username,
        avatarUrl: hit.avatarUrl,
        usernameColor: hit.usernameColor,
        usernameWaveFrom: hit.usernameWaveFrom,
        usernameWaveTo: hit.usernameWaveTo,
      },
    ]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const removeTag = (id: string) => {
    onChange(tagged.filter((t) => t.id !== id));
    if (activeTagId === id) {
      onActiveTagChange?.(null);
    }
  };

  return (
    <div ref={rootRef} className="space-y-2">
      <p className="text-xs font-semibold text-gray-300">Taguer des personnes</p>

      {tagged.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tagged.map((t) => {
            const isActive = activeTagId === t.id;
            return (
            <button
              key={t.id}
              type="button"
              onClick={() => onActiveTagChange?.(t.id)}
              className={`inline-flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 transition ${
                isActive
                  ? 'bg-purple-600/35 border border-purple-400/70 ring-1 ring-purple-400/40'
                  : 'bg-purple-600/20 border border-purple-500/30 hover:border-purple-400/50'
              }`}
              aria-pressed={isActive}
              aria-label={`Sélectionner ${t.username}`}
            >
              <UserAvatarOnline userId={t.id} username={t.username} avatarUrl={t.avatarUrl} size="sm" />
              <UsernameDisplay
                username={t.username}
                usernameColor={t.usernameColor}
                usernameWaveFrom={t.usernameWaveFrom}
                usernameWaveTo={t.usernameWaveTo}
                className="text-[10px] font-medium"
              />
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(t.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    removeTag(t.id);
                  }
                }}
                className="text-gray-400 hover:text-white ml-0.5"
                aria-label={`Retirer ${t.username}`}
              >
                ×
              </span>
            </button>
            );
          })}
        </div>
      ) : null}

      {effectiveTotal < maxTags ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher un utilisateur…"
            className="w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600"
          />
          {open && query.trim().length >= 2 ? (
            <div className="max-h-36 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#0b0b0f]">
              {loading ? (
                <p className="px-3 py-2 text-[10px] text-gray-500">Recherche…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-[10px] text-gray-500">Aucun résultat</p>
              ) : (
                results.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => addTag(hit)}
                    disabled={tagged.some((t) => t.id === hit.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a26] disabled:opacity-40"
                  >
                    <UserAvatarOnline
                      userId={hit.id}
                      username={hit.username}
                      avatarUrl={hit.avatarUrl}
                      size="sm"
                    />
                    <UsernameDisplay
                      username={hit.username}
                      usernameColor={hit.usernameColor}
                      usernameWaveFrom={hit.usernameWaveFrom}
                      usernameWaveTo={hit.usernameWaveTo}
                      className="text-xs"
                    />
                  </button>
                ))
              )}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[10px] text-gray-500">Maximum {maxTags} personnes taguées.</p>
      )}
    </div>
  );
}
