import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { Conversation, DmContact, UserSearchHit } from '../types';

export interface ShareToUserSheetProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  token: string;
  shareUrl: string;
  shareText?: string;
  onToast: (message: string) => void;
  onSent?: () => void;
}

type PickableUser = {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
};

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function contactMatchesQuery(user: PickableUser, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(user.username).includes(q);
}

function toPickableFromContact(c: DmContact): PickableUser {
  return {
    id: c.id,
    username: c.username,
    avatarUrl: c.avatarUrl,
    usernameColor: c.usernameColor,
    usernameWaveFrom: c.usernameWaveFrom,
    usernameWaveTo: c.usernameWaveTo,
  };
}

function toPickableFromConversation(c: Conversation): PickableUser | null {
  if (!c.userId || c.kind === 'group') return null;
  return {
    id: c.userId,
    username: c.username,
    avatarUrl: c.avatarUrl,
    usernameColor: c.usernameColor,
    usernameWaveFrom: c.usernameWaveFrom,
    usernameWaveTo: c.usernameWaveTo,
  };
}

function toPickableFromSearch(hit: UserSearchHit): PickableUser {
  return {
    id: hit.id,
    username: hit.username,
    avatarUrl: hit.avatarUrl,
    usernameColor: hit.usernameColor,
    usernameWaveFrom: hit.usernameWaveFrom,
    usernameWaveTo: hit.usernameWaveTo,
  };
}

function UserRow({
  user,
  onSelect,
  sending,
  disabled,
}: {
  user: PickableUser;
  onSelect: () => void;
  sending: boolean;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={sending || disabled}
        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-white hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-50"
      >
        <UserAvatarOnline userId={user.id} username={user.username} avatarUrl={user.avatarUrl} size="md" />
        <UsernameDisplay
          username={user.username}
          usernameColor={user.usernameColor}
          usernameWaveFrom={user.usernameWaveFrom}
          usernameWaveTo={user.usernameWaveTo}
          className="truncate"
        />
      </button>
    </li>
  );
}

export function ShareToUserSheet({
  open,
  onClose,
  onBack,
  token,
  shareUrl,
  shareText,
  onToast,
  onSent,
}: ShareToUserSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSearchResults([]);
      return;
    }
    setLoading(true);
    Promise.all([api.getDmContacts(token), api.getConversations(token)])
      .then(([contactsRes, convoRes]) => {
        setContacts(contactsRes.contacts);
        setConversations(convoRes.conversations);
      })
      .catch(() => {
        setContacts([]);
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, q)
        .then((r) => setSearchResults(r.users.slice(0, 12)))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, token]);

  const recentUsers = useMemo(() => {
    const seen = new Set<string>();
    const list: PickableUser[] = [];
    const sorted = [...conversations]
      .filter((c) => c.kind !== 'group' && c.userId)
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    for (const c of sorted) {
      const user = toPickableFromConversation(c);
      if (!user || seen.has(user.id)) continue;
      if (!contactMatchesQuery(user, query)) continue;
      seen.add(user.id);
      list.push(user);
      if (list.length >= 8) break;
    }
    return list;
  }, [conversations, query]);

  const contactUsers = useMemo(() => {
    const recentIds = new Set(recentUsers.map((u) => u.id));
    return contacts
      .map(toPickableFromContact)
      .filter((u) => !recentIds.has(u.id))
      .filter((u) => contactMatchesQuery(u, query));
  }, [contacts, recentUsers, query]);

  const searchUsers = useMemo(() => {
    if (query.trim().length < 2) return [];
    const existing = new Set([...recentUsers, ...contactUsers].map((u) => u.id));
    return searchResults
      .map(toPickableFromSearch)
      .filter((u) => !existing.has(u.id));
  }, [query, searchResults, recentUsers, contactUsers]);

  const sendToUser = useCallback(
    async (user: PickableUser) => {
      if (sendingToId) return;
      const content = shareText?.trim() ? `${shareText.trim()}\n${shareUrl}` : shareUrl;
      setSendingToId(user.id);
      try {
        await api.sendDm(token, user.id, content);
        onToast(t('share.sentToUser', { username: user.username }));
        void onSent?.();
        onClose();
      } catch (e) {
        onToast(e instanceof Error ? e.message : t('share.sendToUserFailed'));
      } finally {
        setSendingToId(null);
      }
    },
    [sendingToId, shareText, shareUrl, token, onToast, t, onSent, onClose]
  );

  if (!open) return null;

  const isSearchMode = query.trim().length >= 2;
  const hasAny =
    recentUsers.length > 0 || contactUsers.length > 0 || searchUsers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-to-user-title"
    >
      <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2f] shrink-0">
          <button
            type="button"
            onClick={onBack ?? onClose}
            className="text-gray-400 hover:text-white px-1 text-sm"
            aria-label={t('common.back')}
          >
            ←
          </button>
          <h2 id="share-to-user-title" className="font-bold text-white text-sm flex-1">
            {t('share.sendToUserTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white px-2"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 shrink-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('share.sendToUserSearch')}
            className="w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600"
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-8">{t('common.loading')}</p>
          ) : searching && isSearchMode ? (
            <p className="text-center text-gray-500 text-sm py-8">{t('share.sendToUserSearching')}</p>
          ) : !hasAny ? (
            <p className="text-center text-gray-500 text-sm py-8 px-4">
              {isSearchMode ? t('share.sendToUserNoResults') : t('share.sendToUserEmpty')}
            </p>
          ) : (
            <>
              {recentUsers.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {t('share.sendToUserRecent')}
                  </p>
                  <ul>
                    {recentUsers.map((user) => (
                      <UserRow
                        key={`recent-${user.id}`}
                        user={user}
                        onSelect={() => void sendToUser(user)}
                        sending={sendingToId === user.id}
                        disabled={Boolean(sendingToId && sendingToId !== user.id)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {contactUsers.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {t('share.sendToUserContacts')}
                  </p>
                  <ul>
                    {contactUsers.map((user) => (
                      <UserRow
                        key={`contact-${user.id}`}
                        user={user}
                        onSelect={() => void sendToUser(user)}
                        sending={sendingToId === user.id}
                        disabled={Boolean(sendingToId && sendingToId !== user.id)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {searchUsers.length > 0 ? (
                <div>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {t('share.sendToUserSearchResults')}
                  </p>
                  <ul>
                    {searchUsers.map((user) => (
                      <UserRow
                        key={`search-${user.id}`}
                        user={user}
                        onSelect={() => void sendToUser(user)}
                        sending={sendingToId === user.id}
                        disabled={Boolean(sendingToId && sendingToId !== user.id)}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
