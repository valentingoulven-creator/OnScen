import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDmUnread } from '../context/DmUnreadContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useMatchCreated } from '../lib/useMatchCreated';
import { UserAvatarOnline } from '../components/UserAvatarOnline';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { LinkifiedText } from '../components/LinkifiedText';
import type { Conversation, DirectMessage, DmContact, DmRequest, GroupMessage, MessageGroupDetail } from '../types';

function isGroupConversation(c: Conversation): boolean {
  return c.kind === 'group' && Boolean(c.groupId);
}

function GroupAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-purple-200 shrink-0`}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

type View = 'list' | 'thread' | 'groupThread' | 'new' | 'createGroup' | 'blocked';

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
  usernameColor,
  usernameWaveFrom,
  usernameWaveTo,
  isMatch,
  query,
}: {
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  isMatch: boolean;
  query?: string;
}) {
  const hasQuery = query != null && query.trim().length > 0;
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <span className="truncate">
        {hasQuery ? (
          <HighlightedUsername username={username} query={query} />
        ) : (
          <UsernameDisplay
            username={username}
            usernameColor={usernameColor}
            usernameWaveFrom={usernameWaveFrom}
            usernameWaveTo={usernameWaveTo}
            className="truncate inline"
          />
        )}
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

export function DmPage({
  openPeerId = null,
  openGroupId = null,
  onOpenPeerConsumed,
  onOpenGroupConsumed,
  onOpenProfile,
  onOpenSalon,
  onOpenFeedPost,
}: {
  openPeerId?: string | null;
  openGroupId?: string | null;
  onOpenPeerConsumed?: () => void;
  onOpenGroupConsumed?: () => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenFeedPost?: (postId: string) => void;
} = {}) {
  const { user, token } = useAuth();
  const { refreshUnread, refreshMuted, setActivePeer, setActiveGroup } = useDmUnread();
  const [view, setView] = useState<View>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<DmContact[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [liveViewersByUserId, setLiveViewersByUserId] = useState<Record<string, number>>({});
  const [activeUser, setActiveUser] = useState<DmContact | null>(null);
  const [activeGroup, setActiveGroupState] = useState<MessageGroupDetail | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [muting, setMuting] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [matchedUserIds, setMatchedUserIds] = useState<Set<string>>(new Set());
  const [showMatchesOnly, setShowMatchesOnly] = useState(readMatchesOnlyFilter);
  const [pendingRequests, setPendingRequests] = useState<DmRequest[]>([]);
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);
  const [refusingRequest, setRefusingRequest] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'pending_sent' | null>(null);
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
  const isLive = useCallback((id: string) => liveIds.has(id), [liveIds]);
  const liveViewersFor = useCallback(
    (id: string) => (liveIds.has(id) ? liveViewersByUserId[id] : undefined),
    [liveIds, liveViewersByUserId]
  );
  const isMatchedUser = useCallback(
    (userId: string, explicit?: boolean) => explicit === true || matchedUserIds.has(userId),
    [matchedUserIds]
  );

  const displayedConversations = useMemo(
    () =>
      showMatchesOnly
        ? conversations.filter(
            (c) => isGroupConversation(c) || isMatchedUser(c.userId ?? '', c.isMatch)
          )
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

  const loadMatches = useCallback(() => {
    if (!token) return;
    api.getMatches(token).then((r) => setMatchedUserIds(new Set(r.matches.map((m) => m.otherUser.id))));
  }, [token]);

  const loadPresence = () => {
    if (!token) return;
    api.getDmPresence(token).then((r) => {
      setOnlineIds(new Set(r.onlineUserIds));
      setLiveIds(new Set(r.liveUserIds ?? []));
      setLiveViewersByUserId(r.liveViewersByUserId ?? {});
    });
  };

  const loadConversations = () => {
    if (!token) return;
    api.getConversations(token).then((r) => {
      setConversations(r.conversations);
      refreshUnread();
      setOnlineIds((prev) => {
        const next = new Set(prev);
        r.conversations.forEach((c) => {
          if (!isGroupConversation(c) && c.isOnline && c.userId) next.add(c.userId);
        });
        return next;
      });
    });
  };

  useMatchCreated(() => {
    loadMatches();
    loadConversations();
  }, Boolean(token));

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
      .filter((c) => c.userId && selectedIds.has(c.userId))
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
      setGroupMessages([]);
      setActiveGroupState(null);
      setActiveUser({ ...contact, isOnline: isOnline(contact.id) });
      setActivePeer(contact.id);
      setActiveGroup(null);
      setView('thread');
      const r = await api.getDmThread(token, contact.id);
      setMessages(r.messages);
      setActiveUser({ ...r.otherUser, isOnline: isOnline(r.otherUser.id) });
      refreshUnread();
      refreshMuted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Conversation indisponible');
      setView('list');
    }
  };

  const openGroupThread = async (groupId: string) => {
    if (!token || selectionCount > 0) return;
    try {
      isNearBottomRef.current = true;
      prevMessageCountRef.current = 0;
      setOpenMsgMenuId(null);
      setMessages([]);
      setGroupMessages([]);
      setActiveUser(null);
      setActivePeer(null);
      setActiveGroup(groupId);
      setView('groupThread');
      const r = await api.getGroupThread(token, groupId);
      setGroupMessages(r.messages);
      setActiveGroupState(r.group);
      refreshUnread();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Groupe indisponible');
      setView('list');
    }
  };

  const createGroup = async () => {
    if (!token || creatingGroup) return;
    const name = groupNameDraft.trim();
    const memberIds = [...selectedIds];
    if (!name) {
      alert('Donnez un nom au groupe');
      return;
    }
    if (memberIds.length === 0) {
      alert('Sélectionnez au moins un membre');
      return;
    }
    setCreatingGroup(true);
    try {
      const { group } = await api.createMessageGroup(token, name, memberIds);
      clearSelection();
      setGroupNameDraft('');
      setContactSearch('');
      loadConversations();
      await openGroupThread(group.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de créer le groupe');
    } finally {
      setCreatingGroup(false);
    }
  };

  const loadContacts = () => {
    if (!token) return;
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  };

  const loadPendingRequests = () => {
    if (!token) return;
    api.getDmRequests(token).then((r) => setPendingRequests(r.requests)).catch(() => {});
  };

  const acceptRequest = async (senderId: string) => {
    if (!token || acceptingRequest) return;
    setAcceptingRequest(senderId);
    try {
      await api.acceptDmRequest(token, senderId);
      setPendingRequests((prev) => prev.filter((r) => r.senderId !== senderId));
      setConversations((prev) =>
        prev.map((c) =>
          c.userId === senderId ? { ...c, isPendingRequest: false } : c
        )
      );
      loadConversations();
      refreshUnread();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAcceptingRequest(null);
    }
  };

  const refuseRequest = async (senderId: string) => {
    if (!token || refusingRequest) return;
    setRefusingRequest(senderId);
    try {
      await api.refuseDmRequest(token, senderId);
      setPendingRequests((prev) => prev.filter((r) => r.senderId !== senderId));
      setConversations((prev) => prev.filter((c) => c.userId !== senderId));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setRefusingRequest(null);
    }
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadPresence();
    loadConversations();
    loadBlocked();
    loadMatches();
    loadPendingRequests();
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!openPeerId || !token || loading) return;
    const convo = conversations.find((c) => c.userId === openPeerId);
    const contact = contacts.find((c) => c.id === openPeerId);
    const peer: DmContact = convo?.userId
      ? {
          id: convo.userId,
          username: convo.username,
          usernameColor: convo.usernameColor,
          usernameWaveFrom: convo.usernameWaveFrom,
          usernameWaveTo: convo.usernameWaveTo,
          avatarUrl: convo.avatarUrl,
          isOnline: isOnline(convo.userId),
        }
      : contact ?? {
          id: openPeerId,
          username: 'Utilisateur',
          isOnline: isOnline(openPeerId),
        };
    void openThread(peer);
    onOpenPeerConsumed?.();
  }, [openPeerId, token, loading]);

  useEffect(() => {
    if (!openGroupId || !token || loading) return;
    void openGroupThread(openGroupId);
    onOpenGroupConsumed?.();
  }, [openGroupId, token, loading]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => loadPresence(), 30_000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    clearSelection();
    if (view !== 'new' && view !== 'createGroup') {
      setContactSearch('');
      setSearchFocused(false);
    }
    if (view !== 'createGroup') setGroupNameDraft('');
  }, [view]);

  useEffect(() => {
    if (view === 'new' || view === 'createGroup') searchInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== 'thread') setActivePeer(null);
    if (view !== 'groupThread') setActiveGroup(null);
  }, [view, setActivePeer, setActiveGroup]);

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
        if (msg.senderId === activeUser.id && msg.receiverId === user.id) {
          void api.markDmThreadRead(token, activeUser.id, msg.timestamp).then(() => refreshUnread());
        }
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
    const onGroupMessage = (msg: GroupMessage) => {
      if (view === 'groupThread' && activeGroup && msg.groupId === activeGroup.id) {
        setGroupMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
        if (msg.senderId !== user.id) {
          void api.markGroupThreadRead(token, activeGroup.id, msg.timestamp).then(() => refreshUnread());
        }
      }
      loadConversations();
    };
    const removeGroupMessageFromUi = (messageId: string) => {
      setGroupMessages((m) => m.filter((x) => x.id !== messageId));
      setOpenMsgMenuId((id) => (id === messageId ? null : id));
      loadConversations();
    };
    const onGroupMessageDeleted = ({ messageId }: { messageId: string }) => {
      removeGroupMessageFromUi(messageId);
    };
    const onGroupMessageHidden = ({ messageId }: { messageId: string }) => {
      removeGroupMessageFromUi(messageId);
    };
    const onDmRequest = (req: DmRequest) => {
      setPendingRequests((prev) =>
        prev.some((r) => r.senderId === req.senderId) ? prev : [req, ...prev]
      );
      loadConversations();
    };
    const onDmRequestAccepted = ({ receiverId: _rid }: { receiverId: string }) => {
      setPendingStatus(null);
      loadConversations();
    };
    const onDmRequestRefused = ({ receiverId: _rid }: { receiverId: string }) => {
      setPendingStatus(null);
      loadConversations();
    };
    socket.on('dm', onDm);
    socket.on('group_message', onGroupMessage);
    socket.on('presence', onPresence);
    socket.on('dm_deleted', onDmDeleted);
    socket.on('dm_hidden', onDmHidden);
    socket.on('group_message_deleted', onGroupMessageDeleted);
    socket.on('group_message_hidden', onGroupMessageHidden);
    socket.on('dm_request', onDmRequest);
    socket.on('dm_request_accepted', onDmRequestAccepted);
    socket.on('dm_request_refused', onDmRequestRefused);
    return () => {
      socket.off('dm', onDm);
      socket.off('group_message', onGroupMessage);
      socket.off('presence', onPresence);
      socket.off('dm_deleted', onDmDeleted);
      socket.off('dm_hidden', onDmHidden);
      socket.off('group_message_deleted', onGroupMessageDeleted);
      socket.off('group_message_hidden', onGroupMessageHidden);
      socket.off('dm_request', onDmRequest);
      socket.off('dm_request_accepted', onDmRequestAccepted);
      socket.off('dm_request_refused', onDmRequestRefused);
    };
  }, [token, user?.id, view, activeUser?.id, activeGroup?.id]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const activeMessageCount = view === 'groupThread' ? groupMessages.length : messages.length;

  useEffect(() => {
    if (view !== 'thread' && view !== 'groupThread') {
      prevMessageCountRef.current = 0;
      isNearBottomRef.current = true;
      return;
    }
    const el = messagesScrollRef.current;
    if (!el) return;
    const isInitialLoad = prevMessageCountRef.current === 0 && activeMessageCount > 0;
    const shouldScroll = isNearBottomRef.current || isInitialLoad;
    prevMessageCountRef.current = activeMessageCount;
    if (!shouldScroll) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: isInitialLoad ? 'auto' : 'smooth' });
    });
  }, [activeMessageCount, view]);

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

  useEffect(() => {
    if (!conversationMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-conv-menu]')) return;
      setConversationMenuOpen(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [conversationMenuOpen]);

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

  const deleteGroupMessage = async (messageId: string, isMine: boolean) => {
    if (!token) return;
    const confirmText = isMine
      ? 'Supprimer ce message pour tous les membres ? Cette action est définitive.'
      : 'Masquer ce message de votre conversation ? Les autres membres le verront toujours.';
    if (!window.confirm(confirmText)) return;
    try {
      await api.deleteGroupMessage(token, messageId, isMine);
      setGroupMessages((m) => m.filter((x) => x.id !== messageId));
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
      const { message, status } = await api.sendDm(token, activeUser.id, text);
      if (status === 'pending') {
        setPendingStatus('pending_sent');
        setMessages((m) => [...m, message]);
      } else {
        setPendingStatus(null);
        setMessages((m) => [...m, message]);
      }
      loadConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur envoi');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const sendGroupMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token || !activeGroup || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      const { message } = await api.sendGroupMessage(token, activeGroup.id, text);
      setGroupMessages((m) => [...m, message]);
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

  const setActiveUserMuted = (muted: boolean) => {
    if (!activeUser) return;
    setActiveUser({ ...activeUser, isMutedByMe: muted });
    setConversations((prev) =>
      prev.map((c) => (c.userId === activeUser.id ? { ...c, isMuted: muted } : c))
    );
  };

  const muteActiveUser = async () => {
    if (!token || !activeUser || activeUser.isMutedByMe) return;
    setMuting(true);
    try {
      await api.muteUser(token, activeUser.id);
      setActiveUserMuted(true);
      setMenuOpen(false);
      refreshMuted();
      refreshUnread();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setMuting(false);
    }
  };

  const unmuteActiveUser = async () => {
    if (!token || !activeUser || !activeUser.isMutedByMe) return;
    setMuting(true);
    try {
      await api.unmuteUser(token, activeUser.id);
      setActiveUserMuted(false);
      setMenuOpen(false);
      refreshMuted();
      refreshUnread();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setMuting(false);
    }
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
                  <UserAvatarOnline
                    userId={b.id}
                    avatarUrl={b.avatarUrl}
                    size="md"
                    isOnline={isOnline(b.id)}
                    isLive={isLive(b.id)}
                    liveViewersCount={liveViewersFor(b.id)}
                  />
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
                        isLive={isLive(c.id)}
                        liveViewersCount={liveViewersFor(c.id)}
                      />
                      <span className="font-semibold text-white truncate">
                        <HighlightedUsername username={c.username} query={contactSearch} />
                      </span>
                      {isLive(c.id) ? (
                        <span className="ml-auto text-[10px] text-red-400 shrink-0 font-bold">En live</span>
                      ) : isOnline(c.id) ? (
                        <span className="ml-auto text-[10px] text-green-500 shrink-0">En ligne</span>
                      ) : null}
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
                  <UserAvatarOnline
                    userId={c.id}
                    avatarUrl={c.avatarUrl}
                    size="md"
                    isOnline={isOnline(c.id)}
                    isLive={isLive(c.id)}
                    liveViewersCount={liveViewersFor(c.id)}
                  />
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

  if (view === 'createGroup') {
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
          <h2 className="font-bold text-white flex-1">Nouveau groupe</h2>
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

        <div className="shrink-0 px-4 py-3 border-b border-[#1e1e2f]/50">
          <label className="block text-xs text-gray-400 mb-1.5">Nom du groupe</label>
          <input
            type="text"
            value={groupNameDraft}
            onChange={(e) => setGroupNameDraft(e.target.value)}
            placeholder="Ex. Les mélomanes..."
            maxLength={60}
            className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-500/60"
          />
        </div>

        <div className="shrink-0 px-4 py-3 border-b border-[#1e1e2f]/50">
          <div className="flex items-center gap-2 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 focus-within:border-purple-500/60">
            <span className="text-gray-500 text-sm" aria-hidden>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Rechercher des membres..."
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
            />
          </div>
        </div>

        <p className="shrink-0 px-4 py-2 text-[10px] text-gray-500">
          {selectionCount > 0
            ? `${selectionCount} membre${selectionCount !== 1 ? 's' : ''} sélectionné${selectionCount !== 1 ? 's' : ''}`
            : 'Sélectionnez au moins un membre'}
        </p>

        <ul className="flex-1 min-h-0 overflow-y-auto p-2">
          {filteredContacts.map((c) => (
            <li key={c.id}>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  selectedIds.has(c.id) ? 'bg-purple-900/25 border border-purple-500/40' : 'hover:bg-[#1a1a26]'
                }`}
              >
                <UserCheckbox checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                <UserAvatarOnline
                  userId={c.id}
                  avatarUrl={c.avatarUrl}
                  size="md"
                  isOnline={isOnline(c.id)}
                  isLive={isLive(c.id)}
                  liveViewersCount={liveViewersFor(c.id)}
                />
                <span className="font-semibold text-white truncate flex-1">
                  <HighlightedUsername username={c.username} query={contactSearch} />
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="shrink-0 p-3 border-t border-[#1e1e2f] bg-[#12121a] safe-area-pb">
          <button
            type="button"
            onClick={() => void createGroup()}
            disabled={creatingGroup || !groupNameDraft.trim() || selectionCount === 0}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-sm font-bold text-white"
          >
            {creatingGroup ? 'Création...' : 'Créer le groupe'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'thread' && activeUser) {
    const online = isOnline(activeUser.id);
    const live = isLive(activeUser.id);
    const isPendingReceived = conversations.find((c) => c.userId === activeUser.id)?.isPendingRequest ?? false;
    const isPendingMySent = pendingStatus === 'pending_sent' ||
      (conversations.find((c) => c.userId === activeUser.id)?.isPendingSent ?? false);
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
            isLive={live}
            liveViewersCount={liveViewersFor(activeUser.id)}
          />
          <div className="flex-1 min-w-0">
            {onOpenProfile ? (
              <button
                type="button"
                onClick={() => onOpenProfile(activeUser.id)}
                className="font-bold text-white truncate text-left max-w-full hover:text-purple-300 transition-colors"
                title="Voir le profil"
              >
                <UsernameWithMatchHeart
                  username={activeUser.username}
                  usernameColor={activeUser.usernameColor}
                  usernameWaveFrom={activeUser.usernameWaveFrom}
                  usernameWaveTo={activeUser.usernameWaveTo}
                  isMatch={isMatchedUser(activeUser.id, activeUser.isMatch)}
                />
              </button>
            ) : (
              <p className="font-bold text-white truncate">
                <UsernameWithMatchHeart
                  username={activeUser.username}
                  usernameColor={activeUser.usernameColor}
                  usernameWaveFrom={activeUser.usernameWaveFrom}
                  usernameWaveTo={activeUser.usernameWaveTo}
                  isMatch={isMatchedUser(activeUser.id, activeUser.isMatch)}
                />
              </p>
            )}
            <p
              className={`text-xs ${
                live ? 'text-red-400 font-semibold' : online ? 'text-green-500' : 'text-gray-500'
              }`}
            >
              {activeUser.isMutedByMe
                ? 'Notifications désactivées'
                : live
                  ? 'En live'
                  : online
                    ? 'En ligne'
                    : 'Hors ligne'}
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
            <div className="absolute right-3 top-full mt-1 z-30 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl shadow-xl overflow-hidden min-w-[12rem]">
              {activeUser.isMutedByMe ? (
                <button
                  type="button"
                  onClick={() => void unmuteActiveUser()}
                  disabled={muting}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] disabled:opacity-50"
                >
                  {muting ? '...' : 'Réactiver les notifications'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void muteActiveUser()}
                  disabled={muting}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] disabled:opacity-50"
                >
                  {muting ? '...' : 'Mettre en sourdine'}
                </button>
              )}
              <button
                type="button"
                onClick={blockActiveUser}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d]"
              >
                Bloquer
              </button>
            </div>
          )}
        </header>

        {isPendingReceived && (
          <div className="shrink-0 px-4 py-3 bg-[#1a1a2f] border-b border-purple-500/20">
            <p className="text-xs text-purple-200 mb-2 font-medium">
              {activeUser.username} souhaite vous envoyer un message
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void acceptRequest(activeUser.id)}
                disabled={acceptingRequest === activeUser.id}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-full text-xs font-bold text-white"
              >
                {acceptingRequest === activeUser.id ? '...' : 'Accepter'}
              </button>
              <button
                type="button"
                onClick={() => void refuseRequest(activeUser.id)}
                disabled={refusingRequest === activeUser.id}
                className="flex-1 py-2 bg-[#2d1a1a] border border-red-500/30 hover:bg-red-900/30 disabled:opacity-50 rounded-full text-xs font-bold text-red-400"
              >
                {refusingRequest === activeUser.id ? '...' : 'Refuser'}
              </button>
            </div>
          </div>
        )}

        {isPendingMySent && !isPendingReceived && (
          <div className="shrink-0 px-4 py-2.5 bg-[#131320] border-b border-white/5">
            <p className="text-xs text-[#8b8baf] text-center">
              Demande envoyée — en attente d'acceptation
            </p>
          </div>
        )}

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
                    <LinkifiedText
                      text={m.content}
                      className="text-sm whitespace-pre-wrap break-words"
                      onOpenProfile={onOpenProfile}
                      onOpenSalon={onOpenSalon}
                      onOpenFeedPost={onOpenFeedPost}
                    />
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

  if (view === 'groupThread' && activeGroup) {
    const memberLabel = activeGroup.members.map((m) => m.username).join(', ');
    const senderNames = new Map(activeGroup.members.map((m) => [m.id, m.username]));

    return (
      <div className="relative flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a]">
          <button
            type="button"
            onClick={() => {
              setView('list');
              setActiveGroupState(null);
              loadConversations();
            }}
            className="text-gray-400 hover:text-white text-xl"
          >
            ←
          </button>
          <GroupAvatar name={activeGroup.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{activeGroup.name}</p>
            <p className="text-xs text-gray-400 truncate" title={memberLabel}>
              {activeGroup.memberCount} membres · {memberLabel}
            </p>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
            className="dm-messages-scroll flex-1 min-h-0 p-3"
          >
            <div className="min-h-full flex flex-col justify-end space-y-3">
              {groupMessages.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  Aucun message. Lancez la conversation !
                </p>
              )}
              {groupMessages.map((m) => {
                const isMe = m.senderId === user?.id;
                const menuOpen = openMsgMenuId === m.id;
                const senderLabel = m.senderName ?? senderNames.get(m.senderId) ?? 'Membre';
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
                        {!isMe && (
                          <p className="text-[10px] font-semibold text-purple-300 mb-0.5">{senderLabel}</p>
                        )}
                        <LinkifiedText
                          text={m.content}
                          className="text-sm whitespace-pre-wrap break-words"
                          onOpenProfile={onOpenProfile}
                          onOpenSalon={onOpenSalon}
                          onOpenFeedPost={onOpenFeedPost}
                        />
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
                            onClick={() => deleteGroupMessage(m.id, isMe)}
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
            onSubmit={sendGroupMessage}
            className="shrink-0 flex gap-2 px-3 py-2 border-t border-[#1e1e2f] bg-[#12121a] pb-0"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire au groupe..."
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
              clearSelection();
              setView('createGroup');
            }}
            className="px-3 py-2 text-xs text-purple-300 border border-purple-500/40 rounded-full hover:bg-purple-900/20 font-semibold"
          >
            + Groupe
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

      {/* Section : demandes de messages en attente */}
      {!loading && pendingRequests.length > 0 && (
        <div className="shrink-0 border-b border-[#1e1e2f]">
          <p className="px-4 py-2 text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
            Demandes de messages ({pendingRequests.length})
          </p>
          {pendingRequests.map((req) => (
            <div
              key={req.senderId}
              className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2f]/30 bg-[#0f0f1a]"
            >
              <UserAvatarOnline
                userId={req.senderId}
                avatarUrl={req.avatarUrl}
                size="md"
                isOnline={isOnline(req.senderId)}
                isLive={isLive(req.senderId)}
                liveViewersCount={liveViewersFor(req.senderId)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{req.username}</p>
                <p className="text-xs text-gray-500 truncate">{req.preview}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void acceptRequest(req.senderId)}
                  disabled={acceptingRequest === req.senderId}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-full text-xs font-bold text-white"
                >
                  {acceptingRequest === req.senderId ? '...' : 'Accepter'}
                </button>
                <button
                  type="button"
                  onClick={() => void refuseRequest(req.senderId)}
                  disabled={refusingRequest === req.senderId}
                  className="px-3 py-1.5 bg-[#1a1a26] border border-red-500/30 hover:bg-red-900/20 disabled:opacity-50 rounded-full text-xs font-bold text-red-400"
                >
                  {refusingRequest === req.senderId ? '...' : 'Refuser'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && conversations.length === 0 && pendingRequests.length === 0 && (
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
          const isGroup = isGroupConversation(c);
          const rowKey = isGroup ? c.groupId! : c.userId!;
          const selected = !isGroup && c.userId ? selectedIds.has(c.userId) : false;
          const isConvMenuOpen = !isGroup && c.userId ? conversationMenuOpen === c.userId : false;
          const isMuted = !isGroup && c.isMuted;
          return (
            <li key={rowKey}>
              <div
                className={`relative flex items-center gap-3 p-4 border-b border-[#1e1e2f]/50 ${
                  selected ? 'bg-purple-900/25' : 'hover:bg-[#12121a]'
                }`}
              >
                {!isGroup && c.userId && (
                  <UserCheckbox checked={selected} onChange={() => toggleSelect(c.userId!)} />
                )}
                {isGroup && <span className="w-5 shrink-0" aria-hidden />}
                <button
                  type="button"
                  onClick={() => {
                    if (selectionCount > 0) return;
                    if (isConvMenuOpen) { setConversationMenuOpen(null); return; }
                    if (isGroup && c.groupId) void openGroupThread(c.groupId);
                    else if (c.userId) {
                      void openThread({
                        id: c.userId,
                        username: c.username,
                        usernameColor: c.usernameColor,
                        usernameWaveFrom: c.usernameWaveFrom,
                        usernameWaveTo: c.usernameWaveTo,
                        avatarUrl: c.avatarUrl,
                        isOnline: c.isOnline ?? isOnline(c.userId),
                        isMatch: c.isMatch,
                      });
                    }
                  }}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {isGroup ? (
                    <GroupAvatar name={c.username} size="lg" />
                  ) : (
                    c.userId && (
                      <UserAvatarOnline
                        userId={c.userId}
                        avatarUrl={c.avatarUrl}
                        size="lg"
                        isOnline={c.isOnline ?? isOnline(c.userId)}
                        isLive={isLive(c.userId)}
                        liveViewersCount={liveViewersFor(c.userId)}
                      />
                    )
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <p className="font-semibold text-white truncate flex items-center gap-1.5 min-w-0">
                        {isGroup ? (
                          <span className="truncate">{c.username}</span>
                        ) : (
                          <>
                            <UsernameWithMatchHeart
                              username={c.username}
                              usernameColor={c.usernameColor}
                              usernameWaveFrom={c.usernameWaveFrom}
                              usernameWaveTo={c.usernameWaveTo}
                              isMatch={isMatchedUser(c.userId ?? '', c.isMatch)}
                            />
                            {c.isMuted && (
                              <span
                                className="shrink-0 text-gray-500 text-xs"
                                title="Notifications désactivées"
                                aria-label="En sourdine"
                              >
                                🔕
                              </span>
                            )}
                            {c.isPendingRequest && (
                              <span
                                className="shrink-0 text-[10px] font-semibold text-purple-400 bg-purple-900/30 border border-purple-500/30 px-1.5 py-0.5 rounded-full"
                              >
                                Demande
                              </span>
                            )}
                            {c.isPendingSent && !c.isPendingRequest && (
                              <span
                                className="shrink-0 text-[10px] text-[#6b6b8a]"
                              >
                                En attente
                              </span>
                            )}
                          </>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-500 shrink-0 flex items-center gap-1.5">
                        {(c.unreadCount ?? 0) > 0 && (
                          <span
                            className={`min-w-[1rem] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              c.isMuted ? 'bg-gray-600 text-gray-200' : 'bg-purple-500 text-white'
                            }`}
                          >
                            {(c.unreadCount ?? 0) > 9 ? '9+' : c.unreadCount}
                          </span>
                        )}
                        {formatTime(c.lastTimestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-0.5">
                      {isGroup && !c.isFromMe && c.lastSenderName ? `${c.lastSenderName} : ` : c.isFromMe ? 'Vous : ' : ''}
                      {c.lastMessage || (isGroup ? `${c.memberCount ?? 0} membres` : '')}
                    </p>
                  </div>
                </button>

                {/* Menu ··· sourdine par conversation (DM seulement) */}
                {!isGroup && c.userId && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationMenuOpen((prev) => prev === c.userId ? null : c.userId!);
                      }}
                      className="p-1.5 text-gray-600 hover:text-gray-300 rounded-full hover:bg-white/5 transition"
                      aria-label="Options de la conversation"
                    >
                      ⋯
                    </button>
                    {isConvMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 z-30 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl shadow-xl overflow-hidden min-w-[14rem]">
                        <button
                          type="button"
                          disabled={muting}
                          onClick={async () => {
                            if (!token) return;
                            setConversationMenuOpen(null);
                            try {
                              if (isMuted) {
                                await api.unmuteUser(token, c.userId!);
                                setConversations((prev) =>
                                  prev.map((cv) => cv.userId === c.userId ? { ...cv, isMuted: false } : cv)
                                );
                              } else {
                                await api.muteUser(token, c.userId!);
                                setConversations((prev) =>
                                  prev.map((cv) => cv.userId === c.userId ? { ...cv, isMuted: true } : cv)
                                );
                              }
                              refreshMuted();
                              refreshUnread();
                            } catch {/* ignore */}
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d]"
                        >
                          {isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <SelectionBar />
    </div>
  );
}
