import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { UserAvatarOnline } from '../components/UserAvatarOnline';
import type { Conversation, DirectMessage, DmContact } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

type View = 'list' | 'thread' | 'new' | 'blocked';

const DM_MATCHES_ONLY_KEY = 'melosong_dm_matches_only';

function readMatchesOnlyFilter(): boolean {
  try {
    return localStorage.getItem(DM_MATCHES_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function persistMatchesOnlyFilter(value: boolean) {
  try {
    localStorage.setItem(DM_MATCHES_ONLY_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function contactMatchesQuery(contact: DmContact, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(contact.username).includes(q);
}

function HighlightedUsername({ username, query }: { username: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <span>{username}</span>;
  const lower = username.toLowerCase();
  const needle = trimmed.toLowerCase();
  const i = lower.indexOf(needle);
  if (i < 0) return <span>{username}</span>;
  return (
    <span>
      {username.slice(0, i)}
      <span className="text-purple-300 font-bold">{username.slice(i, i + trimmed.length)}</span>
      {username.slice(i + trimmed.length)}
    </span>
  );
}

function UsernameWithMatchHeart({
  username,
  isMatch,
  query,
}: {
  username: string;
  isMatch: boolean;
  query?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <span className="truncate">
        {query != null ? <HighlightedUsername username={username} query={query} /> : username}
      </span>
      {isMatch && (
        <span className="shrink-0 text-pink-400 text-sm leading-none" title="Match musical" aria-hidden>
          ♥
        </span>
      )}
    </span>
  );
}

function UserCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="melosong-checkbox"
      aria-label="Sélectionner"
    />
  );
}

export function DmPage() {
  const { user, token } = useAuth();
  const [view, setView] = useState<View>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<DmContact[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [activeUser, setActiveUser] = useState<DmContact | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [matchedUserIds, setMatchedUserIds] = useState<Set<string>>(new Set());
  const [showMatchesOnly, setShowMatchesOnly] = useState(readMatchesOnlyFilter);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredContacts = useMemo(
    () => contacts.filter((c) => contactMatchesQuery(c, contactSearch)),
    [contacts, contactSearch]
  );

  const searchSuggestions = useMemo(() => {
    const q = contactSearch.trim();
    if (!q) return [];
    return filteredContacts.slice(0, 8);
  }, [contactSearch, filteredContacts]);

  const isOnline = useCallback((id: string) => onlineIds.has(id), [onlineIds]);
  const isMatchedUser = useCallback(
    (userId: string, explicit?: boolean) => explicit === true || matchedUserIds.has(userId),
    [matchedUserIds]
  );

  const displayedConversations = useMemo(
    () =>
      showMatchesOnly
        ? conversations.filter((c) => isMatchedUser(c.userId, c.isMatch))
        : conversations,
    [conversations, showMatchesOnly, isMatchedUser]
  );

  const toggleMatchesOnly = () => {
    setShowMatchesOnly((prev) => {
      const next = !prev;
      persistMatchesOnlyFilter(next);
      return next;
    });
  };

  const selectionCount = selectedIds.size;

  const loadMatches = () => {
    if (!token) return;
    api.getMatches(token).then((r) => setMatchedUserIds(new Set(r.matches.map((m) => m.otherUser.id))));
  };

  const loadPresence = () => {
    if (!token) return;
    api.getDmPresence(token).then((r) => setOnlineIds(new Set(r.onlineUserIds)));
  };

  const loadConversations = () => {
    if (!token) return;
    api.getConversations(token).then((r) => {
      setConversations(r.conversations);
      setOnlineIds((prev) => {
        const next = new Set(prev);
        r.conversations.forEach((c) => {
          if (c.isOnline) next.add(c.userId);
        });
        return next;
      });
    });
  };

  const loadBlocked = () => {
    if (!token) return;
    api.getBlockedUsers(token).then((r) => setBlockedUsers(r.blocked));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    const pool = view === 'new' ? filteredContacts : contacts;
    if (pool.length > 0 && pool.every((c) => selectedIds.has(c.id))) {
      clearSelection();
    } else {
      setSelectedIds(new Set(pool.map((c) => c.id)));
    }
  };

  const toggleSelectAllBlocked = () => {
    if (selectedIds.size === blockedUsers.length) {
      clearSelection();
    } else {
      setSelectedIds(new Set(blockedUsers.map((b) => b.id)));
    }
  };

  const blockUsers = async (userIds: string[], usernames: string[]) => {
    if (!token || userIds.length === 0) return;
    const label =
      userIds.length === 1
        ? usernames[0]
        : `${userIds.length} personnes`;
    const ok = window.confirm(
      `Bloquer ${label} ?\n\nCes personnes ne seront pas averties. Vous ne verrez plus leurs messages.`
    );
    if (!ok) return;
    setBlocking(true);
    try {
      for (const id of userIds) {
        await api.blockUser(token, id);
      }
      clearSelection();
      setMenuOpen(false);
      setView('list');
      setActiveUser(null);
      loadConversations();
      loadContacts();
      loadBlocked();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBlocking(false);
    }
  };

  const blockSelected = () => {
    const ids = [...selectedIds];
    const names = conversations
      .filter((c) => selectedIds.has(c.userId))
      .map((c) => c.username);
    const contactNames = contacts.filter((c) => selectedIds.has(c.id)).map((c) => c.username);
    blockUsers(ids, [...names, ...contactNames]);
  };

  const openThread = async (contact: DmContact) => {
    if (!token || selectionCount > 0) return;
    try {
      isNearBottomRef.current = true;
      prevMessageCountRef.current = 0;
      setOpenMsgMenuId(null);
      setMessages([]);
      setActiveUser({ ...contact, isOnline: isOnline(contact.id) });
      setView('thread');
      const r = await api.getDmThread(token, contact.id);
      setMessages(r.messages);
      setActiveUser({ ...r.otherUser, isOnline: isOnline(r.otherUser.id) });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Conversation indisponible');
      setView('list');
    }
  };

  const loadContacts = () => {
    if (!token) return;
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadPresence();
    loadConversations();
    loadBlocked();
    loadMatches();
    setLoading(false);
  }, [token]);

  useEffect(() => {
    clearSelection();
    if (view !== 'new') {
      setContactSearch('');
      setSearchFocused(false);
    }
  }, [view]);

  useEffect(() => {
    if (view === 'new') searchInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket();
    const onDm = (msg: DirectMessage) => {
      if (
        view === 'thread' &&
        activeUser &&
        ((msg.senderId === user.id && msg.receiverId === activeUser.id) ||
          (msg.senderId === activeUser.id && msg.receiverId === user.id))
      ) {
        setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
      }
      loadConversations();
    };
    const onPresence = (p: { userId: string; online: boolean }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    };
    const removeMessageFromUi = (messageId: string) => {
      setMessages((m) => m.filter((x) => x.id !== messageId));
      setOpenMsgMenuId((id) => (id === messageId ? null : id));
      loadConversations();
    };
    const onDmDeleted = ({ messageId }: { messageId: string }) => {
      removeMessageFromUi(messageId);
    };
    const onDmHidden = ({ messageId }: { messageId: string }) => {
      removeMessageFromUi(messageId);
    };
    socket.on('dm', onDm);
    socket.on('presence', onPresence);
    socket.on('dm_deleted', onDmDeleted);
    socket.on('dm_hidden', onDmHidden);
    return () => {
      socket.off('dm', onDm);
      socket.off('presence', onPresence);
      socket.off('dm_deleted', onDmDeleted);
      socket.off('dm_hidden', onDmHidden);
    };
  }, [token, user?.id, view, activeUser?.id]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    if (view !== 'thread') {
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
      return;
    }
    const el = messagesScrollRef.current;
    if (!el) return;
    const isInitialLoad = prevMessageCountRef.current === 0 && messages.length > 0;
    const shouldScroll = isNearBottomRef.current || isInitialLoad;
    prevMessageCountRef.current = messages.length;
    if (!shouldScroll) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: isInitialLoad ? 'auto' : 'smooth' });
    });
  }, [messages, view]);

  useEffect(() => {
    if (!openMsgMenuId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dm-msg-menu]')) return;
      setOpenMsgMenuId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMsgMenuId]);

  const deleteMessage = async (messageId: string, isMine: boolean) => {
    if (!token) return;
    const confirmText = isMine
      ? 'Supprimer ce message pour vous et votre correspondant ? Cette action est définitive.'
      : 'Masquer ce message de votre conversation ? Votre correspondant le verra toujours.';
    if (!window.confirm(confirmText)) return;
    try {
      await api.deleteDmMessage(token, messageId, isMine);
      setMessages((m) => m.filter((x) => x.id !== messageId));
      setOpenMsgMenuId(null);
      loadConversations();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de supprimer');
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token || !activeUser || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      const { message } = await api.sendDm(token, activeUser.id, text);
      getSocket().emit('dm', message);
      setMessages((m) => [...m, message]);
      loadConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur envoi');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const blockActiveUser = () => {
    if (!activeUser) return;
    blockUsers([activeUser.id], [activeUser.username]);
  };

  const unblockUsers = async (userIds: string[]) => {
    if (!token || userIds.length === 0) return;
    setUnblocking(true);
    try {
      for (const id of userIds) {
        await api.unblockUser(token, id);
      }
      clearSelection();
      loadBlocked();
      loadContacts();
      loadConversations();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de débloquer');
    } finally {
      setUnblocking(false);
    }
  };

  const unblockOne = (userId: string) => unblockUsers([userId]);

  const unblockSelected = () => unblockUsers([...selectedIds]);

  const SelectionBar = () => {
    if (selectionCount === 0) return null;
    return (
      <div className="shrink-0 flex items-center gap-2 p-3 border-t border-[#1e1e2f] bg-[#12121a] safe-area-pb">
        <button
          type="button"
          onClick={clearSelection}
          className="px-3 py-2 text-xs text-gray-400 border border-[#2d2d3d] rounded-full"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={blockSelected}
          disabled={blocking}
          className="flex-1 py-2.5 bg-red-600/90 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white"
        >
          {blocking ? '...' : `Bloquer (${selectionCount})`}
        </button>
      </div>
    );
  };

  if (view === 'blocked') {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <button type="button" onClick={() => setView('list')} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <h2 className="font-bold text-white flex-1">Utilisateurs bloqués</h2>
          {blockedUsers.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllBlocked}
              className="text-xs text-green-400 font-semibold"
            >
              {selectedIds.size === blockedUsers.length ? 'Tout désélect.' : 'Tout'}
            </button>
          )}
        </header>

        {blockedUsers.length > 0 && (
          <p className="shrink-0 px-4 py-2 text-[10px] text-gray-500 border-b border-[#1e1e2f]/50">
            Cochez puis « Débloquer » en bas, ou utilisez le bouton sur chaque ligne
          </p>
        )}

        <ul className="flex-1 min-h-0 overflow-y-auto p-2">
          {blockedUsers.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Aucun utilisateur bloqué</p>
          )}
          {blockedUsers.map((b) => {
            const selected = selectedIds.has(b.id);
            return (
              <li
                key={b.id}
                className={`mb-2 rounded-xl border ${
                  selected ? 'bg-green-900/20 border-green-500/40' : 'bg-[#12121a] border-[#1e1e2f]'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <UserCheckbox checked={selected} onChange={() => toggleSelect(b.id)} />
                  <UserAvatarOnline userId={b.id} avatarUrl={b.avatarUrl} size="md" isOnline={isOnline(b.id)} />
                  <span className="flex-1 font-semibold text-white truncate">{b.username}</span>
                </div>
                <div className="px-3 pb-3">
                  <button
                    type="button"
                    onClick={() => unblockOne(b.id)}
                    disabled={unblocking}
                    className="w-full py-2.5 rounded-xl bg-green-600/90 hover:bg-green-500 disabled:opacity-50 text-sm font-bold text-white"
                  >
                    Débloquer {b.username}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {selectionCount > 0 && (
          <div className="shrink-0 flex items-center gap-2 p-3 border-t border-[#1e1e2f] bg-[#12121a] safe-area-pb">
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-2 text-xs text-gray-400 border border-[#2d2d3d] rounded-full"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={unblockSelected}
              disabled={unblocking}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white"
            >
              {unblocking ? '...' : `Débloquer (${selectionCount})`}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'new') {
    const showSuggestions = searchFocused && contactSearch.trim().length > 0;
    const allVisibleSelected =
      filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.has(c.id));

    const toggleSelectAllVisible = () => {
      if (allVisibleSelected) clearSelection();
      else setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    };

    return (
      <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <button type="button" onClick={() => setView('list')} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <h2 className="font-bold text-white flex-1">Nouveau message</h2>
          {filteredContacts.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-xs text-purple-400 font-semibold"
            >
              {allVisibleSelected ? 'Tout désélect.' : 'Tout'}
            </button>
          )}
        </header>

        <div className="shrink-0 px-4 py-3 border-b border-[#1e1e2f]/50 relative z-20">
          <div className="flex items-center gap-2 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 focus-within:border-purple-500/60">
            <span className="text-gray-500 text-sm" aria-hidden>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Rechercher un utilisateur..."
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
            />
            {contactSearch && (
              <button
                type="button"
                onClick={() => setContactSearch('')}
                className="text-gray-500 hover:text-white text-xs px-1"
                aria-label="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>

          {showSuggestions && (
            <ul className="absolute left-4 right-4 top-full mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-2xl z-30">
              {searchSuggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500">Aucune proposition pour « {contactSearch.trim()} »</li>
              ) : (
                searchSuggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setContactSearch(c.username);
                        setSearchFocused(false);
                        if (selectionCount === 0) openThread({ ...c, isOnline: isOnline(c.id) });
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a26] text-left"
                    >
                      <UserAvatarOnline
                        userId={c.id}
                        avatarUrl={c.avatarUrl}
                        size="sm"
                        isOnline={isOnline(c.id)}
                      />
                      <span className="font-semibold text-white truncate">
                        <HighlightedUsername username={c.username} query={contactSearch} />
                      </span>
                      {isOnline(c.id) && (
                        <span className="ml-auto text-[10px] text-green-500 shrink-0">En ligne</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <p className="shrink-0 px-4 py-2 text-[10px] text-gray-500">
          {contactSearch.trim()
            ? `${filteredContacts.length} proposition${filteredContacts.length !== 1 ? 's' : ''}`
            : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} — tapez un nom pour filtrer`}
        </p>

        <ul className="flex-1 min-h-0 overflow-y-auto p-2">
          {contacts.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Aucun contact disponible</p>
          )}
          {contacts.length > 0 && filteredContacts.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              Aucun utilisateur ne correspond à « {contactSearch.trim()} »
            </p>
          )}
          {filteredContacts.map((c) => (
            <li key={c.id}>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  selectedIds.has(c.id) ? 'bg-purple-900/25 border border-purple-500/40' : 'hover:bg-[#1a1a26]'
                }`}
              >
                <UserCheckbox checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                <button
                  type="button"
                  onClick={() => selectionCount === 0 && openThread({ ...c, isOnline: isOnline(c.id) })}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <UserAvatarOnline userId={c.id} avatarUrl={c.avatarUrl} size="md" isOnline={isOnline(c.id)} />
                  <span className="font-semibold text-white truncate">
                    <HighlightedUsername username={c.username} query={contactSearch} />
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
        <SelectionBar />
      </div>
    );
  }

  if (view === 'thread' && activeUser) {
    const online = isOnline(activeUser.id);
    return (
      <div className="relative flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a] relative">
          <button
            type="button"
            onClick={() => {
              setView('list');
              setMenuOpen(false);
              loadConversations();
            }}
            className="text-gray-400 hover:text-white text-xl"
          >
            ←
          </button>
          <UserCheckbox
            checked={selectedIds.has(activeUser.id)}
            onChange={() => toggleSelect(activeUser.id)}
          />
          <UserAvatarOnline
            userId={activeUser.id}
            avatarUrl={activeUser.avatarUrl}
            size="sm"
            isOnline={online}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">
              <UsernameWithMatchHeart
                username={activeUser.username}
                isMatch={isMatchedUser(activeUser.id, activeUser.isMatch)}
              />
            </p>
            <p className={`text-xs ${online ? 'text-green-500' : 'text-gray-500'}`}>
              {online ? 'En ligne' : 'Hors ligne'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="px-2 py-1 text-gray-400 hover:text-white text-lg"
            aria-label="Options"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-3 top-full mt-1 z-30 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl shadow-xl overflow-hidden min-w-[10rem]">
              <button
                type="button"
                onClick={blockActiveUser}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
              >
                Bloquer (silencieux)
              </button>
            </div>
          )}
        </header>

        {selectedIds.has(activeUser.id) && (
          <div className="shrink-0 px-3 py-2 bg-red-950/30 border-b border-red-500/20 flex items-center justify-between gap-2">
            <p className="text-xs text-red-300">Utilisateur sélectionné</p>
            <button
              type="button"
              onClick={blockActiveUser}
              disabled={blocking}
              className="px-3 py-1.5 bg-red-600 rounded-full text-xs font-bold text-white disabled:opacity-50"
            >
              Bloquer
            </button>
          </div>
        )}

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
            className="dm-messages-scroll flex-1 min-h-0 p-3"
          >
            <div className="min-h-full flex flex-col justify-end space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">Aucun message. Envoyez le premier !</p>
          )}
          {messages.map((m) => {
            const isMe = m.senderId === user?.id;
            const menuOpen = openMsgMenuId === m.id;
            return (
              <div
                key={m.id}
                data-dm-msg-menu
                className={`flex items-end gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`relative max-w-[80%] ${isMe ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 ${
                      isMe
                        ? 'bg-purple-600/80 text-white rounded-br-sm'
                        : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-500'}`}>
                      {formatTime(m.timestamp)}
                    </p>
                  </div>
                  {menuOpen && (
                    <div
                      className={`absolute z-20 mt-1 min-w-[10rem] rounded-xl border border-[#2d2d3d] bg-[#1a1a26] shadow-xl overflow-hidden ${
                        isMe ? 'right-0' : 'left-0'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => deleteMessage(m.id, isMe)}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10"
                      >
                        {isMe ? 'Supprimer pour tous' : 'Masquer pour moi'}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenMsgMenuId((id) => (id === m.id ? null : m.id))}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-[#1a1a26] text-sm"
                  aria-label="Options du message"
                >
                  ⋮
                </button>
              </div>
            );
          })}
            </div>
          </div>

          <form
            onSubmit={sendMessage}
            className="shrink-0 flex gap-2 px-3 py-2 border-t border-[#1e1e2f] bg-[#12121a] pb-0"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message privé..."
              className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-4 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="shrink-0 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-full font-bold text-white text-sm"
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f]">
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#1e1e2f]">
        <h2 className="text-lg font-bold text-white">Messages</h2>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={toggleMatchesOnly}
            className={`px-3 py-2 text-xs rounded-full border font-semibold ${
              showMatchesOnly
                ? 'bg-pink-600/20 border-pink-500/50 text-pink-300'
                : 'border-[#2d2d3d] text-gray-400 hover:text-white'
            }`}
            aria-pressed={showMatchesOnly}
          >
            ♥ Matchs
          </button>
          <button
            type="button"
            onClick={() => {
              loadBlocked();
              setView('blocked');
            }}
            className="px-3 py-2 text-xs text-gray-400 border border-[#2d2d3d] rounded-full hover:text-white"
            title="Utilisateurs bloqués"
          >
            Bloqués
          </button>
          <button
            type="button"
            onClick={() => {
              loadContacts();
              setView('new');
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-sm font-bold text-white"
          >
            + Nouveau
          </button>
        </div>
      </div>

      {loading && <p className="p-6 text-center text-gray-500 text-sm">Chargement...</p>}

      {!loading && conversations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-400 text-sm mb-4">Aucune conversation pour le moment</p>
          <button
            type="button"
            onClick={() => {
              loadContacts();
              setView('new');
            }}
            className="px-5 py-2.5 bg-purple-600 rounded-full font-bold text-white text-sm"
          >
            Envoyer un message privé
          </button>
        </div>
      )}

      {!loading && conversations.length > 0 && showMatchesOnly && displayedConversations.length === 0 && (
        <p className="shrink-0 px-4 py-3 text-center text-sm text-gray-500 border-b border-[#1e1e2f]/50">
          Aucune conversation avec un match pour le moment
        </p>
      )}

      <ul className="flex-1 min-h-0 overflow-y-auto">
        {displayedConversations.map((c) => {
          const selected = selectedIds.has(c.userId);
          return (
            <li key={c.userId}>
              <div
                className={`flex items-center gap-3 p-4 border-b border-[#1e1e2f]/50 ${
                  selected ? 'bg-purple-900/25' : 'hover:bg-[#12121a]'
                }`}
              >
                <UserCheckbox checked={selected} onChange={() => toggleSelect(c.userId)} />
                <button
                  type="button"
                  onClick={() =>
                    selectionCount === 0 &&
                    openThread({
                      id: c.userId,
                      username: c.username,
                      avatarUrl: c.avatarUrl,
                      isOnline: c.isOnline ?? isOnline(c.userId),
                      isMatch: c.isMatch,
                    })
                  }
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <UserAvatarOnline
                    userId={c.userId}
                    avatarUrl={c.avatarUrl}
                    size="lg"
                    isOnline={c.isOnline ?? isOnline(c.userId)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <p className="font-semibold text-white truncate">
                        <UsernameWithMatchHeart
                          username={c.username}
                          isMatch={isMatchedUser(c.userId, c.isMatch)}
                        />
                      </p>
                      <span className="text-[10px] text-gray-500 shrink-0">{formatTime(c.lastTimestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-0.5">
                      {c.isFromMe ? 'Vous : ' : ''}
                      {c.lastMessage}
                    </p>
                  </div>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <SelectionBar />
    </div>
  );
}
