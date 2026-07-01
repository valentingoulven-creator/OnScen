import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { api } from '../lib/api';
import { ACCEPTED_IMAGE_FORMATS, validateImageFile, resizeImageInstagram } from '../lib/imageUtils';
import {
  DON_AMOUNT_MAX,
  DON_AMOUNT_MIN,
  GIFT_EMOJI,
  GIFT_LABELS_FR,
  LIVE_DON_TIERS,
  LIVE_REACTION_TYPES,
  appendLiveReaction,
  donAmountValidationMessage,
  giftToReaction,
  giftsToReactions,
  parseDonAmount,
  reactionSummary,
} from '../lib/liveReactions';
import { getSocket, isSocketConnected } from '../lib/socket';
import type { ChatMessage, LiveChatReaction } from '../types';
import { LiveUserBanModal, type LiveBanScope } from './LiveUserBanModal';
import { SalonUserBanModal } from './SalonUserBanModal';
import { ReportContentModal, type ReportContentContext } from './ReportContentModal';
import { ConfirmModal } from './ConfirmModal';
import { UsernameDisplay } from './UsernameDisplay';
import { UserDevBadge } from './UserDevBadge';

export interface ChatPanelProps {
  roomId: string;
  roomType: 'salon' | 'live';
  userId: string;
  userName: string;
  token?: string;
  initialMessages?: ChatMessage[];
  onPrivateMessage?: (target: { id: string; name: string }) => void;
  isHost?: boolean;
  canModerateChat?: boolean;
  /** Compte Dev (soundy_dev) : modération étendue (hôte, VIP). */
  isDevModerator?: boolean;
  hostId?: string;
  vipModeratorIds?: string[];
  onSetVip?: (userId: string, add: boolean) => void;
  onBanUser?: (userId: string, opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => void;
  onViewProfile?: (userId: string) => void;
  chatBanned?: boolean;
  chatBanMessage?: string;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  /** Ouvre le flux de pourboire sécurisé (live uniquement) */
  onOpenDonation?: (amount?: number) => void;
  /** Pièces jointes dans la barre de saisie (désactivé en salon par défaut) */
  allowAttachments?: boolean;
}

type FeedItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'reaction'; data: LiveChatReaction };

interface ChatRoomContextValue {
  roomType: 'salon' | 'live';
  roomId: string;
  userId: string;
  feed: FeedItem[];
  onPrivateMessage?: (target: { id: string; name: string }) => void;
  isHost: boolean;
  canModerateChat: boolean;
  isDevModerator: boolean;
  hostId?: string;
  vipModeratorIds: string[];
  onSetVip?: (userId: string, add: boolean) => void;
  onBanUser?: (userId: string, opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => void;
  onViewProfile?: (userId: string) => void;
  token?: string;
  chatBanned: boolean;
  chatBanMessage?: string;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  openMsgMenuId: string | null;
  setOpenMsgMenuId: (id: string | null | ((prev: string | null) => string | null)) => void;
  msgMenuAnchor: DOMRect | null;
  setMsgMenuAnchor: (anchor: DOMRect | null) => void;
  userMenuTarget: { id: string; name: string } | null;
  setUserMenuTarget: (target: { id: string; name: string } | null | ((prev: { id: string; name: string } | null) => { id: string; name: string } | null)) => void;
  userMenuAnchor: DOMRect | null;
  setUserMenuAnchor: (anchor: DOMRect | null) => void;
  setBanModalTarget: (target: { id: string; name: string } | null) => void;
  setReportContext: (ctx: ReportContentContext | null) => void;
  deleteMessage: (messageId: string, asModerator?: boolean) => void;
  confirmDeleteMessage: { id: string; asModerator: boolean } | null;
  performDeleteMessage: () => Promise<void>;
  setConfirmDeleteMessage: (value: { id: string; asModerator: boolean } | null) => void;
  openUserMenu: (target: { id: string; name: string }, anchor: DOMRect) => void;
  toggleMsgMenu: (messageId: string, anchor: DOMRect) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  text: string;
  setText: (value: string) => void;
  send: (e: React.FormEvent) => void;
  pendingAttachment: { dataUrl: string; name: string; mimeType: string; size: number } | null;
  setPendingAttachment: (att: { dataUrl: string; name: string; mimeType: string; size: number } | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (file: File) => void;
  liveReactionsEnabled: boolean;
  reactionMenuOpen: boolean;
  setReactionMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  reactionMenuRef: React.RefObject<HTMLDivElement | null>;
  reactionSending: boolean;
  sendReaction: (giftType: string, amount?: number) => Promise<void>;
  donCustomAmount: string;
  setDonCustomAmount: (value: string) => void;
  sendError: string | null;
  reactionError: string | null;
  setReactionError: (error: string | null) => void;
  messageSending: boolean;
  onOpenDonation?: (amount?: number) => void;
  allowAttachments: boolean;
  banModalTarget: { id: string; name: string } | null;
  reportContext: ReportContentContext | null;
  onUserBlocked: (userId: string) => void;
  confirmBan: (opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => void;
}

const CHAT_MENU_BTN =
  'block w-full px-4 py-2.5 text-left text-sm whitespace-normal leading-snug';

function clampChatMenuPosition(
  anchor: DOMRect,
  menuWidth: number,
  menuHeight: number,
  align: 'left' | 'right'
): { top: number; left: number } {
  const pad = 8;
  const gap = 4;
  let left = align === 'right' ? anchor.right - menuWidth : anchor.left;
  left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad));
  let top = anchor.bottom + gap;
  if (top + menuHeight > window.innerHeight - pad) {
    top = anchor.top - menuHeight - gap;
  }
  top = Math.max(pad, top);
  return { top, left };
}

function ChatContextMenu({
  open,
  anchor,
  align,
  menuRef,
  onClose,
  children,
}: {
  open: boolean;
  anchor: DOMRect | null;
  align: 'left' | 'right';
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const update = () => {
      const menuEl = menuRef.current;
      const w = menuEl?.offsetWidth ?? 168;
      const h = menuEl?.offsetHeight ?? 80;
      setPos(clampChatMenuPosition(anchor, w, h, align));
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchor, align, menuRef, children]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onClose, menuRef]);

  if (!open || !anchor || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] flex flex-col min-w-[10.5rem] max-w-[min(16rem,calc(100vw-1rem))] rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-xl py-1"
      style={{
        top: pos?.top ?? anchor.bottom + 4,
        left: pos?.left ?? anchor.left,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

const ChatRoomContext = createContext<ChatRoomContextValue | null>(null);

function useChatRoomContext() {
  const ctx = useContext(ChatRoomContext);
  if (!ctx) throw new Error('ChatRoom components must be used within ChatRoomProvider');
  return ctx;
}

function useChatRoom({
  roomId,
  roomType,
  userId,
  userName,
  token,
  initialMessages = [],
  onPrivateMessage,
  isHost = false,
  canModerateChat = false,
  isDevModerator = false,
  hostId,
  vipModeratorIds = [],
  onSetVip,
  onBanUser,
  onViewProfile,
  chatBanned = false,
  chatBanMessage,
  onDeleteMessage,
  onOpenDonation,
  allowAttachments: allowAttachmentsProp,
}: ChatPanelProps): ChatRoomContextValue {
  const allowAttachments = allowAttachmentsProp ?? roomType !== 'salon';
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<LiveChatReaction[]>([]);
  const [text, setText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ dataUrl: string; name: string; mimeType: string; size: number } | null>(null);
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [msgMenuAnchor, setMsgMenuAnchor] = useState<DOMRect | null>(null);
  const [userMenuTarget, setUserMenuTarget] = useState<{ id: string; name: string } | null>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<DOMRect | null>(null);
  const [banModalTarget, setBanModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportContext, setReportContext] = useState<ReportContentContext | null>(null);
  const [blockedPeerIds, setBlockedPeerIds] = useState<Set<string>>(() => new Set());
  const blockedPeerIdsRef = useRef<Set<string>>(new Set());
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [donCustomAmount, setDonCustomAmount] = useState('');
  const [reactionSending, setReactionSending] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<{ id: string; asModerator: boolean } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reactionMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const liveReactionsEnabled = roomType === 'live' && Boolean(token);
  const boundRoomIdRef = useRef<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!allowAttachments) return;
    if (file.type.startsWith('image/')) {
      const imgError = validateImageFile(file);
      if (imgError) {
        alert(imgError);
        return;
      }
      resizeImageInstagram(file)
        .then((dataUrl) => {
          setPendingAttachment({ dataUrl, name: file.name, mimeType: 'image/jpeg', size: file.size });
        })
        .catch((err: unknown) => {
          alert(err instanceof Error ? err.message : "Impossible de traiter l'image");
        });
      return;
    }
    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
      alert('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPendingAttachment({ dataUrl, name: file.name, mimeType: file.type, size: file.size });
    };
    reader.readAsDataURL(file);
  }, [allowAttachments]);

  useEffect(() => {
    if (!token) {
      blockedPeerIdsRef.current = new Set();
      setBlockedPeerIds(new Set());
      return;
    }
    let cancelled = false;
    api.getBlockedUsers(token).then((r) => {
      if (cancelled) return;
      const next = new Set(r.blocked.map((b) => b.id));
      blockedPeerIdsRef.current = next;
      setBlockedPeerIds(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (boundRoomIdRef.current === roomId) return;
    boundRoomIdRef.current = roomId;
    setMessages(initialMessages);
    setReactions([]);
    setOpenMsgMenuId(null);
  }, [roomId, initialMessages]);

  useEffect(() => {
    if (blockedPeerIds.size === 0) return;
    setMessages((m) => m.filter((msg) => !blockedPeerIds.has(msg.senderId)));
    setReactions((r) => r.filter((rx) => !rx.senderId || !blockedPeerIds.has(rx.senderId)));
  }, [blockedPeerIds]);

  useEffect(() => {
    if (!liveReactionsEnabled || !token) return;
    let cancelled = false;
    api.getLiveGifts(token, roomId).then((r) => {
      if (!cancelled) setReactions(giftsToReactions(r.gifts));
    });
    return () => {
      cancelled = true;
    };
  }, [liveReactionsEnabled, token, roomId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const event = roomType === 'salon' ? 'salon_message' : 'live_message';
    const deletedEvent = roomType === 'salon' ? 'salon_message_deleted' : 'live_message_deleted';

    const handler = (msg: ChatMessage) => {
      if (msg.roomId !== roomId) return;
      if (blockedPeerIdsRef.current.has(msg.senderId)) return;
      setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
    };

    const onDeleted = (payload: { roomId: string; messageId: string }) => {
      if (payload.roomId !== roomId) return;
      setMessages((m) => m.filter((x) => x.id !== payload.messageId));
      setOpenMsgMenuId((id) => (id === payload.messageId ? null : id));
    };

    const onGiftAnimation = (gift: {
      liveId: string;
      id: string;
      senderId?: string;
      senderName: string;
      giftType: string;
      amount?: number;
      timestamp: number;
    }) => {
      if (gift.liveId !== roomId) return;
      if (gift.senderId && blockedPeerIdsRef.current.has(gift.senderId)) return;
      setReactions((prev) => appendLiveReaction(prev, giftToReaction(gift)));
    };

    const onConnect = () => setSendError(null);

    const onAttachmentDenied = (payload: {
      roomType: 'salon' | 'live';
      roomId: string;
      reason: string;
      message: string;
    }) => {
      if (payload.roomType !== roomType || payload.roomId !== roomId) return;
      setSendError(payload.message);
    };

    socket.on(event, handler);
    socket.on(deletedEvent, onDeleted);
    socket.on('connect', onConnect);
    socket.on('chat_attachment_denied', onAttachmentDenied);
    if (liveReactionsEnabled) socket.on('gift_animation', onGiftAnimation);

    return () => {
      socket.off(event, handler);
      socket.off(deletedEvent, onDeleted);
      socket.off('connect', onConnect);
      socket.off('chat_attachment_denied', onAttachmentDenied);
      if (liveReactionsEnabled) socket.off('gift_animation', onGiftAnimation);
    };
  }, [roomType, roomId, liveReactionsEnabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reactions]);

  useEffect(() => {
    if (!reactionMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (reactionMenuRef.current?.contains(e.target as Node)) return;
      setReactionMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [reactionMenuOpen]);

  const feed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = messages
      .filter((m) => !blockedPeerIds.has(m.senderId))
      .map((m) => ({ kind: 'message', data: m }));
    if (liveReactionsEnabled) {
      for (const r of reactions) {
        if (r.senderId && blockedPeerIds.has(r.senderId)) continue;
        items.push({ kind: 'reaction', data: r });
      }
    }
    return items.sort((a, b) => {
      const ta = a.kind === 'message' ? a.data.timestamp : a.data.timestamp;
      const tb = b.kind === 'message' ? b.data.timestamp : b.data.timestamp;
      return ta - tb;
    });
  }, [messages, reactions, liveReactionsEnabled, blockedPeerIds]);

  const deleteMessage = (messageId: string, asModerator = false) => {
    setConfirmDeleteMessage({ id: messageId, asModerator });
    setOpenMsgMenuId(null);
    setMsgMenuAnchor(null);
  };

  const performDeleteMessage = async () => {
    if (!token || !confirmDeleteMessage) return;
    const { id: messageId } = confirmDeleteMessage;
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(messageId);
      } else {
        await api.deleteChatMessage(token, roomType, roomId, messageId);
      }
      setMessages((m) => m.filter((x) => x.id !== messageId));
      setConfirmDeleteMessage(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de supprimer');
    }
  };

  const sendReaction = async (giftType: string, amount?: number) => {
    if (!token || reactionSending) return;
    setReactionError(null);
    setReactionSending(true);
    try {
      await api.sendGift(token, roomId, giftType, amount);
      if (giftType === 'don') setDonCustomAmount('');
      setReactionMenuOpen(false);
    } catch (e) {
      setReactionError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setReactionSending(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = text.trim().length > 0;
    const hasAttachment = allowAttachments && Boolean(pendingAttachment);
    if ((!hasText && !hasAttachment) || chatBanned || messageSending) return;
    const socket = getSocket();
    if (!socket || !isSocketConnected()) {
      setSendError('Connexion au chat en cours… Patientez puis réessayez.');
      return;
    }
    setSendError(null);
    setMessageSending(true);
    const content = text.trim();
    const attachment = hasAttachment ? pendingAttachment : null;
    try {
      let attachmentFields: {
        attachmentUrl: string;
        attachmentName: string;
        attachmentSize: number;
        attachmentMimeType: string;
      } | undefined;
      if (attachment && token) {
        const uploaded = await api.uploadChatAttachment(token, attachment.dataUrl, attachment.name);
        attachmentFields = {
          attachmentUrl: uploaded.attachmentUrl,
          attachmentName: uploaded.attachmentName || attachment.name,
          attachmentSize: uploaded.attachmentSize,
          attachmentMimeType: uploaded.attachmentMimeType,
        };
      }
      const payload = {
        salonId: roomId,
        liveId: roomId,
        senderId: userId,
        senderName: userName,
        content,
        ...(attachmentFields ?? {}),
      };
      if (roomType === 'salon') socket.emit('salon_message', payload);
      else socket.emit('live_message', payload);
      setText('');
      setPendingAttachment(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Impossible d'envoyer la pièce jointe");
    } finally {
      window.setTimeout(() => setMessageSending(false), 400);
    }
  };

  const openUserMenu = useCallback((target: { id: string; name: string }, anchor: DOMRect) => {
    if (target.id === userId) return;
    setOpenMsgMenuId(null);
    setMsgMenuAnchor(null);
    setUserMenuTarget((prev) => {
      const next = prev?.id === target.id ? null : target;
      setUserMenuAnchor(next ? anchor : null);
      return next;
    });
  }, [userId]);

  const toggleMsgMenu = useCallback((messageId: string, anchor: DOMRect) => {
    setUserMenuTarget(null);
    setUserMenuAnchor(null);
    setOpenMsgMenuId((id) => {
      const next = id === messageId ? null : messageId;
      setMsgMenuAnchor(next ? anchor : null);
      return next;
    });
  }, []);

  const confirmBan = (opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => {
    if (!banModalTarget || !onBanUser) return;
    onBanUser(banModalTarget.id, opts);
    setBanModalTarget(null);
    setUserMenuTarget(null);
    setUserMenuAnchor(null);
  };

  const onUserBlocked = useCallback((userId: string) => {
    setBlockedPeerIds((prev) => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      blockedPeerIdsRef.current = next;
      return next;
    });
  }, []);

  return {
    roomType,
    roomId,
    userId,
    feed,
    onPrivateMessage,
    isHost,
    canModerateChat,
    isDevModerator,
    hostId,
    vipModeratorIds,
    onSetVip,
    onBanUser,
    onViewProfile,
    token,
    chatBanned,
    chatBanMessage,
    onDeleteMessage,
    openMsgMenuId,
    setOpenMsgMenuId,
    msgMenuAnchor,
    setMsgMenuAnchor,
    userMenuTarget,
    setUserMenuTarget,
    userMenuAnchor,
    setUserMenuAnchor,
    setBanModalTarget,
    setReportContext,
    deleteMessage,
    confirmDeleteMessage,
    performDeleteMessage,
    setConfirmDeleteMessage,
    openUserMenu,
    toggleMsgMenu,
    bottomRef,
    text,
    setText,
    send,
    pendingAttachment,
    setPendingAttachment,
    fileInputRef,
    handleFileSelect,
    liveReactionsEnabled,
    reactionMenuOpen,
    setReactionMenuOpen,
    reactionMenuRef,
    reactionSending,
    sendReaction,
    donCustomAmount,
    setDonCustomAmount,
    sendError,
    reactionError,
    setReactionError,
    messageSending,
    onOpenDonation,
    allowAttachments,
    banModalTarget,
    reportContext,
    onUserBlocked,
    confirmBan,
  };
}

export function ChatRoomProvider({ children, ...props }: ChatPanelProps & { children: ReactNode }) {
  const value = useChatRoom(props);
  return <ChatRoomContext.Provider value={value}>{children}</ChatRoomContext.Provider>;
}

export function ChatMessagesView() {
  const {
    roomType,
    roomId,
    userId,
    feed,
    onPrivateMessage,
    isHost,
    canModerateChat,
    isDevModerator,
    hostId,
    vipModeratorIds,
    onSetVip,
    onBanUser,
    onViewProfile,
    token,
    onDeleteMessage,
    openMsgMenuId,
    setOpenMsgMenuId,
    msgMenuAnchor,
    setMsgMenuAnchor,
    userMenuTarget,
    setUserMenuTarget,
    userMenuAnchor,
    setUserMenuAnchor,
    setBanModalTarget,
    setReportContext,
    deleteMessage,
    openUserMenu,
    toggleMsgMenu,
    bottomRef,
    chatBanned,
    chatBanMessage,
  } = useChatRoomContext();

  const msgMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const openMsg = useMemo(() => {
    if (!openMsgMenuId) return null;
    const item = feed.find((x) => x.kind === 'message' && x.data.id === openMsgMenuId);
    return item?.kind === 'message' ? item.data : null;
  }, [feed, openMsgMenuId]);

  const closeMsgMenu = useCallback(() => {
    setOpenMsgMenuId(null);
    setMsgMenuAnchor(null);
  }, [setOpenMsgMenuId, setMsgMenuAnchor]);

  const closeUserMenu = useCallback(() => {
    setUserMenuTarget(null);
    setUserMenuAnchor(null);
  }, [setUserMenuTarget, setUserMenuAnchor]);

  const openUserIsTargetVip = userMenuTarget ? vipModeratorIds.includes(userMenuTarget.id) : false;
  const openUserIsTargetHost = userMenuTarget != null && hostId != null && userMenuTarget.id === hostId;
  const openUserCanBan =
    (isHost || canModerateChat) &&
    userMenuTarget != null &&
    Boolean(onBanUser) &&
    (isDevModerator || (!openUserIsTargetHost && (isHost || !openUserIsTargetVip)));
  const openUserCanHostVip =
    roomType === 'live' &&
    (isHost || isDevModerator) &&
    userMenuTarget != null &&
    !openUserIsTargetHost &&
    Boolean(onSetVip);
  const openMsgCanDeleteAsMod = (isHost || canModerateChat) && Boolean(onDeleteMessage ?? token);

  return (
    <>
      <div
        className={`chat-messages-scroll flex-1 min-h-0 h-0 overflow-y-auto space-y-3 ${
          roomType === 'live' ? 'live-chat-messages p-2' : 'p-3'
        }`}
      >
        {feed.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-6">
            Chat public — dites bonjour à la salle !
            {onPrivateMessage && (
              <span className="block mt-1 text-xs text-gray-600">
                Touchez un pseudo pour les options (MP, profil…)
              </span>
            )}
          </p>
        )}

        {feed.map((item) => {
          if (item.kind === 'reaction') {
            const r = item.data;
            const emoji = GIFT_EMOJI[r.giftType] ?? '✨';
            const count = r.count ?? 1;
            return (
              <div key={`reaction-${r.id}-${r.timestamp}`} className="flex justify-center">
                <div className="inline-flex items-center gap-2 max-w-[95%] rounded-full px-3 py-1.5 bg-[#141420]/90 border border-white/8 text-xs">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-base leading-none"
                    aria-hidden
                  >
                    {emoji}
                  </span>
                  <span className="text-gray-300 min-w-0 truncate">
                    <span className="font-semibold text-[#8b8baf]">{r.senderName}</span>{' '}
                    {reactionSummary(r)}
                    {count > 1 && <span className="text-[#7878a0] font-semibold ml-1">×{count}</span>}
                  </span>
                </div>
              </div>
            );
          }

          const m = item.data;
          const isMe = m.senderId === userId;
          const canMod = isHost || canModerateChat;
          const canInteractUser =
            !isMe &&
            (onPrivateMessage ||
              onViewProfile ||
              ((isHost || isDevModerator) && onSetVip && roomType === 'live') ||
              (canMod && onBanUser));
          const isTargetVip = vipModeratorIds.includes(m.senderId);
          const isTargetDev = m.senderIsDev === true;
          const canDeleteOwn = roomType !== 'live' && isMe && Boolean(token);
          const canDeleteAsMod = canMod && Boolean(onDeleteMessage ?? token);
          const canDelete = canDeleteOwn || canDeleteAsMod;
          const menuOpen = openMsgMenuId === m.id;

          return (
            <div key={m.id} className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
              <div
                className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  isMe ? 'bg-[#1d1d2e] border border-[#2e2e42]' : 'bg-[#131318] border border-[#1e1e2a]'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {canInteractUser ? (
                    <button
                      type="button"
                      onClick={(e) =>
                        openUserMenu({ id: m.senderId, name: m.senderName }, e.currentTarget.getBoundingClientRect())
                      }
                      className="text-xs font-semibold text-[#8b8baf] hover:text-[#a5a5c5] text-left inline-flex items-center gap-1 min-w-0"
                      title="Options utilisateur"
                    >
                      <UsernameDisplay
                        username={m.senderName}
                        usernameColor={m.senderUsernameColor}
                        usernameWaveFrom={m.senderUsernameWaveFrom}
                        usernameWaveTo={m.senderUsernameWaveTo}
                        className="truncate"
                      />
                      {isTargetDev && <UserDevBadge className="ml-1" />}
                      {isTargetVip && <span className="ml-1 text-amber-400/80 font-semibold shrink-0">VIP</span>}
                    </button>
                  ) : (
                    <p className="text-xs font-semibold text-[#8b8baf] inline-flex items-center gap-1 min-w-0">
                      <UsernameDisplay
                        username={m.senderName}
                        usernameColor={m.senderUsernameColor}
                        usernameWaveFrom={m.senderUsernameWaveFrom}
                        usernameWaveTo={m.senderUsernameWaveTo}
                        className="truncate"
                      />
                      {isTargetDev && <UserDevBadge className="ml-1" />}
                      {isTargetVip && <span className="ml-1 text-amber-400/80 font-semibold shrink-0">VIP</span>}
                    </p>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => toggleMsgMenu(m.id, e.currentTarget.getBoundingClientRect())}
                      className="ml-auto text-gray-500 hover:text-white text-xs px-1"
                      aria-label="Options du message"
                      aria-expanded={menuOpen}
                    >
                      ⋮
                    </button>
                  )}
                </div>
                {m.content ? <p className="text-gray-200 whitespace-pre-wrap break-words">{m.content}</p> : null}
                {m.attachmentUrl && (
                  <div className={m.content ? 'mt-1' : ''}>
                    {m.attachmentMimeType?.startsWith('image/') ? (
                      <img
                        src={m.attachmentUrl}
                        alt={m.attachmentName ?? 'Image'}
                        className="max-w-full rounded-xl max-h-48 object-cover"
                      />
                    ) : (
                      <a
                        href={m.attachmentUrl}
                        download={m.attachmentName ?? 'fichier'}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[#0e0e16] border border-[#2d2d3d] hover:border-purple-500/40 text-xs text-gray-200"
                      >
                        <span className="text-base shrink-0">📎</span>
                        <span className="truncate max-w-[140px]">{m.attachmentName ?? 'Fichier'}</span>
                        <span className="ml-auto shrink-0 text-gray-500">⬇</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {userMenuTarget && userMenuAnchor && (
        <ChatContextMenu
          open
          anchor={userMenuAnchor}
          align="left"
          menuRef={userMenuRef}
          onClose={closeUserMenu}
        >
          {onPrivateMessage && (
            <button
              type="button"
              onClick={() => {
                onPrivateMessage({ id: userMenuTarget.id, name: userMenuTarget.name });
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-gray-200 hover:bg-white/5`}
            >
              Message privé
            </button>
          )}
          {onViewProfile && (
            <button
              type="button"
              onClick={() => {
                onViewProfile(userMenuTarget.id);
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-gray-200 hover:bg-white/5`}
            >
              Voir le profil
            </button>
          )}
          {openUserCanHostVip && onSetVip && !openUserIsTargetVip && (
            <button
              type="button"
              onClick={() => {
                onSetVip(userMenuTarget.id, true);
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-amber-300 hover:bg-amber-500/10`}
            >
              Mettre VIP
            </button>
          )}
          {openUserCanHostVip && onSetVip && openUserIsTargetVip && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Retirer le statut VIP de ${userMenuTarget.name} ?`)) return;
                onSetVip(userMenuTarget.id, false);
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-amber-400/70 hover:bg-amber-500/10`}
            >
              Retirer VIP
            </button>
          )}
          {openUserCanBan && (
            <button
              type="button"
              onClick={() => {
                setBanModalTarget({ id: userMenuTarget.id, name: userMenuTarget.name });
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-red-400 hover:bg-red-500/10`}
            >
              Bannir
            </button>
          )}
          {userMenuTarget.id !== userId && (
            <button
              type="button"
              onClick={() => {
                setReportContext({
                  targetUserId: userMenuTarget.id,
                  targetUsername: userMenuTarget.name,
                  roomType,
                  roomId,
                });
                closeUserMenu();
              }}
              className={`${CHAT_MENU_BTN} text-red-400/90 hover:bg-red-500/10`}
            >
              Signaler
            </button>
          )}
        </ChatContextMenu>
      )}

      {openMsg && msgMenuAnchor && (
        <ChatContextMenu
          open
          anchor={msgMenuAnchor}
          align="right"
          menuRef={msgMenuRef}
          onClose={closeMsgMenu}
        >
          {openMsg.senderId !== userId && (
            <button
              type="button"
              onClick={() => {
                setReportContext({
                  targetUserId: openMsg.senderId,
                  targetUsername: openMsg.senderName,
                  roomType,
                  roomId,
                  messageId: openMsg.id,
                });
                closeMsgMenu();
              }}
              className={`${CHAT_MENU_BTN} text-red-400/90 hover:bg-red-500/10`}
            >
              Signaler
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteMessage(openMsg.id, openMsgCanDeleteAsMod)}
            className={`${CHAT_MENU_BTN} text-red-400 hover:bg-red-500/10`}
          >
            {openMsgCanDeleteAsMod ? 'Supprimer le message' : 'Supprimer'}
          </button>
        </ChatContextMenu>
      )}

      {chatBanned && chatBanMessage && (
        <p className="shrink-0 px-3 py-2 text-xs text-red-400 text-center border-t border-red-500/20 bg-red-950/20" role="alert">
          {chatBanMessage}
        </p>
      )}
    </>
  );
}

export function ChatInputBar({ className }: { className?: string }) {
  const {
    chatBanned,
    text,
    setText,
    send,
    pendingAttachment,
    setPendingAttachment,
    fileInputRef,
    handleFileSelect,
    liveReactionsEnabled,
    reactionMenuOpen,
    setReactionMenuOpen,
    reactionMenuRef,
    reactionSending,
    sendReaction,
    donCustomAmount,
    setDonCustomAmount,
    setReactionError,
    onOpenDonation,
    allowAttachments,
    sendError,
    reactionError,
    messageSending,
  } = useChatRoomContext();

  return (
    <div className={className}>
      {allowAttachments && pendingAttachment && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0e0e16] border-t border-[#1e1e2f]">
          {pendingAttachment.mimeType.startsWith('image/') ? (
            <img src={pendingAttachment.dataUrl} alt={pendingAttachment.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-purple-900/30 border border-purple-500/30 flex items-center justify-center shrink-0 text-sm">📎</div>
          )}
          <p className="flex-1 text-xs text-white truncate">{pendingAttachment.name}</p>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white text-xs rounded-full hover:bg-white/10"
            aria-label="Retirer la pièce jointe"
          >✕</button>
        </div>
      )}
      {allowAttachments && (
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
      )}
      <form
        onSubmit={send}
        className="border-t border-b border-[#1e1e2f] flex gap-2 items-center p-3 bg-[#0b0b0f]/95 backdrop-blur-sm"
      >
        {liveReactionsEnabled && (
          <div className="relative shrink-0" ref={reactionMenuRef}>
            <button
              type="button"
              onClick={() => setReactionMenuOpen((o) => !o)}
              disabled={reactionSending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#131318] border border-[#1e1e2a] text-lg text-gray-400 hover:border-white/20 hover:text-white transition disabled:opacity-50"
              aria-label="Réactions live"
              aria-expanded={reactionMenuOpen}
            >
              +
            </button>
            {reactionMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-30 w-[11.5rem] rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-xl overflow-hidden">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Réactions live
                </p>
                <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                  {LIVE_REACTION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={reactionSending}
                      onClick={() => sendReaction(type)}
                      className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-left text-xs text-gray-200 hover:bg-white/6 disabled:opacity-50"
                    >
                      <span className="text-base leading-none">{GIFT_EMOJI[type]}</span>
                      <span>{GIFT_LABELS_FR[type]}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#2d2d3d] px-2 py-2">
                  <p className="text-[10px] font-bold text-pink-300/90 mb-1.5 px-1">Pourboire</p>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {LIVE_DON_TIERS.map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        disabled={!onOpenDonation}
                        onClick={() => {
                          setReactionMenuOpen(false);
                          onOpenDonation?.(tier);
                        }}
                        className="py-1.5 rounded-lg text-[10px] font-bold text-pink-200 bg-pink-950/40 border border-pink-500/30 hover:border-pink-400 disabled:opacity-50"
                      >
                        {tier} €
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-pink-300/80 mb-1 px-1">Montant libre</p>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={DON_AMOUNT_MIN}
                      max={DON_AMOUNT_MAX}
                      step={1}
                      inputMode="numeric"
                      value={donCustomAmount}
                      onChange={(e) => setDonCustomAmount(e.target.value)}
                      placeholder="€"
                      disabled={!onOpenDonation}
                      className="flex-1 min-w-0 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-2 py-1.5 text-[11px] text-white placeholder:text-gray-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={!onOpenDonation}
                      onClick={() => {
                        const amount = parseDonAmount(donCustomAmount);
                        if (amount == null) {
                          setReactionError(donAmountValidationMessage());
                          return;
                        }
                        setReactionMenuOpen(false);
                        onOpenDonation?.(amount);
                      }}
                      className="shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-bold text-white bg-pink-600 hover:bg-pink-500 disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={chatBanned ? 'Chat indisponible' : 'Message public...'}
          disabled={chatBanned}
          className="flex-1 min-w-0 bg-[#0e0e16] border border-[#1e1e2a] rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#3a3a5a]"
        />
        <button
          type="submit"
          disabled={chatBanned || messageSending}
          className="shrink-0 px-4 py-2 bg-[#3a3a5e] hover:bg-[#48487a] rounded-full text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          →
        </button>
      </form>
      {(sendError || reactionError) && (
        <p className="text-[10px] text-red-400 text-center px-3 pb-2" role="alert">
          {sendError ?? reactionError}
        </p>
      )}
    </div>
  );
}

export function ChatModals() {
  const {
    roomType,
    banModalTarget,
    onBanUser,
    confirmBan,
    reportContext,
    onUserBlocked,
    setBanModalTarget,
    setReportContext,
    confirmDeleteMessage,
    performDeleteMessage,
    setConfirmDeleteMessage,
  } = useChatRoomContext();

  return (
    <>
      {banModalTarget && onBanUser && roomType === 'salon' ? (
        <SalonUserBanModal
          username={banModalTarget.name}
          open
          onClose={() => setBanModalTarget(null)}
          onConfirm={(opts) => confirmBan({ ...opts, scope: 'live' })}
        />
      ) : null}
      {banModalTarget && onBanUser && roomType === 'live' ? (
        <LiveUserBanModal
          username={banModalTarget.name}
          open
          onClose={() => setBanModalTarget(null)}
          onConfirm={confirmBan}
        />
      ) : null}
      {reportContext && (
        <ReportContentModal
          context={reportContext}
          onClose={() => setReportContext(null)}
          onUserBlocked={onUserBlocked}
        />
      )}
      <ConfirmModal
        open={confirmDeleteMessage !== null}
        title="Supprimer ce message ?"
        description={
          confirmDeleteMessage?.asModerator
            ? 'Le message sera retiré du chat public pour tous les participants.'
            : 'Cette action est définitive.'
        }
        onCancel={() => setConfirmDeleteMessage(null)}
        onConfirm={() => void performDeleteMessage()}
      />
    </>
  );
}

export function ChatPanel(props: ChatPanelProps) {
  return (
    <ChatRoomProvider {...props}>
      <div className="flex flex-col h-full min-h-0">
        <ChatMessagesView />
        <ChatInputBar />
        <ChatModals />
      </div>
    </ChatRoomProvider>
  );
}
