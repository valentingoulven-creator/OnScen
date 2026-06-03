import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../lib/api';
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
import { getSocket } from '../lib/socket';
import type { ChatMessage, LiveChatReaction } from '../types';
import { LiveUserBanModal, type LiveBanScope } from './LiveUserBanModal';

interface ChatPanelProps {
  roomId: string;
  roomType: 'salon' | 'live';
  userId: string;
  userName: string;
  token?: string;
  initialMessages?: ChatMessage[];
  onPrivateMessage?: (target: { id: string; name: string }) => void;
  isHost?: boolean;
  canModerateChat?: boolean;
  hostId?: string;
  vipModeratorIds?: string[];
  onSetVip?: (userId: string, add: boolean) => void;
  onBanUser?: (userId: string, opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => void;
  onViewProfile?: (userId: string) => void;
  chatBanned?: boolean;
  chatBanMessage?: string;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
}

type FeedItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'reaction'; data: LiveChatReaction };

export function ChatPanel({
  roomId,
  roomType,
  userId,
  userName,
  token,
  initialMessages = [],
  onPrivateMessage,
  isHost = false,
  canModerateChat = false,
  hostId,
  vipModeratorIds = [],
  onSetVip,
  onBanUser,
  onViewProfile,
  chatBanned = false,
  chatBanMessage,
  onDeleteMessage,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<LiveChatReaction[]>([]);
  const [text, setText] = useState('');
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [userMenuTarget, setUserMenuTarget] = useState<{ id: string; name: string } | null>(null);
  const [banModalTarget, setBanModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [donCustomAmount, setDonCustomAmount] = useState('');
  const [reactionSending, setReactionSending] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reactionMenuRef = useRef<HTMLDivElement>(null);

  const liveReactionsEnabled = roomType === 'live' && Boolean(token);
  const boundRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (boundRoomIdRef.current === roomId) return;
    boundRoomIdRef.current = roomId;
    setMessages(initialMessages);
    setReactions([]);
    setOpenMsgMenuId(null);
  }, [roomId, initialMessages]);

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
    const event = roomType === 'salon' ? 'salon_message' : 'live_message';
    const deletedEvent = roomType === 'salon' ? 'salon_message_deleted' : 'live_message_deleted';

    const handler = (msg: ChatMessage) => {
      if (msg.roomId !== roomId) return;
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
      setReactions((prev) => appendLiveReaction(prev, giftToReaction(gift)));
    };

    socket.on(event, handler);
    socket.on(deletedEvent, onDeleted);
    if (liveReactionsEnabled) socket.on('gift_animation', onGiftAnimation);

    return () => {
      socket.off(event, handler);
      socket.off(deletedEvent, onDeleted);
      if (liveReactionsEnabled) socket.off('gift_animation', onGiftAnimation);
    };
  }, [roomType, roomId, liveReactionsEnabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, reactions]);

  useEffect(() => {
    if (!reactionMenuOpen && !userMenuTarget) return;
    const onPointerDown = (e: MouseEvent) => {
      if (reactionMenuRef.current?.contains(e.target as Node)) return;
      setReactionMenuOpen(false);
      setUserMenuTarget(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [reactionMenuOpen, userMenuTarget]);

  const feed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = messages.map((m) => ({ kind: 'message', data: m }));
    if (liveReactionsEnabled) {
      for (const r of reactions) items.push({ kind: 'reaction', data: r });
    }
    return items.sort((a, b) => {
      const ta = a.kind === 'message' ? a.data.timestamp : a.data.timestamp;
      const tb = b.kind === 'message' ? b.data.timestamp : b.data.timestamp;
      return ta - tb;
    });
  }, [messages, reactions, liveReactionsEnabled]);

  const deleteMessage = async (messageId: string, asModerator = false) => {
    if (!token) return;
    const confirmText = asModerator
      ? 'Supprimer ce message du chat public ?'
      : 'Supprimer ce message ?';
    if (!window.confirm(confirmText)) return;
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(messageId);
      } else {
        await api.deleteChatMessage(token, roomType, roomId, messageId);
      }
      setMessages((m) => m.filter((x) => x.id !== messageId));
      setOpenMsgMenuId(null);
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

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || chatBanned) return;
    const socket = getSocket();
    const content = text.trim();
    const payload = { salonId: roomId, liveId: roomId, senderId: userId, senderName: userName, content };
    if (roomType === 'salon') socket.emit('salon_message', payload);
    else socket.emit('live_message', payload);
    setText('');
  };

  const openUserMenu = (target: { id: string; name: string }) => {
    if (target.id === userId) return;
    setOpenMsgMenuId(null);
    setUserMenuTarget((prev) => (prev?.id === target.id ? null : target));
  };

  const confirmBan = (opts: { permanent: boolean; durationMs?: number; scope: LiveBanScope }) => {
    if (!banModalTarget || !onBanUser) return;
    onBanUser(banModalTarget.id, opts);
    setBanModalTarget(null);
    setUserMenuTarget(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className={`flex-1 overflow-y-auto min-h-0 space-y-3 ${
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
                <div className="inline-flex items-center gap-2 max-w-[95%] rounded-full px-3 py-1.5 bg-[#1a1a26]/90 border border-purple-800/30 text-xs">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-950/60 text-base leading-none"
                    aria-hidden
                  >
                    {emoji}
                  </span>
                  <span className="text-gray-300 min-w-0 truncate">
                    <span className="font-bold text-purple-400">{r.senderName}</span>{' '}
                    {reactionSummary(r)}
                    {count > 1 && <span className="text-purple-300 font-bold ml-1">×{count}</span>}
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
              (isHost && onSetVip) ||
              (canMod && onBanUser));
          const isTargetHost = hostId != null && m.senderId === hostId;
          const isTargetVip = vipModeratorIds.includes(m.senderId);
          const canHostActions = isHost && !isTargetHost && Boolean(onSetVip || onBanUser);
          const canBanTarget =
            canMod && !isTargetHost && Boolean(onBanUser) && (isHost || !isTargetVip);
          const canDeleteOwn = roomType !== 'live' && isMe && Boolean(token);
          const canDeleteAsMod = roomType === 'live' && canMod && Boolean(onDeleteMessage ?? token);
          const canDelete = canDeleteOwn || canDeleteAsMod;
          const menuOpen = openMsgMenuId === m.id;
          const userMenuOpen = userMenuTarget?.id === m.senderId;

          return (
            <div key={m.id} className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
              <div
                className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  isMe ? 'bg-purple-900/40 border border-purple-700/40' : 'bg-[#1a1a26] border border-[#2d2d3d]'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {canInteractUser ? (
                    <button
                      type="button"
                      onClick={() => openUserMenu({ id: m.senderId, name: m.senderName })}
                      className="text-xs font-bold text-purple-400 hover:text-purple-300 text-left"
                      title="Options utilisateur"
                    >
                      {m.senderName}
                      {isTargetVip && <span className="ml-1 text-amber-400 font-bold">VIP</span>}
                    </button>
                  ) : (
                    <p className="text-xs font-bold text-purple-400">
                      {m.senderName}
                      {isTargetVip && <span className="ml-1 text-amber-400 font-bold">VIP</span>}
                    </p>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuTarget(null);
                        setOpenMsgMenuId((id) => (id === m.id ? null : m.id));
                      }}
                      className="ml-auto text-gray-500 hover:text-white text-xs px-1"
                      aria-label="Options du message"
                    >
                      ⋮
                    </button>
                  )}
                </div>
                <p className="text-gray-200 whitespace-pre-wrap break-words">{m.content}</p>
                {userMenuOpen && canInteractUser && (
                  <div className="absolute left-0 top-full mt-1 z-30 min-w-[10rem] rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-xl overflow-hidden">
                    {onPrivateMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          onPrivateMessage({ id: m.senderId, name: m.senderName });
                          setUserMenuTarget(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-purple-900/30"
                      >
                        Message privé
                      </button>
                    )}
                    {onViewProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onViewProfile(m.senderId);
                          setUserMenuTarget(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-purple-900/30"
                      >
                        Voir le profil
                      </button>
                    )}
                    {canHostActions && onSetVip && !isTargetVip && (
                      <button
                        type="button"
                        onClick={() => {
                          onSetVip(m.senderId, true);
                          setUserMenuTarget(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-amber-300 hover:bg-amber-500/10"
                      >
                        Mettre VIP
                      </button>
                    )}
                    {canBanTarget && (
                      <button
                        type="button"
                        onClick={() => {
                          setBanModalTarget({ id: m.senderId, name: m.senderName });
                          setUserMenuTarget(null);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10"
                      >
                        Bannir
                      </button>
                    )}
                  </div>
                )}
                {menuOpen && canDelete && (
                  <div className="absolute right-2 top-full mt-1 z-20 min-w-[8.5rem] rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => deleteMessage(m.id, canDeleteAsMod)}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10"
                    >
                      {canDeleteAsMod ? 'Supprimer le message' : 'Supprimer'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {chatBanned && chatBanMessage && (
        <p className="px-3 py-2 text-xs text-red-400 text-center border-t border-red-500/20 bg-red-950/20" role="alert">
          {chatBanMessage}
        </p>
      )}

      <form
        onSubmit={send}
        className={`border-t border-[#1e1e2f] flex gap-2 items-center ${
          roomType === 'live' ? 'p-0 pb-0' : 'p-3'
        }`}
      >
        {liveReactionsEnabled && (
          <div className="relative shrink-0" ref={reactionMenuRef}>
            <button
              type="button"
              onClick={() => setReactionMenuOpen((o) => !o)}
              disabled={reactionSending}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] text-lg text-gray-300 hover:border-purple-500/50 hover:text-white transition disabled:opacity-50"
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
                      className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-left text-xs text-gray-200 hover:bg-purple-900/40 disabled:opacity-50"
                    >
                      <span className="text-base leading-none">{GIFT_EMOJI[type]}</span>
                      <span>{GIFT_LABELS_FR[type]}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#2d2d3d] px-2 py-2">
                  <p className="text-[10px] font-bold text-pink-300/90 mb-1.5 px-1">Don</p>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {LIVE_DON_TIERS.map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        disabled={reactionSending}
                        onClick={() => sendReaction('don', tier)}
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
                      disabled={reactionSending}
                      className="flex-1 min-w-0 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] px-2 py-1.5 text-[11px] text-white placeholder:text-gray-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={reactionSending}
                      onClick={() => {
                        const amount = parseDonAmount(donCustomAmount);
                        if (amount == null) {
                          setReactionError(donAmountValidationMessage());
                          return;
                        }
                        void sendReaction('don', amount);
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
          className="flex-1 min-w-0 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-4 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={chatBanned}
          className="shrink-0 px-4 py-2 bg-purple-600 rounded-full text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          →
        </button>
      </form>
      {banModalTarget && onBanUser && (
        <LiveUserBanModal
          username={banModalTarget.name}
          open
          onClose={() => setBanModalTarget(null)}
          onConfirm={confirmBan}
        />
      )}
      {reactionError && (
        <p
          className={`text-[10px] text-red-400 text-center ${
            roomType === 'live' ? 'px-3 pb-0' : 'px-3 pb-2'
          }`}
          role="alert"
        >
          {reactionError}
        </p>
      )}
    </div>
  );
}
