import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../context/AuthContext';
import { useDmUnread } from '../context/DmUnreadContext';
import { api } from '../lib/api';
import {
  ACCEPTED_IMAGE_FORMATS,
  validateImageFile,
  resizeImageInstagram,
  mimeTypeFromDataUrl,
} from '../lib/imageUtils';
import { getLivesGeo } from '../lib/livesGeo';
import { getSalonShareUrl } from '../lib/shareLink';
import { getSocket } from '../lib/socket';
import { useSupportTicketRoom, useSupportTicketUpdates } from '../hooks/useSupportTicketRealtime';
import { useMatchCreated } from '../lib/useMatchCreated';
import { CreateSalonModal, type CreateSalonModalPreset } from '../components/CreateSalonModal';
import { UserAvatarOnline } from '../components/UserAvatarOnline';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { LinkifiedText } from '../components/LinkifiedText';
import { verifyInternalLink } from '../lib/internalLinkCheck';
import { formatGroupConversationPreview, formatGroupSystemMessage } from '../lib/groupSystemMessage';
import type { InternalLinkTarget } from '../lib/linkifyText';
import { ConfirmModal } from '../components/ConfirmModal';
import { VirtualList } from '../components/VirtualList';
import { DmDirectMessageRow } from '../components/DmDirectMessageRow';
import {
  getSupportLastPreview,
  getSupportLastTimestamp,
  getSupportThread,
  isSupportUnread,
  markSupportSeen,
} from '../lib/supportThread';
import type {
  Conversation,
  DirectMessage,
  DmContact,
  DmRequest,
  GroupMessage,
  MessageGroupDetail,
  MusicMatch,
  Salon,
  SupportContactMessage,
  UserSearchHit,
} from '../types';

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

function SupportAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-purple-600/40 border border-purple-500/50 flex items-center justify-center font-bold text-purple-100 shrink-0`}
      aria-hidden
    >
      S
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

function groupConversationPreview(c: Conversation, t: TFunction): string {
  const text = formatGroupConversationPreview(c, t);
  return text || `${c.memberCount ?? 0} membres`;
}

function conversationListPrefix(c: Conversation, isGroup: boolean): string {
  if (isGroup) {
    if (c.lastMessageKind === 'system') return '';
    if (!c.isFromMe && c.lastSenderName) return `${c.lastSenderName} : `;
    if (c.isFromMe) return 'Vous : ';
    return '';
  }
  return c.isFromMe ? 'Vous : ' : '';
}

type View = 'list' | 'thread' | 'groupThread' | 'supportThread' | 'new' | 'createGroup' | 'blocked';

const DM_MATCHES_ONLY_KEY = 'onscen_dm_matches_only';

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

function matchToConversation(m: MusicMatch): Conversation {
  return {
    kind: 'dm',
    userId: m.otherUser.id,
    username: m.otherUser.username,
    usernameColor: m.otherUser.usernameColor,
    usernameWaveFrom: m.otherUser.usernameWaveFrom,
    usernameWaveTo: m.otherUser.usernameWaveTo,
    avatarUrl: m.otherUser.avatarUrl,
    lastMessage: 'Nouveau match musical ♥',
    lastTimestamp: m.createdAt,
    isFromMe: false,
    isMatch: true,
  };
}

function buildDisplayedConversations(
  conversations: Conversation[],
  matches: MusicMatch[],
  showMatchesOnly: boolean,
  isMatchedUser: (userId: string, explicit?: boolean) => boolean
): Conversation[] {
  if (!showMatchesOnly) return conversations;

  const matchedConversations = conversations.filter(
    (c) => !isGroupConversation(c) && isMatchedUser(c.userId ?? '', c.isMatch)
  );
  const conversationUserIds = new Set(
    conversations.filter((c) => c.userId).map((c) => c.userId!)
  );
  const matchOnlyRows = matches
    .filter((m) => !conversationUserIds.has(m.otherUser.id))
    .map(matchToConversation);

  return [...matchedConversations, ...matchOnlyRows].sort(
    (a, b) => b.lastTimestamp - a.lastTimestamp
  );
}

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isImageMime(mimeType?: string): boolean {
  return Boolean(mimeType && mimeType.startsWith('image/'));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const DM_MAX_FILE_SIZE = 10 * 1024 * 1024;

function contactMatchesQuery(contact: DmContact, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  if (normalizeForSearch(contact.username).includes(q)) return true;
  if (contact.displayName && normalizeForSearch(contact.displayName).includes(q)) return true;
  return false;
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
      className="onscen-checkbox"
      aria-label="Sélectionner"
    />
  );
}

type NewDmPick = {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
};

export function DmPage({
  openPeerId = null,
  openGroupId = null,
  openSupportMessageId = null,
  onOpenPeerConsumed,
  onOpenGroupConsumed,
  onOpenSupportConsumed,
  onOpenProfile,
  onOpenSalon,
  onOpenFeedPost,
  isActive = true,
}: {
  openPeerId?: string | null;
  openGroupId?: string | null;
  openSupportMessageId?: string | null;
  onOpenPeerConsumed?: () => void;
  onOpenGroupConsumed?: () => void;
  onOpenSupportConsumed?: () => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenFeedPost?: (postId: string) => void;
  isActive?: boolean;
} = {}) {
  const { user, token, setUserFromProfile } = useAuth();
  const { t, i18n } = useTranslation();
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
  const [blockedSearch, setBlockedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MusicMatch[]>([]);
  const [showMatchesOnly, setShowMatchesOnly] = useState(readMatchesOnlyFilter);
  const [pendingRequests, setPendingRequests] = useState<DmRequest[]>([]);
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);
  const [refusingRequest, setRefusingRequest] = useState<string | null>(null);
  const [conversationMenuOpen, setConversationMenuOpen] = useState<string | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupRenameDraft, setGroupRenameDraft] = useState('');
  const [groupRenaming, setGroupRenaming] = useState(false);
  const [transferringCreatorId, setTransferringCreatorId] = useState<string | null>(null);
  const [showGroupDeleteModal, setShowGroupDeleteModal] = useState(false);
  const [groupDeleteTransferTargetId, setGroupDeleteTransferTargetId] = useState<string | null>(null);
  const [groupDeleting, setGroupDeleting] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<UserSearchHit[]>([]);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'pending_sent' | null>(null);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [dmSendError, setDmSendError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    dataUrl: string;
    name: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [showNewDmSheet, setShowNewDmSheet] = useState(false);
  const [newDmQuery, setNewDmQuery] = useState('');
  const [newDmResults, setNewDmResults] = useState<UserSearchHit[]>([]);
  const [newDmSearching, setNewDmSearching] = useState(false);
  const [newDmSelectedUsers, setNewDmSelectedUsers] = useState<NewDmPick[]>([]);
  const [newDmGroupName, setNewDmGroupName] = useState('');
  const [newDmCreating, setNewDmCreating] = useState(false);
  const [followingFriends, setFollowingFriends] = useState<NewDmPick[]>([]);
  const [createSalonOpen, setCreateSalonOpen] = useState(false);
  const [createSalonPreset, setCreateSalonPreset] = useState<CreateSalonModalPreset | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [msgScrollEl, setMsgScrollEl] = useState<HTMLElement | null>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [linkUnavailableMsg, setLinkUnavailableMsg] = useState<string | null>(null);
  const lastTapByMsgRef = useRef<Map<string, number>>(new Map());
  const newDmInputRef = useRef<HTMLInputElement>(null);
  const supportThreadEndRef = useRef<HTMLDivElement | null>(null);
  const [activeSupportTicket, setActiveSupportTicket] = useState<SupportContactMessage | null>(null);
  const [supportDraft, setSupportDraft] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportResolving, setSupportResolving] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportToast, setSupportToast] = useState<string | null>(null);
  const supportToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredContacts = useMemo(
    () => contacts.filter((c) => contactMatchesQuery(c, contactSearch)),
    [contacts, contactSearch]
  );

  const onBeforeInternalLink = useCallback(
    async (target: InternalLinkTarget) => {
      if (!token) return true;
      const result = await verifyInternalLink(token, target, t);
      if (!result.ok) {
        setLinkUnavailableMsg(result.message);
        return false;
      }
      return true;
    },
    [token, t]
  );

  const filteredBlockedUsers = useMemo(
    () => blockedUsers.filter((b) => contactMatchesQuery(b, blockedSearch)),
    [blockedUsers, blockedSearch]
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
  const matchedUserIds = useMemo(
    () => new Set(matches.map((m) => m.otherUser.id)),
    [matches]
  );

  const isMatchedUser = useCallback(
    (userId: string, explicit?: boolean) => explicit === true || matchedUserIds.has(userId),
    [matchedUserIds]
  );

  const displayedConversations = useMemo(
    () => buildDisplayedConversations(conversations, matches, showMatchesOnly, isMatchedUser),
    [conversations, matches, showMatchesOnly, isMatchedUser]
  );

  const toggleMatchesOnly = () => {
    setShowMatchesOnly((prev) => {
      const next = !prev;
      persistMatchesOnlyFilter(next);
      return next;
    });
  };

  const handleMsgDoubleTap = useCallback(
    async (msgId: string) => {
      if (!token) return;
      try {
        const { reactions } = await api.reactToDmMessage(token, msgId, '❤️');
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions } : m)));
      } catch {
        /* ignore */
      }
    },
    [token]
  );

  const handleMsgTouchEnd = useCallback(
    (messageId: string, e: TouchEvent) => {
      const now = Date.now();
      const last = lastTapByMsgRef.current.get(messageId) ?? 0;
      if (now - last < 300) {
        e.preventDefault();
        void handleMsgDoubleTap(messageId);
      }
      lastTapByMsgRef.current.set(messageId, now);
    },
    [handleMsgDoubleTap]
  );

  const toggleMsgMenu = useCallback((messageId: string) => {
    setOpenMsgMenuId((id) => (id === messageId ? null : messageId));
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (isImageMime(file.type)) {
      const imgError = validateImageFile(file);
      if (imgError) {
        alert(imgError);
        return;
      }
      resizeImageInstagram(file)
        .then((dataUrl) => {
          setPendingAttachment({
            dataUrl,
            name: file.name,
            mimeType: mimeTypeFromDataUrl(dataUrl),
            size: file.size,
          });
        })
        .catch((err: unknown) => {
          alert(err instanceof Error ? err.message : "Impossible de traiter l'image");
        });
      return;
    }
    if (file.size > DM_MAX_FILE_SIZE) {
      alert('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPendingAttachment({ dataUrl, name: file.name, mimeType: file.type, size: file.size });
    };
    reader.readAsDataURL(file);
  }, []);

  const selectionCount = selectedIds.size;

  const loadMatches = useCallback(() => {
    if (!token) return;
    api.getMatches(token).then((r) => setMatches(r.matches));
  }, [token]);

  const loadPresence = useCallback(() => {
    if (!token) return;
    api.getDmPresence(token).then((r) => {
      setOnlineIds(new Set(r.onlineUserIds));
      setLiveIds(new Set(r.liveUserIds ?? []));
      setLiveViewersByUserId(r.liveViewersByUserId ?? {});
    });
  }, [token]);

  const loadConversations = useCallback(() => {
    if (!token) return;
    api.getConversations(token).then((r) => {
      setConversations(r.conversations);
      refreshUnread();
      // Bail out when no new online user was found to avoid a spurious re-render
      // cascade: every new Set identity forces all downstream effects to re-run (#185).
      setOnlineIds((prev) => {
        const toAdd = r.conversations.filter(
          (c) => !isGroupConversation(c) && c.isOnline && c.userId && !prev.has(c.userId!)
        );
        if (toAdd.length === 0) return prev;
        const next = new Set(prev);
        toAdd.forEach((c) => next.add(c.userId!));
        return next;
      });
    });
  }, [token, refreshUnread]);

  const loadActiveSupport = useCallback(async (): Promise<SupportContactMessage | null> => {
    if (!token) return null;
    try {
      const res = await api.getMySupportMessages(token);
      const ticket = res.messages[0] ?? null;
      setActiveSupportTicket(ticket);
      return ticket;
    } catch {
      return null;
    }
  }, [token]);

  const handleSupportRealtime = useCallback(
    (updated: SupportContactMessage) => {
      setActiveSupportTicket((prev) => {
        if (prev?.id === updated.id) return updated;
        if (!prev && updated.status !== 'resolved') return updated;
        return prev;
      });
      if (updated.status === 'resolved') {
        setSupportToast(t('dm.support.resolvedByAdmin'));
        if (supportToastTimer.current) clearTimeout(supportToastTimer.current);
        supportToastTimer.current = setTimeout(() => setSupportToast(null), 2500);
      }
    },
    [t]
  );

  useSupportTicketUpdates(handleSupportRealtime, Boolean(isActive && token));
  useSupportTicketRoom(
    view === 'supportThread' ? (activeSupportTicket?.id ?? null) : null,
    Boolean(isActive && token)
  );

  const openSupportThread = useCallback(
    (ticket?: SupportContactMessage | null) => {
      const target = ticket ?? activeSupportTicket;
      if (!target) return;
      setActiveUser(null);
      setActiveGroupState(null);
      setActivePeer(null);
      setActiveGroup(null);
      setMessages([]);
      setGroupMessages([]);
      setActiveSupportTicket(target);
      markSupportSeen(target.id);
      setSupportError(null);
      setView('supportThread');
    },
    [activeSupportTicket, setActivePeer, setActiveGroup]
  );

  const sendSupportReply = async () => {
    if (!token || !activeSupportTicket) return;
    const text = supportDraft.trim();
    if (text.length < 3) return;
    setSupportSending(true);
    setSupportError(null);
    try {
      const res = await api.replySupportContact(token, activeSupportTicket.id, text);
      setSupportDraft('');
      setActiveSupportTicket(res.message);
      await loadActiveSupport();
    } catch (e) {
      setSupportError(e instanceof Error ? e.message : t('dm.support.replyError'));
    } finally {
      setSupportSending(false);
    }
  };

  const resolveSupportTicket = async () => {
    if (!token || !activeSupportTicket) return;
    setSupportResolving(true);
    setSupportError(null);
    try {
      await api.resolveSupportContact(token, activeSupportTicket.id);
      setActiveSupportTicket(null);
      setSupportDraft('');
      setView('list');
      await loadActiveSupport();
    } catch (e) {
      setSupportError(e instanceof Error ? e.message : t('dm.support.resolveError'));
    } finally {
      setSupportResolving(false);
    }
  };

  // Stable callback so useMatchCreated's internal effect doesn't re-register the
  // socket listener on every DmPage render (which would happen with an inline
  // arrow function). This was the primary driver of the React #185 cascade when
  // clicking a chat.
  const handleMatchCreated = useCallback(() => {
    loadMatches();
    loadConversations();
  }, [loadMatches, loadConversations]);
  useMatchCreated(handleMatchCreated, Boolean(token));

  const loadBlocked = useCallback(() => {
    if (!token) return;
    api.getBlockedUsers(token).then((r) => setBlockedUsers(r.blocked));
  }, [token]);

  // Use a bail-out functional update so React doesn't schedule a re-render when
  // the selection was already empty (avoids the spurious render that effect [view]
  // used to trigger on every navigation, contributing to the #185 cascade).
  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllBlocked = () => {
    const visible = blockedSearch.trim() ? filteredBlockedUsers : blockedUsers;
    const allSelected = visible.length > 0 && visible.every((b) => selectedIds.has(b.id));
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(visible.map((b) => b.id)));
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
    const names = contacts.filter((c) => selectedIds.has(c.id)).map((c) => c.username);
    blockUsers(ids, names);
  };

  const openThread = useCallback(async (contact: DmContact) => {
    if (!token || selectionCount > 0) return;
    try {
      isNearBottomRef.current = true;
      prevMessageCountRef.current = 0;
      setOpenMsgMenuId(null);
      setMessages([]);
      setGroupMessages([]);
      setActiveGroupState(null);
      setBlockedByThem(false);
      setDmSendError(null);
      setActiveUser({ ...contact, isOnline: isOnline(contact.id) });
      setActivePeer(contact.id);
      setActiveGroup(null);
      setView('thread');
      const r = await api.getDmThread(token, contact.id);
      setMessages(r.messages);
      setActiveUser({ ...r.otherUser, isOnline: isOnline(r.otherUser.id) });
      setBlockedByThem(r.isBlockedByThem ?? false);
      refreshUnread();
      refreshMuted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Conversation indisponible');
      setView('list');
    }
  }, [token, selectionCount, isOnline, refreshUnread, refreshMuted, setActivePeer, setActiveGroup]);

  const openGroupThread = useCallback(async (groupId: string) => {
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
  }, [token, selectionCount, refreshUnread, setActivePeer, setActiveGroup]);

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

  const loadContacts = useCallback(() => {
    if (!token) return;
    api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [token]);

  const loadPendingRequests = useCallback(() => {
    if (!token) return;
    api.getDmRequests(token).then((r) => setPendingRequests(r.requests)).catch(() => {});
  }, [token]);

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
    if (!isActive || !token) return;
    setLoading(true);
    loadPresence();
    loadConversations();
    void loadActiveSupport();
    loadBlocked();
    loadMatches();
    loadPendingRequests();
    setLoading(false);
  }, [
    isActive,
    token,
    loadPresence,
    loadConversations,
    loadActiveSupport,
    loadBlocked,
    loadMatches,
    loadPendingRequests,
  ]);

  useEffect(() => {
    if (!isActive || !token) return;
    const refreshSupport = () => void loadActiveSupport();
    window.addEventListener('focus', refreshSupport);
    document.addEventListener('visibilitychange', refreshSupport);
    return () => {
      window.removeEventListener('focus', refreshSupport);
      document.removeEventListener('visibilitychange', refreshSupport);
    };
  }, [isActive, token, loadActiveSupport]);

  useEffect(() => {
    if (!openPeerId || !token || loading) return;
    const convo = conversations.find((c) => c.userId === openPeerId);
    const contact = contacts.find((c) => c.id === openPeerId);
    const match = matches.find((m) => m.otherUser.id === openPeerId);
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
      : contact
        ? { ...contact, isOnline: isOnline(contact.id) }
        : match
          ? {
              id: match.otherUser.id,
              username: match.otherUser.username,
              usernameColor: match.otherUser.usernameColor,
              usernameWaveFrom: match.otherUser.usernameWaveFrom,
              usernameWaveTo: match.otherUser.usernameWaveTo,
              avatarUrl: match.otherUser.avatarUrl,
              isOnline: isOnline(match.otherUser.id),
            }
          : {
              id: openPeerId,
              username: 'Utilisateur',
              isOnline: isOnline(openPeerId),
            };
    void openThread(peer);
    onOpenPeerConsumed?.();
  }, [
    openPeerId,
    token,
    loading,
    contacts,
    conversations,
    isOnline,
    matches,
    onOpenPeerConsumed,
    openThread,
  ]);

  useEffect(() => {
    if (!openGroupId || !token || loading) return;
    void openGroupThread(openGroupId);
    onOpenGroupConsumed?.();
  }, [openGroupId, token, loading, onOpenGroupConsumed, openGroupThread]);

  useEffect(() => {
    if (view === 'supportThread' && !activeSupportTicket) {
      setView('list');
      setSupportDraft('');
      setSupportError(null);
    }
  }, [view, activeSupportTicket]);

  useEffect(() => {
    if (!openSupportMessageId || !token || loading) return;
    void (async () => {
      try {
        const res = await api.getMySupportMessages(token);
        const match =
          openSupportMessageId === 'latest'
            ? (res.messages[0] ?? null)
            : (res.messages.find((m) => m.id === openSupportMessageId) ?? res.messages[0] ?? null);
        if (match) openSupportThread(match);
      } catch {
        /* ignore */
      }
      onOpenSupportConsumed?.();
    })();
  }, [openSupportMessageId, token, loading, onOpenSupportConsumed, openSupportThread]);

  useEffect(() => {
    if (!isActive || !token) return;
    const timer = window.setInterval(() => loadPresence(), 30_000);
    return () => window.clearInterval(timer);
  }, [isActive, token, loadPresence]);

  useEffect(() => {
    clearSelection();
    if (view !== 'new' && view !== 'createGroup') {
      setContactSearch('');
      setSearchFocused(false);
    }
    if (view !== 'createGroup') setGroupNameDraft('');
    if (view !== 'thread' && view !== 'groupThread') {
      setPendingAttachment(null);
    }
  }, [view, clearSelection]);

  useEffect(() => {
    if (view === 'new' || view === 'createGroup') searchInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== 'thread') setActivePeer(null);
    if (view !== 'groupThread') setActiveGroup(null);
  }, [view, setActivePeer, setActiveGroup]);

  useEffect(() => {
    if (view === 'supportThread' && activeSupportTicket) {
      markSupportSeen(activeSupportTicket.id);
      supportThreadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, activeSupportTicket]);

  useEffect(() => {
    if (!isActive || !token || !user) return;
    const socket = getSocket();
    if (!socket) return;
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
    const onGroupMembersChanged = ({
      groupId,
      group,
    }: {
      groupId: string;
      group: MessageGroupDetail;
    }) => {
      if (activeGroup?.id === groupId) {
        setActiveGroupState(group);
      }
      loadConversations();
    };
    const onGroupMemberRemoved = ({ groupId, userId: removedId }: { groupId: string; userId: string }) => {
      if (removedId === user?.id && activeGroup?.id === groupId) {
        setGroupManageOpen(false);
        setGroupMenuOpen(false);
        setView('list');
        setActiveGroupState(null);
        setActiveGroup(null);
      }
      loadConversations();
    };
    const onGroupDeleted = ({ groupId }: { groupId: string }) => {
      if (activeGroup?.id === groupId) {
        setGroupManageOpen(false);
        setGroupMenuOpen(false);
        setView('list');
        setActiveGroupState(null);
        setActiveGroup(null);
      }
      loadConversations();
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
    const onDmReaction = ({ messageId, reactions }: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };
    socket.on('dm', onDm);
    socket.on('group_message', onGroupMessage);
    socket.on('presence', onPresence);
    socket.on('dm_deleted', onDmDeleted);
    socket.on('dm_hidden', onDmHidden);
    socket.on('group_message_deleted', onGroupMessageDeleted);
    socket.on('group_message_hidden', onGroupMessageHidden);
    socket.on('group_members_changed', onGroupMembersChanged);
    socket.on('group_member_removed', onGroupMemberRemoved);
    socket.on('group_deleted', onGroupDeleted);
    socket.on('group_member_added', onGroupMembersChanged);
    socket.on('dm_request', onDmRequest);
    socket.on('dm_request_accepted', onDmRequestAccepted);
    socket.on('dm_request_refused', onDmRequestRefused);
    socket.on('dm_reaction', onDmReaction);
    return () => {
      socket.off('dm', onDm);
      socket.off('group_message', onGroupMessage);
      socket.off('presence', onPresence);
      socket.off('dm_deleted', onDmDeleted);
      socket.off('dm_hidden', onDmHidden);
      socket.off('group_message_deleted', onGroupMessageDeleted);
      socket.off('group_message_hidden', onGroupMessageHidden);
      socket.off('group_members_changed', onGroupMembersChanged);
      socket.off('group_member_removed', onGroupMemberRemoved);
      socket.off('group_deleted', onGroupDeleted);
      socket.off('group_member_added', onGroupMembersChanged);
      socket.off('dm_request', onDmRequest);
      socket.off('dm_request_accepted', onDmRequestAccepted);
      socket.off('dm_request_refused', onDmRequestRefused);
      socket.off('dm_reaction', onDmReaction);
    };
  }, [
    isActive,
    token,
    user,
    view,
    activeUser,
    activeGroup,
    loadConversations,
    refreshUnread,
    setActiveGroup,
  ]);

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
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
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

  const deleteMessage = (messageId: string, isMine: boolean) => {
    if (!token) return;
    setPendingConfirm({
      title: isMine ? 'Supprimer ce message ?' : 'Masquer ce message ?',
      description: isMine
        ? 'Le message sera supprimé pour vous et votre correspondant. Cette action est définitive.'
        : 'Le message sera masqué de votre conversation. Votre correspondant le verra toujours.',
      onConfirm: async () => {
        await api.deleteDmMessage(token, messageId, isMine);
        setMessages((m) => m.filter((x) => x.id !== messageId));
        setOpenMsgMenuId(null);
        loadConversations();
        setPendingConfirm(null);
      },
    });
  };

  const deleteGroupMessage = (messageId: string, isMine: boolean) => {
    if (!token) return;
    setPendingConfirm({
      title: isMine ? 'Supprimer ce message ?' : 'Masquer ce message ?',
      description: isMine
        ? 'Le message sera supprimé pour tous les membres. Cette action est définitive.'
        : 'Le message sera masqué de votre conversation. Les autres membres le verront toujours.',
      onConfirm: async () => {
        await api.deleteGroupMessage(token, messageId, isMine);
        setGroupMessages((m) => m.filter((x) => x.id !== messageId));
        setOpenMsgMenuId(null);
        loadConversations();
        setPendingConfirm(null);
      },
    });
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const hasText = draft.trim().length > 0;
    const hasAttachment = Boolean(pendingAttachment);
    if (!token || !activeUser || (!hasText && !hasAttachment) || sending) return;
    if (activeUser.acceptsPrivateMessages === false) {
      alert(t('dm.privateMessagesDisabled'));
      return;
    }
    setSending(true);
    setDmSendError(null);
    const text = draft.trim();
    setDraft('');
    const attachment = pendingAttachment ? { ...pendingAttachment } : null;
    setPendingAttachment(null);
    try {
      let attachmentPayload:
        | { attachmentUrl: string; attachmentName: string; attachmentSize: number; attachmentMimeType: string }
        | undefined;
      if (attachment) {
        const uploaded = await api.uploadChatAttachment(token, attachment.dataUrl, attachment.name);
        attachmentPayload = {
          attachmentUrl: uploaded.attachmentUrl,
          attachmentName: uploaded.attachmentName || attachment.name,
          attachmentSize: uploaded.attachmentSize,
          attachmentMimeType: uploaded.attachmentMimeType,
        };
      }
      const { message, status } = await api.sendDm(token, activeUser.id, text || '', attachmentPayload);
      if (status === 'pending') {
        setPendingStatus('pending_sent');
        setMessages((m) => [...m, message]);
      } else {
        setPendingStatus(null);
        setMessages((m) => [...m, message]);
      }
      loadConversations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur envoi';
      setDmSendError(msg);
      // If blocked by them, reflect that in state so the UI updates immediately.
      if (msg === 'Vous avez été bloqué par cet utilisateur') {
        setBlockedByThem(true);
      }
      setDraft(text);
      if (attachment) setPendingAttachment(attachment);
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

  const openPrivateSalonModal = useCallback(() => {
      if (!user) return;
      const allowedUserIds =
        view === 'groupThread' && activeGroup
          ? activeGroup.memberIds.filter((id) => id !== user.id)
          : activeUser
            ? [activeUser.id]
            : [];
      const peerLabel =
        view === 'groupThread' && activeGroup ? activeGroup.name : (activeUser?.username ?? '');
      setCreateSalonPreset({
        platform: 'youtube',
        accessMode: 'invite',
        allowedUserIds,
        title: peerLabel ? t('dm.privateSalonTitle', { name: peerLabel }) : undefined,
      });
      setMenuOpen(false);
      setGroupMenuOpen(false);
      setCreateSalonOpen(true);
    },
    [user, view, activeGroup, activeUser, t]
  );

  const onDmSalonCreated = useCallback(
    async (salon: Salon, _lat: number, _lon: number) => {
      setCreateSalonOpen(false);
      setCreateSalonPreset(null);
      if (!token) return;
      try {
        const shareUrl = await getSalonShareUrl(salon.id);
        const platformLabel = 'YouTube';
        const text = t('dm.privateSalonInviteMessage', { platform: platformLabel, url: shareUrl });
        if (view === 'thread' && activeUser) {
          const { message, status } = await api.sendDm(token, activeUser.id, text);
          if (status === 'pending') setPendingStatus('pending_sent');
          setMessages((m) => [...m, message]);
          loadConversations();
        } else if (view === 'groupThread' && activeGroup) {
          const { message } = await api.sendGroupMessage(token, activeGroup.id, text);
          setGroupMessages((m) => [...m, message]);
          loadConversations();
        }
      } catch {
        /* lien déjà copié par CreateSalonModal */
      }
      onOpenSalon?.(salon.id);
    },
    [token, t, view, activeUser, activeGroup, onOpenSalon, loadConversations]
  );

  const salonGeo = useMemo(() => {
    const geo = getLivesGeo();
    return { latitude: geo.latitude, longitude: geo.longitude };
  }, []);

  const renderCreateSalonModal = () => {
    if (!token || !user) return null;
    return (
      <CreateSalonModal
        token={token}
        username={user.username}
        connectedPlatforms={user.connectedPlatforms}
        platformLinks={user.platformLinks}
        profileGenres={user.favoriteGenres}
        activeSalonId={user.salonId ?? null}
        hostIsLive={Boolean(user.isLive && user.liveId)}
        open={createSalonOpen}
        preset={createSalonPreset}
        fallbackLatitude={salonGeo.latitude}
        fallbackLongitude={salonGeo.longitude}
        profileCity={user.city}
        onClose={() => {
          setCreateSalonOpen(false);
          setCreateSalonPreset(null);
        }}
        onCreated={onDmSalonCreated}
        onOpenExistingSalon={(salonId) => onOpenSalon?.(salonId)}
        onUserUpdated={setUserFromProfile}
      />
    );
  };

  const renderGroupRenameModal = () => {
    if (!groupRenameOpen || !activeGroup) return null;
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-rename-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !groupRenaming) setGroupRenameOpen(false);
        }}
      >
        <div className="w-full max-w-md bg-[#12121a] rounded-2xl ms-modal-panel border border-[#2d2d3d] shadow-2xl safe-area-pb">
          <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#1e1e2f]">
            <h2 id="group-rename-title" className="font-bold text-white text-base">
              {t('dm.renameGroup', { defaultValue: 'Renommer le groupe' })}
            </h2>
            <button
              type="button"
              onClick={() => setGroupRenameOpen(false)}
              disabled={groupRenaming}
              className="text-sm text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {t('common.cancel', { defaultValue: 'Annuler' })}
            </button>
          </div>
          <form
            className="p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void renameActiveGroup();
            }}
          >
            <input
              type="text"
              value={groupRenameDraft}
              onChange={(e) => setGroupRenameDraft(e.target.value)}
              maxLength={60}
              autoFocus
              placeholder={t('dm.groupNameOptional', { defaultValue: 'Nom du groupe (optionnel)' })}
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-500/60"
            />
            <button
              type="submit"
              disabled={groupRenaming || !groupRenameDraft.trim()}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-sm font-bold text-white"
            >
              {groupRenaming
                ? t('common.loading', { defaultValue: 'Chargement…' })
                : t('common.save', { defaultValue: 'Enregistrer' })}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderGroupDeleteModal = () => {
    if (!showGroupDeleteModal || !activeGroup || !user) return null;
    const otherMembers = activeGroup.members.filter((m) => m.id !== user.id);
    const busy = groupDeleting || transferringCreatorId != null;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-delete-choice-title"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) setShowGroupDeleteModal(false);
        }}
      >
        <div className="w-full max-w-md bg-[#12121a] rounded-2xl ms-modal-panel border border-[#2d2d3d] shadow-2xl safe-area-pb max-h-[90dvh] flex flex-col overflow-hidden">
          <div className="shrink-0 p-5 border-b border-[#1e1e2f]">
            <h2 id="group-delete-choice-title" className="text-lg font-bold text-white">
              {t('dm.deleteGroupChoiceTitle', { defaultValue: 'Supprimer ce groupe ?' })}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {t('dm.deleteGroupChoiceDesc', {
                defaultValue:
                  'Transférez l\'administration à un autre membre ou supprimez le groupe et tous ses messages pour tout le monde.',
              })}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <section>
              <h3 className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">
                {t('dm.transferAdminInstead', { defaultValue: 'Changer d\'administrateur' })}
              </h3>
              <ul className="space-y-1">
                {otherMembers.map((m) => {
                  const selected = groupDeleteTransferTargetId === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setGroupDeleteTransferTargetId(m.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                          selected
                            ? 'bg-purple-900/25 border-purple-500/50'
                            : 'bg-[#1a1a26] border-[#2d2d3d] hover:border-purple-500/30'
                        } disabled:opacity-50`}
                      >
                        <UserAvatarOnline
                          userId={m.id}
                          avatarUrl={m.avatarUrl}
                          size="sm"
                          isOnline={isOnline(m.id)}
                          isLive={isLive(m.id)}
                          liveViewersCount={liveViewersFor(m.id)}
                        />
                        <UsernameDisplay
                          username={m.username}
                          usernameColor={m.usernameColor}
                          usernameWaveFrom={m.usernameWaveFrom}
                          usernameWaveTo={m.usernameWaveTo}
                          className="font-semibold text-white text-sm truncate flex-1"
                        />
                        <span
                          className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                            selected ? 'border-purple-400 bg-purple-500' : 'border-gray-500'
                          }`}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={busy || !groupDeleteTransferTargetId}
                onClick={() => {
                  if (groupDeleteTransferTargetId) {
                    void executeTransferGroupAdmin(groupDeleteTransferTargetId);
                  }
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-bold text-white"
              >
                {transferringCreatorId
                  ? t('common.loading', { defaultValue: 'Chargement…' })
                  : t('dm.transferGroupAdmin', { defaultValue: 'Transférer le rôle' })}
              </button>
            </section>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2d2d3d]" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                {t('common.or', { defaultValue: 'ou' })}
              </span>
              <div className="flex-1 h-px bg-[#2d2d3d]" />
            </div>

            <section>
              <p className="text-xs text-gray-500 mb-2">
                {t('dm.deleteGroupForeverHint', {
                  defaultValue: 'Cette action est définitive pour tous les membres.',
                })}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeDeleteGroup()}
                className="w-full py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 disabled:opacity-40 text-sm font-bold text-white"
              >
                {groupDeleting
                  ? t('common.loading', { defaultValue: 'Chargement…' })
                  : t('dm.deleteGroupForever', { defaultValue: 'Supprimer définitivement' })}
              </button>
            </section>
          </div>

          <div className="shrink-0 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowGroupDeleteModal(false)}
              className="w-full py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white disabled:opacity-50"
            >
              {t('common.cancel', { defaultValue: 'Annuler' })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmModal = () => (
    <>
      <ConfirmModal
        open={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        description={pendingConfirm?.description}
        confirmLabel={pendingConfirm?.confirmLabel ?? 'Supprimer'}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return;
          void Promise.resolve(pendingConfirm.onConfirm()).catch((e: unknown) => {
            alert(e instanceof Error ? e.message : 'Impossible de supprimer');
          });
        }}
      />
      <ConfirmModal
        open={linkUnavailableMsg !== null}
        title={t('dm.linkUnavailableTitle')}
        description={linkUnavailableMsg ?? undefined}
        confirmLabel={t('common.close')}
        alertOnly
        destructive={false}
        onCancel={() => setLinkUnavailableMsg(null)}
        onConfirm={() => setLinkUnavailableMsg(null)}
      />
    </>
  );

  const memberIdsSet = useMemo(
    () => new Set(activeGroup?.memberIds ?? []),
    [activeGroup?.memberIds]
  );

  const isGroupCreator = activeGroup?.creatorId === user?.id;

  useEffect(() => {
    const trimmed = addMemberSearch.trim();
    if (!token || !groupManageOpen || trimmed.length < 2) {
      setAddMemberResults([]);
      setAddMemberLoading(false);
      return;
    }
    setAddMemberLoading(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, trimmed)
        .then((r) => setAddMemberResults(r.users.filter((u) => !memberIdsSet.has(u.id))))
        .catch(() => setAddMemberResults([]))
        .finally(() => setAddMemberLoading(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [addMemberSearch, token, groupManageOpen, memberIdsSet]);

  useEffect(() => {
    const q = newDmQuery.trim();
    if (!token || !showNewDmSheet || q.length < 2) {
      setNewDmResults([]);
      setNewDmSearching(false);
      return;
    }
    setNewDmSearching(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, q)
        .then((r) => setNewDmResults(r.users.slice(0, 12)))
        .catch(() => setNewDmResults([]))
        .finally(() => setNewDmSearching(false));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [newDmQuery, token, showNewDmSheet]);

  useEffect(() => {
    if (showNewDmSheet) {
      loadContacts();
      if (token) {
        api
          .getMyFollowing(token)
          .then((r) =>
            setFollowingFriends(
              r.following.map((u) => ({
                id: u.id,
                username: u.username,
                avatarUrl: u.avatarUrl,
                usernameColor: u.usernameColor,
                usernameWaveFrom: u.usernameWaveFrom,
                usernameWaveTo: u.usernameWaveTo,
              }))
            )
          )
          .catch(() => setFollowingFriends([]));
      }
      window.setTimeout(() => newDmInputRef.current?.focus(), 100);
    } else {
      setNewDmQuery('');
      setNewDmResults([]);
      setNewDmSearching(false);
      setFollowingFriends([]);
      setNewDmSelectedUsers([]);
      setNewDmGroupName('');
      setNewDmCreating(false);
    }
  }, [showNewDmSheet, token, loadContacts]);

  const blockedUserIds = useMemo(() => new Set(blockedUsers.map((b) => b.id)), [blockedUsers]);

  const newDmQueryTrimmed = newDmQuery.trim();
  const newDmIsSearchMode = newDmQueryTrimmed.length >= 2;

  const newDmRecentUsers = useMemo(() => {
    if (!showNewDmSheet) return [] as NewDmPick[];
    const seen = new Set<string>();
    const list: NewDmPick[] = [];
    const sorted = [...conversations]
      .filter((c) => !isGroupConversation(c) && c.userId)
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    for (const c of sorted) {
      if (!c.userId || seen.has(c.userId)) continue;
      const user: NewDmPick = {
        id: c.userId,
        username: c.username,
        avatarUrl: c.avatarUrl,
        usernameColor: c.usernameColor,
        usernameWaveFrom: c.usernameWaveFrom,
        usernameWaveTo: c.usernameWaveTo,
      };
      if (!contactMatchesQuery(user as DmContact, newDmQueryTrimmed)) continue;
      seen.add(c.userId);
      list.push(user);
      if (list.length >= 8) break;
    }
    return list;
  }, [showNewDmSheet, conversations, newDmQueryTrimmed]);

  const newDmMatchUsers = useMemo(() => {
    if (!showNewDmSheet) return [] as NewDmPick[];
    const seen = new Set(newDmRecentUsers.map((u) => u.id));
    return matches
      .filter((m) => !seen.has(m.otherUser.id))
      .map((m) => ({
        id: m.otherUser.id,
        username: m.otherUser.username,
        avatarUrl: m.otherUser.avatarUrl,
        usernameColor: m.otherUser.usernameColor,
        usernameWaveFrom: m.otherUser.usernameWaveFrom,
        usernameWaveTo: m.otherUser.usernameWaveTo,
      }))
      .filter((u) => contactMatchesQuery(u as DmContact, newDmQueryTrimmed))
      .slice(0, 8);
  }, [showNewDmSheet, matches, newDmRecentUsers, newDmQueryTrimmed]);

  const newDmFriendUsers = useMemo(() => {
    if (!showNewDmSheet) return [] as NewDmPick[];
    const seen = new Set([
      ...newDmRecentUsers.map((u) => u.id),
      ...newDmMatchUsers.map((u) => u.id),
    ]);
    const byId = new Map<string, NewDmPick>();
    for (const u of followingFriends) {
      if (seen.has(u.id) || blockedUserIds.has(u.id)) continue;
      byId.set(u.id, u);
    }
    for (const c of contacts) {
      if (seen.has(c.id) || blockedUserIds.has(c.id) || byId.has(c.id)) continue;
      byId.set(c.id, {
        id: c.id,
        username: c.username,
        avatarUrl: c.avatarUrl,
        usernameColor: c.usernameColor,
        usernameWaveFrom: c.usernameWaveFrom,
        usernameWaveTo: c.usernameWaveTo,
      });
    }
    return [...byId.values()]
      .filter((u) => contactMatchesQuery(u as DmContact, newDmQueryTrimmed))
      .sort((a, b) => a.username.localeCompare(b.username, 'fr'));
  }, [
    showNewDmSheet,
    followingFriends,
    contacts,
    blockedUserIds,
    newDmRecentUsers,
    newDmMatchUsers,
    newDmQueryTrimmed,
  ]);

  const newDmSearchUsers = useMemo(() => {
    if (!showNewDmSheet || !newDmIsSearchMode) return [] as NewDmPick[];
    const seen = new Set([
      ...newDmRecentUsers.map((u) => u.id),
      ...newDmMatchUsers.map((u) => u.id),
      ...newDmFriendUsers.map((u) => u.id),
    ]);
    return newDmResults
      .filter((hit) => !seen.has(hit.id))
      .map((hit) => ({
        id: hit.id,
        username: hit.username,
        avatarUrl: hit.avatarUrl,
        usernameColor: hit.usernameColor,
        usernameWaveFrom: hit.usernameWaveFrom,
        usernameWaveTo: hit.usernameWaveTo,
      }));
  }, [
    showNewDmSheet,
    newDmIsSearchMode,
    newDmResults,
    newDmRecentUsers,
    newDmMatchUsers,
    newDmFriendUsers,
  ]);

  const newDmSelectedCount = newDmSelectedUsers.length;

  const isNewDmUserSelected = useCallback(
    (userId: string) => newDmSelectedUsers.some((u) => u.id === userId),
    [newDmSelectedUsers]
  );

  const toggleNewDmUser = useCallback((user: NewDmPick) => {
    setNewDmSelectedUsers((prev) => {
      if (prev.some((u) => u.id === user.id)) {
        return prev.filter((u) => u.id !== user.id);
      }
      return [...prev, user];
    });
  }, []);

  const confirmNewDmSelection = useCallback(async () => {
    if (!token || newDmCreating || newDmSelectedUsers.length === 0) return;

    if (newDmSelectedUsers.length === 1) {
      const pick = newDmSelectedUsers[0]!;
      setShowNewDmSheet(false);
      setNewDmSelectedUsers([]);
      setNewDmGroupName('');
      void openThread({ ...pick, isOnline: isOnline(pick.id) });
      return;
    }

    const memberIds = newDmSelectedUsers.map((u) => u.id);
    let name = newDmGroupName.trim();
    if (!name) {
      const preview = newDmSelectedUsers.slice(0, 3).map((u) => u.username).join(', ');
      name =
        newDmSelectedUsers.length > 3
          ? `${preview} +${newDmSelectedUsers.length - 3}`
          : preview;
    }

    setNewDmCreating(true);
    try {
      const { group } = await api.createMessageGroup(token, name, memberIds);
      setShowNewDmSheet(false);
      setNewDmSelectedUsers([]);
      setNewDmGroupName('');
      loadConversations();
      await openGroupThread(group.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de créer le groupe');
    } finally {
      setNewDmCreating(false);
    }
  }, [
    token,
    newDmCreating,
    newDmSelectedUsers,
    newDmGroupName,
    isOnline,
    loadConversations,
    openGroupThread,
    openThread,
  ]);

  const renderNewDmUserRow = (user: NewDmPick, keyPrefix: string, showHeart = false) => {
    const selected = isNewDmUserSelected(user.id);
    return (
      <li key={`${keyPrefix}-${user.id}`}>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            selected ? 'bg-purple-900/25 border border-purple-500/40' : 'hover:bg-[#1a1a26]'
          }`}
        >
          <UserCheckbox checked={selected} onChange={() => toggleNewDmUser(user)} />
          <button
            type="button"
            onClick={() => toggleNewDmUser(user)}
            className="flex-1 flex items-center gap-3 text-left min-w-0"
          >
            <UserAvatarOnline
              userId={user.id}
              avatarUrl={user.avatarUrl}
              size="md"
              isOnline={isOnline(user.id)}
              isLive={isLive(user.id)}
              liveViewersCount={liveViewersFor(user.id)}
            />
            {showHeart ? (
              <span className="font-semibold text-white text-sm truncate flex-1 inline-flex items-center gap-1 min-w-0">
                <UsernameDisplay
                  username={user.username}
                  usernameColor={user.usernameColor}
                  usernameWaveFrom={user.usernameWaveFrom}
                  usernameWaveTo={user.usernameWaveTo}
                  className="truncate"
                />
                <span className="shrink-0 text-pink-400 text-sm" aria-hidden>
                  ♥
                </span>
              </span>
            ) : (
              <UsernameDisplay
                username={user.username}
                usernameColor={user.usernameColor}
                usernameWaveFrom={user.usernameWaveFrom}
                usernameWaveTo={user.usernameWaveTo}
                className="font-semibold text-white text-sm truncate flex-1"
              />
            )}
          </button>
        </div>
      </li>
    );
  };

  const addMemberToGroup = async (userId: string, username: string) => {
    if (!token || !activeGroup || addingMemberId) return;
    setAddingMemberId(userId);
    try {
      const { group } = await api.addGroupMember(token, activeGroup.id, userId);
      setActiveGroupState(group);
      setAddMemberSearch('');
      setAddMemberResults([]);
      loadConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Impossible d'ajouter ${username}`);
    } finally {
      setAddingMemberId(null);
    }
  };

  const removeMemberFromGroup = (memberId: string, username: string) => {
    if (!token || !activeGroup || removingMemberId) return;
    const isSelf = memberId === user?.id;
    if (isSelf && isGroupCreator && activeGroup.memberCount > 1) {
      setGroupDeleteTransferTargetId(
        activeGroup.members.find((m) => m.id !== user?.id)?.id ?? null
      );
      setShowGroupDeleteModal(true);
      return;
    }
    setPendingConfirm({
      title: isSelf ? 'Quitter ce groupe ?' : `Retirer ${username} du groupe ?`,
      description: isSelf
        ? 'Vous ne recevrez plus les messages de ce groupe.'
        : 'Cette personne ne pourra plus voir les messages du groupe.',
      confirmLabel: isSelf ? 'Quitter' : 'Retirer',
      onConfirm: async () => {
        setRemovingMemberId(memberId);
        try {
          await api.removeGroupMember(token, activeGroup.id, memberId);
          if (isSelf) {
            setGroupManageOpen(false);
            setGroupMenuOpen(false);
            setView('list');
            setActiveGroupState(null);
            setActiveGroup(null);
            loadConversations();
          } else {
            const r = await api.getGroupThread(token, activeGroup.id);
            setActiveGroupState(r.group);
            loadConversations();
          }
          setPendingConfirm(null);
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Impossible de retirer ce membre');
        } finally {
          setRemovingMemberId(null);
        }
      },
    });
  };

  const openGroupRename = () => {
    if (!activeGroup) return;
    setGroupRenameDraft(activeGroup.name);
    setGroupRenameOpen(true);
    setGroupMenuOpen(false);
  };

  const renameActiveGroup = async () => {
    if (!token || !activeGroup || groupRenaming) return;
    const name = groupRenameDraft.trim();
    if (!name) {
      alert(t('dm.groupNameRequired', { defaultValue: 'Donnez un nom au groupe' }));
      return;
    }
    if (name === activeGroup.name) {
      setGroupRenameOpen(false);
      return;
    }
    setGroupRenaming(true);
    try {
      const { group } = await api.renameMessageGroup(token, activeGroup.id, name);
      setActiveGroupState(group);
      setGroupRenameOpen(false);
      setGroupMenuOpen(false);
      setConversations((prev) =>
        prev.map((c) => (c.groupId === group.id ? { ...c, username: group.name } : c))
      );
      loadConversations();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('dm.renameGroupFailed', { defaultValue: 'Impossible de renommer le groupe' }));
    } finally {
      setGroupRenaming(false);
    }
  };

  const leaveActiveGroup = () => {
    if (!user || !activeGroup) return;
    setGroupMenuOpen(false);
    removeMemberFromGroup(user.id, user.username);
  };

  const deleteActiveGroup = () => {
    if (!token || !activeGroup || !isGroupCreator) return;
    setGroupMenuOpen(false);
    const otherMembers = activeGroup.members.filter((m) => m.id !== user?.id);
    if (otherMembers.length === 0) {
      setPendingConfirm({
        title: t('dm.deleteGroupConfirmTitle', { defaultValue: 'Supprimer ce groupe ?' }),
        description: t('dm.deleteGroupConfirmDesc', {
          defaultValue:
            'Le groupe et tous ses messages seront supprimés pour tous les membres. Cette action est définitive.',
        }),
        confirmLabel: t('dm.deleteGroupForever', { defaultValue: 'Supprimer définitivement' }),
        onConfirm: () => void executeDeleteGroup(),
      });
      return;
    }
    setGroupDeleteTransferTargetId(otherMembers[0]?.id ?? null);
    setShowGroupDeleteModal(true);
  };

  const executeDeleteGroup = async () => {
    if (!token || !activeGroup || groupDeleting) return;
    setGroupDeleting(true);
    try {
      await api.deleteMessageGroup(token, activeGroup.id);
      setShowGroupDeleteModal(false);
      setGroupManageOpen(false);
      setView('list');
      setActiveGroupState(null);
      setActiveGroup(null);
      setPendingConfirm(null);
      loadConversations();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t('dm.deleteGroupFailed', { defaultValue: 'Impossible de supprimer le groupe' })
      );
    } finally {
      setGroupDeleting(false);
    }
  };

  const executeTransferGroupAdmin = async (memberId: string) => {
    if (!token || !activeGroup || transferringCreatorId) return;
    setTransferringCreatorId(memberId);
    try {
      const { group } = await api.transferGroupCreator(token, activeGroup.id, memberId);
      setActiveGroupState(group);
      setShowGroupDeleteModal(false);
      setPendingConfirm(null);
      loadConversations();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : t('dm.transferGroupAdminFailed', {
              defaultValue: 'Impossible de transférer le rôle',
            })
      );
    } finally {
      setTransferringCreatorId(null);
    }
  };

  const transferGroupAdmin = (memberId: string, username: string) => {
    if (!token || !activeGroup || !isGroupCreator || transferringCreatorId) return;
    if (memberId === user?.id) return;
    setPendingConfirm({
      title: t('dm.transferGroupAdminConfirmTitle', {
        defaultValue: 'Nommer {{name}} administrateur ?',
        name: username,
      }),
      description: t('dm.transferGroupAdminConfirmDesc', {
        defaultValue:
          '{{name}} pourra gérer les membres, renommer et supprimer le groupe. Vous resterez membre mais ne serez plus administrateur.',
        name: username,
      }),
      confirmLabel: t('dm.transferGroupAdmin', { defaultValue: 'Transférer le rôle' }),
      onConfirm: () => void executeTransferGroupAdmin(memberId),
    });
  };

  const blockActiveUser = () => {
    if (!activeUser) return;
    blockUsers([activeUser.id], [activeUser.username]);
  };

  const hideConversationFromList = (userId: string, username: string) => {
    if (!token) return;
    setConversationMenuOpen(null);
    setPendingConfirm({
      title: 'Supprimer cette conversation ?',
      description: `La conversation avec ${username} sera masquée de votre liste. Si vous recevez un nouveau message, elle réapparaîtra.`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        await api.hideDmConversation(token, userId);
        if (activeUser?.id === userId) {
          setActiveUser(null);
          setActivePeer(null);
          setMessages([]);
          setView('list');
        }
        loadConversations();
        refreshUnread();
        setPendingConfirm(null);
      },
    });
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
    const visibleBlocked = filteredBlockedUsers;
    const allVisibleSelected =
      visibleBlocked.length > 0 && visibleBlocked.every((b) => selectedIds.has(b.id));

    return (
      <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <button
            type="button"
            onClick={() => {
              setBlockedSearch('');
              setView('list');
            }}
            className="text-gray-400 hover:text-white text-xl"
          >
            ←
          </button>
          <h2 className="font-bold text-white flex-1">{t('dm.blocked')}</h2>
          {visibleBlocked.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllBlocked}
              className="text-xs text-green-400 font-semibold"
            >
              {allVisibleSelected ? 'Tout désélect.' : 'Tout'}
            </button>
          )}
        </header>

        {blockedUsers.length > 0 && (
          <div className="shrink-0 px-4 py-3 border-b border-[#1e1e2f]/50">
            <div className="relative flex items-center h-9 rounded-full bg-[#1a1a26]/90 border border-[#2d2d3d]/90 shadow-sm shadow-black/20 transition-[border-color,box-shadow] focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/25 focus-within:shadow-purple-500/10">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                value={blockedSearch}
                onChange={(e) => setBlockedSearch(e.target.value)}
                placeholder={t('dm.blockedSearchPlaceholder')}
                autoComplete="off"
                aria-label={t('dm.blockedSearchPlaceholder')}
                className="w-full h-full pl-9 pr-8 text-xs rounded-full bg-transparent text-white placeholder:text-gray-500/90 outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {blockedSearch && (
                <button
                  type="button"
                  onClick={() => setBlockedSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 text-sm leading-none transition-colors"
                  aria-label={t('dm.clearSearch')}
                >
                  ×
                </button>
              )}
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              Cochez puis « Débloquer » en bas, ou utilisez le bouton sur chaque ligne
            </p>
          </div>
        )}

        <ul className="flex-1 min-h-0 overflow-y-auto p-2">
          {blockedUsers.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">{t('dm.blockedEmpty')}</p>
          )}
          {blockedUsers.length > 0 && visibleBlocked.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">{t('dm.blockedNoResults')}</p>
          )}
          {visibleBlocked.map((b) => {
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
                  <UsernameDisplay
                    username={b.username}
                    usernameColor={b.usernameColor}
                    usernameWaveFrom={b.usernameWaveFrom}
                    usernameWaveTo={b.usernameWaveTo}
                    className="flex-1 font-semibold truncate"
                  />
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
            <p className="text-center text-gray-500 text-sm py-8">{t('dm.noMutualContacts')}</p>
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
                    {contactSearch.trim() ? (
                      <HighlightedUsername username={c.username} query={contactSearch} />
                    ) : (
                      <UsernameDisplay
                        username={c.username}
                        usernameColor={c.usernameColor}
                        usernameWaveFrom={c.usernameWaveFrom}
                        usernameWaveTo={c.usernameWaveTo}
                      />
                    )}
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
                  {contactSearch.trim() ? (
                    <HighlightedUsername username={c.username} query={contactSearch} />
                  ) : (
                    <UsernameDisplay
                      username={c.username}
                      usernameColor={c.usernameColor}
                      usernameWaveFrom={c.usernameWaveFrom}
                      usernameWaveTo={c.usernameWaveTo}
                    />
                  )}
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

  let threadPanel: ReactNode = null;

  if (view === 'supportThread' && activeSupportTicket) {
    const supportThread = getSupportThread(activeSupportTicket);
    const canReplySupport = activeSupportTicket.status === 'replied';
    const isWaitingSupport = activeSupportTicket.status === 'open';
    const isResolvedSupport = activeSupportTicket.status === 'resolved';

    threadPanel = (
      <div className="dm-thread-root relative flex flex-col flex-1 min-h-0 bg-[#0b0b0f] overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a] relative z-10">
          <button
            type="button"
            onClick={() => {
              setView('list');
              void loadActiveSupport();
            }}
            className="lg:hidden text-gray-400 hover:text-white text-3xl w-10 h-10 flex items-center justify-center shrink-0"
          >
            ←
          </button>
          <SupportAvatar size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{t('dm.support.title')}</p>
            <p className="text-xs text-gray-500">{t('dm.support.subtitle')}</p>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
          <div className="space-y-3">
            {supportThread.map((entry) => {
              const isMe = entry.role === 'user';
              return (
                <div
                  key={entry.id}
                  className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && <SupportAvatar size="sm" />}
                  <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <p className="text-[10px] font-semibold text-purple-300 mb-0.5 px-1">
                        {t('dm.support.teamLabel')}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        isMe
                          ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm shadow-sm shadow-purple-900/30'
                          : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-100 rounded-bl-sm'
                      }`}
                    >
                      {entry.body}
                    </div>
                    <p className={`text-[9px] text-gray-500 mt-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                      {new Date(entry.createdAt).toLocaleString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={supportThreadEndRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-[#1e1e2f] px-3 py-3 space-y-2 bg-[#12121a] safe-area-pb">
          {supportError && <p className="text-xs text-red-400 text-center">{supportError}</p>}
          {canReplySupport ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendSupportReply();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={supportDraft}
                  onChange={(e) => setSupportDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendSupportReply();
                    }
                  }}
                  rows={2}
                  maxLength={4000}
                  placeholder={t('dm.support.replyPlaceholder')}
                  className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-2xl px-3 py-2 text-white text-sm resize-none focus:border-purple-500/60 outline-none"
                />
                <button
                  type="submit"
                  disabled={supportSending || supportDraft.trim().length < 3}
                  className="shrink-0 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm disabled:opacity-50"
                >
                  {supportSending ? t('dm.support.sending') : t('dm.send')}
                </button>
              </form>
              <button
                type="button"
                onClick={() => void resolveSupportTicket()}
                disabled={supportResolving}
                className="w-full py-2 rounded-xl bg-green-700/80 hover:bg-green-600 text-white font-semibold text-xs disabled:opacity-50"
              >
                {supportResolving ? t('dm.support.resolving') : t('dm.support.markResolved')}
              </button>
            </>
          ) : isWaitingSupport ? (
            <p className="text-xs text-center text-amber-400/90 py-1">{t('dm.support.pending')}</p>
          ) : isResolvedSupport ? (
            <p className="text-xs text-center text-green-400/90 py-1">{t('dm.support.ticketResolved')}</p>
          ) : null}
        </div>
        {supportToast && (
          <div className="absolute bottom-24 left-4 right-4 z-[80] mx-auto max-w-sm pointer-events-none">
            <div className="rounded-xl bg-green-900/90 border border-green-500/40 px-4 py-3 text-center text-sm text-green-100 shadow-xl">
              {supportToast}
            </div>
          </div>
        )}
      </div>
    );
  } else if (view === 'thread' && activeUser) {
    const online = isOnline(activeUser.id);
    const live = isLive(activeUser.id);
    const isPendingReceived = conversations.find((c) => c.userId === activeUser.id)?.isPendingRequest ?? false;
    const isPendingMySent = pendingStatus === 'pending_sent' ||
      (conversations.find((c) => c.userId === activeUser.id)?.isPendingSent ?? false);
    const canSendDm = activeUser.acceptsPrivateMessages !== false;
    const iBlockedThem = blockedUsers.some((b) => b.id === activeUser.id);
    threadPanel = (
      <div className="dm-thread-root relative flex flex-col flex-1 min-h-0 bg-[#0b0b0f] overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a] relative z-10">
          <button
            type="button"
            onClick={() => {
              setView('list');
              setMenuOpen(false);
              loadConversations();
            }}
            className="lg:hidden text-gray-400 hover:text-white text-3xl w-10 h-10 flex items-center justify-center shrink-0"
          >
            ←
          </button>
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
              {canSendDm && (
                <>
                  <button
                    type="button"
                    onClick={() => openPrivateSalonModal()}
                    className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d]"
                  >
                    {t('dm.createPrivateYoutubeSalon')}
                  </button>
                </>
              )}
              {activeUser.isMutedByMe ? (
                <button
                  type="button"
                  onClick={() => void unmuteActiveUser()}
                  disabled={muting}
                  className={`w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] disabled:opacity-50${canSendDm ? ' border-t border-[#2d2d3d]' : ''}`}
                >
                  {muting ? '...' : 'Réactiver les notifications'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void muteActiveUser()}
                  disabled={muting}
                  className={`w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] disabled:opacity-50${canSendDm ? ' border-t border-[#2d2d3d]' : ''}`}
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

        {!canSendDm && (
          <div className="shrink-0 px-4 py-3 bg-[#1a1a26] border-b border-[#2d2d3d]">
            <p className="text-xs text-gray-400 text-center">{t('dm.privateMessagesDisabledHint')}</p>
          </div>
        )}

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

        {blockedByThem && !iBlockedThem && (
          <div className="shrink-0 px-4 py-2.5 bg-red-950/20 border-b border-red-500/15">
            <p className="text-xs text-red-400 text-center">
              Vous avez été bloqué par cet utilisateur — vous ne pouvez plus lui envoyer de message.
            </p>
          </div>
        )}

        {iBlockedThem && (
          <div className="shrink-0 px-4 py-2.5 bg-[#1a1010] border-b border-red-500/15 flex items-center justify-between gap-3">
            <p className="text-xs text-red-400">Vous avez bloqué cet utilisateur.</p>
            <button
              type="button"
              onClick={() => unblockOne(activeUser.id)}
              disabled={unblocking}
              className="shrink-0 px-3 py-1 bg-[#2d1818] border border-red-500/30 hover:bg-red-900/30 rounded-full text-xs text-red-300 disabled:opacity-50"
            >
              {unblocking ? '...' : 'Débloquer'}
            </button>
          </div>
        )}

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div
            ref={(el) => {
              messagesScrollRef.current = el;
              setMsgScrollEl(el);
            }}
            onScroll={handleMessagesScroll}
            className="dm-messages-scroll flex-1 min-h-0 p-3"
          >
            <div className="min-h-full flex flex-col justify-end space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-4">Aucun message. Envoyez le premier !</p>
          )}
          {messages.length > 40 && msgScrollEl ? (
            <VirtualList
              items={messages}
              customScrollParent={msgScrollEl}
              followOutput="auto"
              initialTopMostItemIndex={Math.max(0, messages.length - 1)}
              renderItem={(m) => {
                const isMe = m.senderId === user?.id;
                const menuOpen = openMsgMenuId === m.id;
                const heartReactions = m.reactions?.['❤️'] ?? [];
                const heartCount = heartReactions.length;
                return (
                  <DmDirectMessageRow
                    key={m.id}
                    message={m}
                    isMe={isMe}
                    menuOpen={menuOpen}
                    heartCount={heartCount}
                    listSpacer
                    onDoubleTap={handleMsgDoubleTap}
                    onTouchEnd={handleMsgTouchEnd}
                    onToggleMenu={toggleMsgMenu}
                    onDelete={deleteMessage}
                    onOpenProfile={onOpenProfile}
                    onOpenSalon={onOpenSalon}
                    onOpenFeedPost={onOpenFeedPost}
                    onBeforeInternalLink={onBeforeInternalLink}
                  />
                );
              }}
            />
          ) : (
          messages.map((m) => {
            const isMe = m.senderId === user?.id;
            const menuOpen = openMsgMenuId === m.id;
            const heartReactions = m.reactions?.['❤️'] ?? [];
            const heartCount = heartReactions.length;
            return (
              <DmDirectMessageRow
                key={m.id}
                message={m}
                isMe={isMe}
                menuOpen={menuOpen}
                heartCount={heartCount}
                onDoubleTap={handleMsgDoubleTap}
                onTouchEnd={handleMsgTouchEnd}
                onToggleMenu={toggleMsgMenu}
                onDelete={deleteMessage}
                onOpenProfile={onOpenProfile}
                onOpenSalon={onOpenSalon}
                onOpenFeedPost={onOpenFeedPost}
                onBeforeInternalLink={onBeforeInternalLink}
              />
            );
          })
          )}
            </div>
          </div>

          {pendingAttachment && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#1a1a26] border-t border-[#2d2d3d]">
              {isImageMime(pendingAttachment.mimeType) ? (
                <img
                  src={pendingAttachment.dataUrl}
                  alt={pendingAttachment.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                  📎
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{pendingAttachment.name}</p>
                <p className="text-[10px] text-gray-500">{formatFileSize(pendingAttachment.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white text-sm rounded-full hover:bg-white/10"
                aria-label="Retirer la pièce jointe"
              >
                ✕
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={`${ACCEPTED_IMAGE_FORMATS},.pdf,.mp3,.mp4,.zip,.doc,.docx,.xls,.xlsx,.txt,.csv`}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = '';
            }}
          />
          {dmSendError && !iBlockedThem && !blockedByThem && (
            <div className="shrink-0 px-4 py-2 bg-red-950/30 border-t border-red-500/20">
              <p className="text-xs text-red-400 text-center">{dmSendError}</p>
            </div>
          )}
          {iBlockedThem || blockedByThem ? (
            <div className="dm-compose-bar shrink-0 flex items-center justify-center px-4 py-3 bg-[#12121a] border-t border-[#1e1e2f]">
              <p className="text-xs text-[#5a5a7a]">Envoi de message désactivé</p>
            </div>
          ) : (
            <form
              onSubmit={sendMessage}
              className="dm-compose-bar shrink-0 flex gap-2 px-3 py-2 border-t border-[#1e1e2f] bg-[#12121a] items-center"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canSendDm}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1a1a26] border border-[#2d2d3d] text-base disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Joindre un fichier"
              >
                📎
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (dmSendError) setDmSendError(null); }}
                placeholder={canSendDm ? 'Écrire un message privé...' : t('dm.privateMessagesDisabledHint')}
                disabled={!canSendDm}
                className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-4 py-2.5 text-sm text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSendDm || (!draft.trim() && !pendingAttachment) || sending}
                className="shrink-0 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-full font-bold text-white text-sm"
              >
                {t('dm.send')}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  } else if (view === 'groupThread' && activeGroup) {
    const memberLabel = activeGroup.members.map((m) => m.username).join(', ');
    const senderNames = new Map(activeGroup.members.map((m) => [m.id, m.username]));
    const senderColors = new Map(
      activeGroup.members.map((m) => [
        m.id,
        { color: m.usernameColor, waveFrom: m.usernameWaveFrom, waveTo: m.usernameWaveTo },
      ])
    );
    const addableContacts = filteredContacts.filter((c) => !memberIdsSet.has(c.id));
    const addMemberTrimmed = addMemberSearch.trim();
    const showAddContacts =
      groupManageOpen && addMemberTrimmed.length > 0 && addMemberTrimmed.length < 2;
    const addRows: { id: string; username: string }[] = addMemberTrimmed.length >= 2
      ? addMemberResults
      : showAddContacts
        ? addableContacts
            .filter((c) => contactMatchesQuery(c, addMemberSearch))
            .map((c) => ({ id: c.id, username: c.username }))
        : addableContacts.map((c) => ({ id: c.id, username: c.username }));

    if (groupManageOpen) {
      return (
        <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
          <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a]">
            <button
              type="button"
              onClick={() => {
                setGroupManageOpen(false);
                setAddMemberSearch('');
                setAddMemberResults([]);
              }}
              className="text-gray-400 hover:text-white text-xl"
            >
              ←
            </button>
            <h2 className="font-bold text-white flex-1 truncate">Gérer le groupe</h2>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {t('dm.renameGroup', { defaultValue: 'Renommer le groupe' })}
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={groupRenameDraft}
                  onChange={(e) => setGroupRenameDraft(e.target.value)}
                  maxLength={60}
                  placeholder={t('dm.groupNameOptional', { defaultValue: 'Nom du groupe (optionnel)' })}
                  className="flex-1 min-w-0 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-500/60"
                />
                <button
                  type="button"
                  onClick={() => void renameActiveGroup()}
                  disabled={
                    groupRenaming ||
                    !groupRenameDraft.trim() ||
                    groupRenameDraft.trim() === activeGroup.name
                  }
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm font-bold text-white"
                >
                  {groupRenaming
                    ? t('common.loading', { defaultValue: 'Chargement…' })
                    : t('common.save', { defaultValue: 'Enregistrer' })}
                </button>
              </div>
            </section>

            {isGroupCreator && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {t('dm.groupAdminSection', { defaultValue: 'Administrateur du groupe' })}
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  {t('dm.groupAdminHint', {
                    defaultValue:
                      'Transférez le rôle à un autre membre pour lui confier la gestion du groupe.',
                  })}
                </p>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Membres ({activeGroup.memberCount})
              </h3>
              <ul className="space-y-1">
                {activeGroup.members.map((m) => {
                  const isMe = m.id === user?.id;
                  const isAdmin = m.id === activeGroup.creatorId;
                  const canRemove = isMe || isGroupCreator;
                  const canTransferAdmin = isGroupCreator && !isMe && !isAdmin;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d]"
                    >
                      <UserAvatarOnline
                        userId={m.id}
                        avatarUrl={m.avatarUrl}
                        size="sm"
                        isOnline={isOnline(m.id)}
                        isLive={isLive(m.id)}
                        liveViewersCount={liveViewersFor(m.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <UsernameDisplay
                          username={m.username}
                          usernameColor={m.usernameColor}
                          usernameWaveFrom={m.usernameWaveFrom}
                          usernameWaveTo={m.usernameWaveTo}
                          className="font-semibold text-white truncate block"
                        />
                        <p className="text-[10px] text-gray-500">
                          {isAdmin
                            ? t('dm.groupAdmin', { defaultValue: 'Administrateur' })
                            : isMe
                              ? t('dm.you', { defaultValue: 'Vous' })
                              : m.isOnline
                                ? t('dm.online', { defaultValue: 'En ligne' })
                                : t('dm.offline', { defaultValue: 'Hors ligne' })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canTransferAdmin && (
                          <button
                            type="button"
                            onClick={() => transferGroupAdmin(m.id, m.username)}
                            disabled={transferringCreatorId === m.id}
                            className="text-xs font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50 px-2 py-1 whitespace-nowrap"
                          >
                            {transferringCreatorId === m.id
                              ? '...'
                              : t('dm.makeGroupAdmin', { defaultValue: 'Nommer admin' })}
                          </button>
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => void removeMemberFromGroup(m.id, m.username)}
                            disabled={removingMemberId === m.id}
                            className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1 whitespace-nowrap"
                          >
                            {removingMemberId === m.id
                              ? '...'
                              : isMe
                                ? t('dm.leaveGroup', { defaultValue: 'Quitter' })
                                : t('dm.removeMember', { defaultValue: 'Retirer' })}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!isGroupCreator && (
                <p className="text-[10px] text-gray-500 mt-2">
                  {t('dm.groupAdminOnlyHint', {
                    defaultValue: 'Seul l\'administrateur peut retirer les autres membres.',
                  })}
                </p>
              )}
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Ajouter un membre
              </h3>
              <div className="flex items-center gap-2 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 focus-within:border-purple-500/60 mb-2">
                <span className="text-gray-500 text-sm" aria-hidden>
                  🔍
                </span>
                <input
                  type="search"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                />
              </div>
              <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] max-h-48 overflow-y-auto">
                {addMemberLoading && (
                  <p className="text-xs text-gray-500 px-3 py-2">Recherche…</p>
                )}
                {!addMemberLoading && addRows.length === 0 && (
                  <p className="text-xs text-gray-500 px-3 py-2">
                    {addMemberTrimmed.length >= 2
                      ? 'Aucun utilisateur trouvé'
                      : 'Aucun contact à ajouter — recherchez un utilisateur'}
                  </p>
                )}
                {!addMemberLoading &&
                  addRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-[#1a1a26]"
                    >
                      <span className="flex-1 text-sm text-white truncate">{row.username}</span>
                      <button
                        type="button"
                        onClick={() => void addMemberToGroup(row.id, row.username)}
                        disabled={addingMemberId === row.id}
                        className="shrink-0 text-xs font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-50"
                      >
                        {addingMemberId === row.id ? '...' : 'Ajouter'}
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          </div>
          {renderGroupRenameModal()}
          {renderGroupDeleteModal()}
          {renderConfirmModal()}
        </div>
      );
    }

    threadPanel = (
      <div className="dm-thread-root relative flex flex-col flex-1 min-h-0 bg-[#0b0b0f] overflow-hidden">
        <header className="shrink-0 flex items-center gap-3 p-3 border-b border-[#1e1e2f] bg-[#12121a] relative z-10">
          <button
            type="button"
            onClick={() => {
              setView('list');
              setActiveGroupState(null);
              setGroupMenuOpen(false);
              loadConversations();
            }}
            className="lg:hidden text-gray-400 hover:text-white text-xl"
          >
            ←
          </button>
          <GroupAvatar name={activeGroup.name} size="sm" />
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={openGroupRename}
              className="font-bold text-white truncate text-left max-w-full hover:text-purple-300 transition-colors"
              title={t('dm.renameGroup', { defaultValue: 'Renommer le groupe' })}
            >
              {activeGroup.name}
            </button>
            <p className="text-xs text-gray-400 truncate" title={memberLabel}>
              {activeGroup.memberCount} membres · {memberLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGroupMenuOpen((v) => !v)}
            className="px-2 py-1 text-gray-400 hover:text-white text-lg"
            aria-label="Options du groupe"
          >
            ⋮
          </button>
          {groupMenuOpen && (
            <div className="absolute right-3 top-full mt-1 z-30 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl shadow-xl overflow-hidden min-w-[12rem]">
              <button
                type="button"
                onClick={openGroupRename}
                className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d]"
              >
                {t('dm.renameGroup', { defaultValue: 'Renommer le groupe' })}
              </button>
              <button
                type="button"
                onClick={() => openPrivateSalonModal()}
                className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] border-t border-[#2d2d3d]"
              >
                {t('dm.createPrivateYoutubeSalon')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroupMenuOpen(false);
                  setGroupRenameDraft(activeGroup.name);
                  setGroupManageOpen(true);
                }}
                className="w-full px-4 py-3 text-left text-sm text-white hover:bg-[#2d2d3d] border-t border-[#2d2d3d]"
              >
                Gérer le groupe
              </button>
              {isGroupCreator ? (
                <button
                  type="button"
                  onClick={deleteActiveGroup}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d]"
                >
                  {t('dm.deleteGroup', { defaultValue: 'Supprimer le groupe' })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={leaveActiveGroup}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d]"
                >
                  {t('dm.leaveGroup', { defaultValue: 'Quitter le groupe' })}
                </button>
              )}
            </div>
          )}
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
                if (m.kind === 'system') {
                  return (
                    <div key={m.id} className="flex justify-center py-0.5">
                      <p className="text-[11px] leading-snug text-gray-500 text-center px-3 py-1.5 rounded-full bg-[#1a1a26]/80 border border-[#2d2d3d]/60 max-w-[min(100%,20rem)]">
                        {formatGroupSystemMessage(m, t)}
                      </p>
                    </div>
                  );
                }
                const isMe = m.senderId === user?.id;
                const menuOpen = openMsgMenuId === m.id;
                const senderLabel = m.senderName ?? senderNames.get(m.senderId) ?? 'Membre';
                const senderColorInfo = senderColors.get(m.senderId);
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
                          <UsernameDisplay
                            username={senderLabel}
                            usernameColor={senderColorInfo?.color}
                            usernameWaveFrom={senderColorInfo?.waveFrom}
                            usernameWaveTo={senderColorInfo?.waveTo}
                            as="p"
                            className="text-[10px] font-semibold mb-0.5"
                          />
                        )}
                        <LinkifiedText
                          text={m.content}
                          className="text-sm whitespace-pre-wrap break-words"
                          onOpenProfile={onOpenProfile}
                          onOpenSalon={onOpenSalon}
                          onOpenFeedPost={onOpenFeedPost}
                          onBeforeInternalLink={onBeforeInternalLink}
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
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-[#1a1a26] text-sm"
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
            className="dm-compose-bar shrink-0 flex gap-2 px-3 py-2 border-t border-[#1e1e2f] bg-[#12121a] items-center"
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
              {t('dm.send')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const showThreadPane = threadPanel != null;

  return (
    <div className="flex flex-1 min-h-0 h-full flex-col lg:flex-row bg-[#0b0b0f]">
      <aside
        className={`flex flex-col min-h-0 min-w-0 w-full lg:w-80 lg:max-w-[min(100%,22rem)] lg:shrink-0 lg:border-r border-[#1e1e2f] ${
          showThreadPane ? 'hidden lg:flex' : 'flex'
        }`}
      >
      <header className="shrink-0 border-b border-[#1e1e2f] min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 min-w-0">
          <h2 className="text-base font-bold text-white truncate min-w-0">
            {t('dm.title')}
          </h2>
          <button
            type="button"
            onClick={() => setShowNewDmSheet(true)}
            className="flex items-center justify-center w-11 h-11 bg-purple-600 hover:bg-purple-500 rounded-full text-white shrink-0"
            title={t('dm.newMessage')}
            aria-label={t('dm.newMessage')}
            aria-haspopup="dialog"
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (showMatchesOnly) toggleMatchesOnly();
            }}
            className={`flex items-center px-2.5 py-1.5 min-h-[36px] text-[11px] rounded-full border font-semibold whitespace-nowrap shrink-0 ${
              !showMatchesOnly
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-200'
                : 'border-[#2d2d3d] text-gray-400 hover:text-white hover:border-[#3d3d4d]'
            }`}
            aria-pressed={!showMatchesOnly}
          >
            {t('dm.allConversations', { defaultValue: 'Tous' })}
          </button>
          <button
            type="button"
            onClick={toggleMatchesOnly}
            className={`flex items-center px-2.5 py-1.5 min-h-[36px] text-[11px] rounded-full border font-semibold whitespace-nowrap shrink-0 ${
              showMatchesOnly
                ? 'bg-pink-600/20 border-pink-500/50 text-pink-300'
                : 'border-[#2d2d3d] text-gray-400 hover:text-white hover:border-[#3d3d4d]'
            }`}
            aria-pressed={showMatchesOnly}
          >
            ♥ Matchs
          </button>
          <button
            type="button"
            onClick={() => {
              loadBlocked();
              setBlockedSearch('');
              setView('blocked');
            }}
            className="flex items-center px-2.5 py-1.5 min-h-[36px] text-[11px] text-gray-400 border border-[#2d2d3d] rounded-full hover:text-white hover:border-[#3d3d4d] whitespace-nowrap shrink-0"
            title={t('dm.blocked')}
          >
            Bloqués
          </button>
        </div>
      </header>

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
                <UsernameDisplay
                  username={req.username}
                  usernameColor={req.usernameColor}
                  usernameWaveFrom={req.usernameWaveFrom}
                  usernameWaveTo={req.usernameWaveTo}
                  as="p"
                  className="text-sm font-semibold truncate"
                />
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

      {!loading && !showMatchesOnly && conversations.length === 0 && pendingRequests.length === 0 && (!activeSupportTicket || activeSupportTicket.status === 'resolved') && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-400 text-sm mb-4">Aucune conversation pour le moment</p>
          <button
            type="button"
            onClick={() => setShowNewDmSheet(true)}
            className="px-5 py-2.5 bg-purple-600 rounded-full font-bold text-white text-sm"
          >
            Envoyer un message privé
          </button>
        </div>
      )}

      {!loading && showMatchesOnly && displayedConversations.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-gray-400 text-sm mb-4">Aucun match pour le moment</p>
          <p className="text-gray-500 text-xs max-w-xs">
            Envoyez un cœur musical à quelqu&apos;un qui vous en envoie un pour créer un match.
          </p>
        </div>
      )}

      <ul className="flex-1 min-h-0 overflow-y-auto">
        {!loading && !showMatchesOnly && activeSupportTicket && activeSupportTicket.status !== 'resolved' && (
          <li key="support">
            <button
              type="button"
              onClick={() => openSupportThread(activeSupportTicket)}
              className={`w-full flex items-center gap-3 p-4 border-b border-[#1e1e2f]/50 text-left transition-colors ${
                view === 'supportThread'
                  ? 'bg-purple-900/20 border-l-2 border-l-purple-500'
                  : 'hover:bg-[#12121a]'
              }`}
            >
              <SupportAvatar size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="font-semibold text-white truncate">{t('dm.support.title')}</p>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {formatTime(getSupportLastTimestamp(activeSupportTicket))}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {getSupportLastPreview(activeSupportTicket)}
                </p>
              </div>
              {isSupportUnread(activeSupportTicket) && (
                <span
                  className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center"
                  aria-label={t('dm.support.unread')}
                >
                  1
                </span>
              )}
            </button>
          </li>
        )}
        {displayedConversations.map((c) => {
          const isGroup = isGroupConversation(c);
          const rowKey = isGroup ? c.groupId! : c.userId!;
          const isConvMenuOpen = !isGroup && c.userId ? conversationMenuOpen === c.userId : false;
          const isMuted = !isGroup && c.isMuted;
          const isActiveRow =
            (view === 'thread' && !isGroup && c.userId === activeUser?.id) ||
            (view === 'groupThread' && isGroup && c.groupId === activeGroup?.id);
          return (
            <li key={rowKey}>
              <div
                className={`relative flex items-center gap-3 p-4 border-b border-[#1e1e2f]/50 transition-colors ${
                  isActiveRow
                    ? 'bg-purple-900/20 border-l-2 border-l-purple-500'
                    : 'hover:bg-[#12121a]'
                }`}
              >
                {!isGroup && c.userId && onOpenProfile ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile(c.userId!);
                    }}
                    className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    title="Voir le profil"
                    aria-label={`Voir le profil de ${c.username}`}
                  >
                    <UserAvatarOnline
                      userId={c.userId}
                      avatarUrl={c.avatarUrl}
                      size="lg"
                      isOnline={c.isOnline ?? isOnline(c.userId)}
                      isLive={isLive(c.userId)}
                      liveViewersCount={liveViewersFor(c.userId)}
                    />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
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
                    c.userId &&
                    !onOpenProfile && (
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
                      {conversationListPrefix(c, isGroup)}
                      {isGroup ? groupConversationPreview(c, t) : c.lastMessage}
                    </p>
                  </div>
                </button>

                {/* Menu ··· sourdine par conversation (DM seulement) */}
                {!isGroup && c.userId && (
                  <div className="relative shrink-0" data-conv-menu>
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
                      <div
                        className="absolute right-0 top-full mt-1 z-30 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl shadow-xl overflow-hidden min-w-[14rem]"
                        data-conv-menu
                      >
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
                        <button
                          type="button"
                          disabled={blocking}
                          onClick={() => {
                            setConversationMenuOpen(null);
                            blockUsers([c.userId!], [c.username]);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d] disabled:opacity-50"
                        >
                          {blocking ? '...' : 'Bloquer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => hideConversationFromList(c.userId!, c.username)}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 border-t border-[#2d2d3d]"
                        >
                          Supprimer
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

      {showNewDmSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-dm-sheet-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewDmSheet(false); }}
        >
          <div className="w-full max-w-md bg-[#12121a] rounded-2xl ms-modal-panel border border-[#2d2d3d] max-h-[90dvh] flex flex-col shadow-2xl safe-area-pb">
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#1e1e2f]">
              <div className="min-w-0">
                <h2 id="new-dm-sheet-title" className="font-bold text-white text-base">
                  {t('dm.newConversation', { defaultValue: 'Nouvelle conversation' })}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {t('dm.newConversationHint', {
                    defaultValue: 'Sélectionnez un ou plusieurs utilisateurs',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewDmSheet(false)}
                className="text-sm text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              >
                {t('common.cancel', { defaultValue: 'Annuler' })}
              </button>
            </div>

            {newDmSelectedCount > 0 && (
              <div className="shrink-0 px-4 py-2.5 border-b border-[#1e1e2f]/50">
                <div className="flex flex-wrap gap-1.5">
                  {newDmSelectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-purple-900/30 border border-purple-500/40 text-xs text-purple-100"
                    >
                      <span className="truncate">{user.username}</span>
                      <button
                        type="button"
                        onClick={() => toggleNewDmUser(user)}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 text-purple-200"
                        aria-label={t('dm.removeSelectedUser', {
                          defaultValue: 'Retirer {{name}}',
                          name: user.username,
                        })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="shrink-0 px-4 py-3 border-b border-[#1e1e2f]/50">
              <div className="flex items-center gap-2 bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2 focus-within:border-purple-500/60">
                <svg
                  className="w-4 h-4 text-gray-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={newDmInputRef}
                  type="search"
                  value={newDmQuery}
                  onChange={(e) => setNewDmQuery(e.target.value)}
                  placeholder={t('dm.searchUsernamePlaceholder')}
                  autoComplete="off"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {newDmQuery && (
                  <button
                    type="button"
                    onClick={() => setNewDmQuery('')}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 text-xs"
                    aria-label="Effacer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {newDmSearching && newDmIsSearchMode && (
                <p className="text-center text-gray-500 text-sm py-6">Recherche…</p>
              )}

              {!newDmSearching && newDmRecentUsers.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Conversations récentes
                  </p>
                  <ul>
                    {newDmRecentUsers.map((user) => renderNewDmUserRow(user, 'recent'))}
                  </ul>
                </div>
              )}

              {!newDmSearching && newDmMatchUsers.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-pink-400/80">
                    Matchs musicaux
                  </p>
                  <ul>
                    {newDmMatchUsers.map((user) => renderNewDmUserRow(user, 'match', true))}
                  </ul>
                </div>
              )}

              {!newDmSearching && newDmFriendUsers.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Amis
                  </p>
                  <ul>
                    {newDmFriendUsers.map((user) => renderNewDmUserRow(user, 'contact'))}
                  </ul>
                </div>
              )}

              {!newDmSearching && newDmIsSearchMode && newDmSearchUsers.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Résultats
                  </p>
                  <ul>
                    {newDmSearchUsers.map((user) => renderNewDmUserRow(user, 'search'))}
                  </ul>
                </div>
              )}

              {!newDmSearching &&
                newDmRecentUsers.length === 0 &&
                newDmMatchUsers.length === 0 &&
                newDmFriendUsers.length === 0 &&
                (!newDmIsSearchMode || newDmSearchUsers.length === 0) && (
                  <p className="text-center text-gray-500 text-sm py-6 px-4">
                    {newDmIsSearchMode
                      ? `Aucun utilisateur trouvé pour « ${newDmQueryTrimmed} »`
                      : 'Aucun ami pour le moment — recherchez un utilisateur pour démarrer une conversation'}
                  </p>
                )}
            </div>

            <div className="shrink-0 border-t border-[#1e1e2f] p-3 space-y-2 bg-[#12121a] safe-area-pb">
              {newDmSelectedCount >= 2 && (
                <input
                  type="text"
                  value={newDmGroupName}
                  onChange={(e) => setNewDmGroupName(e.target.value)}
                  placeholder={t('dm.groupNameOptional', {
                    defaultValue: 'Nom du groupe (optionnel)',
                  })}
                  maxLength={60}
                  className="w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-500/60"
                />
              )}
              <button
                type="button"
                onClick={() => void confirmNewDmSelection()}
                disabled={newDmSelectedCount === 0 || newDmCreating}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-sm font-bold text-white"
              >
                {newDmCreating
                  ? t('common.loading', { defaultValue: 'Chargement…' })
                  : newDmSelectedCount === 0
                    ? t('dm.selectUsersToContinue', {
                        defaultValue: 'Sélectionnez des utilisateurs',
                      })
                    : newDmSelectedCount === 1
                      ? t('dm.startPrivateMessage', { defaultValue: 'Message privé' })
                      : t('dm.createGroupWithCount', {
                          defaultValue: 'Créer le groupe ({{count}})',
                          count: newDmSelectedCount,
                        })}
              </button>
            </div>
          </div>
        </div>
      )}

      </aside>

      <section
        className={`flex flex-col flex-1 min-h-0 min-w-0 ${
          showThreadPane ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {threadPanel ?? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#0b0b0f]">
            <div className="w-16 h-16 rounded-full bg-[#1a1a26] border border-[#2d2d3d] flex items-center justify-center text-2xl mb-4" aria-hidden>
              💬
            </div>
            <p className="text-gray-400 text-sm max-w-xs">
              {t('dm.selectConversation', { defaultValue: 'Sélectionnez une conversation pour afficher les messages' })}
            </p>
          </div>
        )}
      </section>

      {renderCreateSalonModal()}
      {renderGroupRenameModal()}
      {renderGroupDeleteModal()}
      {renderConfirmModal()}
    </div>
  );
}
