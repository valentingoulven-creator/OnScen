import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { DmContact, UserSearchHit } from '../types';

interface SalonInviteUserSearchProps {
  token: string;
  contacts: DmContact[];
  allowedUserIds: Set<string>;
  onToggle: (userId: string, add: boolean) => void;
}

type InviteRow = { id: string; username: string };

function hitToRow(hit: UserSearchHit): InviteRow {
  return { id: hit.id, username: hit.username };
}

function contactToRow(c: DmContact): InviteRow {
  return { id: c.id, username: c.username };
}

export function SalonInviteUserSearch({
  token,
  contacts,
  allowedUserIds,
  onToggle,
}: SalonInviteUserSearchProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= 2;

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, trimmed)
        .then((r) => setSearchResults(r.users))
        .catch(() => setSearchResults([]))
        .finally(() => setLoading(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [trimmed, token, isSearching]);

  const selectedRows: InviteRow[] = [...allowedUserIds]
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is DmContact => Boolean(c))
    .map(contactToRow);

  const rows: InviteRow[] = isSearching
    ? searchResults.map(hitToRow)
    : trimmed.length === 1
      ? contacts
          .filter((c) => c.username.toLowerCase().includes(trimmed.toLowerCase()))
          .map(contactToRow)
      : selectedRows;

  return (
    <div className="space-y-2">
      <div className="relative">
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"
          aria-hidden
        >
          🔍
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          autoComplete="off"
          aria-label="Rechercher un utilisateur"
          className="w-full h-8 pl-7 pr-7 text-xs rounded-lg bg-[#1a1a26] border border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500/60 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-base leading-none px-0.5"
            aria-label="Effacer la recherche"
          >
            ×
          </button>
        )}
      </div>

      {(isSearching || trimmed.length === 1 || rows.length > 0) && (
      <div className="space-y-1 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] p-2">
        <p className="text-[10px] text-gray-600 mb-1 px-1">
          {isSearching || trimmed.length === 1
            ? 'Résultats de recherche'
            : 'Personnes autorisées'}
        </p>
        {loading && <p className="text-xs text-gray-500 px-1 py-1">Recherche…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-xs text-gray-500 px-1 py-1">
            {isSearching || trimmed.length === 1
              ? 'Aucun utilisateur trouvé'
              : 'Aucun contact — recherchez un utilisateur ci-dessus'}
          </p>
        )}
        {!loading &&
          rows.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-2 text-sm text-gray-300 px-1 py-0.5 rounded hover:bg-[#151520] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={allowedUserIds.has(u.id)}
                onChange={(e) => onToggle(u.id, e.target.checked)}
                className="accent-purple-500"
              />
              {u.username}
            </label>
          ))}
      </div>
      )}
      {!isSearching && trimmed.length === 0 && rows.length === 0 && (
        <p className="text-[10px] text-gray-500 px-0.5 leading-snug">
          Recherchez un utilisateur pour l&apos;ajouter au salon.
        </p>
      )}
    </div>
  );
}
