import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { UserSearchHit } from '../types';

interface StoryMentionAutocompleteProps {
  token: string;
  query: string;
  excludeIds?: string[];
  maxTags?: number;
  currentTagCount?: number;
  onSelect: (hit: UserSearchHit) => void;
  className?: string;
}

export function StoryMentionAutocomplete({
  token,
  query,
  excludeIds = [],
  maxTags = 5,
  currentTagCount = 0,
  onSelect,
  className = '',
}: StoryMentionAutocompleteProps) {
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmed = query.trim();
  const atMax = currentTagCount >= maxTags;

  useEffect(() => {
    if (trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, trimmed)
        .then((r) => setResults(r.users))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [trimmed, token]);

  if (atMax) {
    return (
      <div
        className={`rounded-xl border border-[#2d2d3d] bg-[#12121a]/98 px-3 py-2 text-[10px] text-gray-500 ${className}`}
      >
        Maximum {maxTags} personnes taguées sur cette story.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-xl shadow-2xl overflow-hidden ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-2 text-[10px] font-semibold text-gray-400 border-b border-[#2d2d3d]">
        Taguer une personne
      </p>
      <div className="max-h-40 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-2.5 text-[10px] text-gray-500">Recherche…</p>
        ) : trimmed.length < 1 ? (
          <p className="px-3 py-2.5 text-[10px] text-gray-500">
            Saisissez un pseudo après @
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-2.5 text-[10px] text-gray-500">Aucun résultat</p>
        ) : (
          results.map((hit) => {
            const excluded = excludeIds.includes(hit.id);
            return (
              <button
                key={hit.id}
                type="button"
                onClick={() => onSelect(hit)}
                disabled={excluded}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#1a1a26] disabled:opacity-40"
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
            );
          })
        )}
      </div>
    </div>
  );
}
