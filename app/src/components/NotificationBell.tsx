import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getActiveHostLiveId } from '../lib/liveHostContext';
import { showMatchSystemNotification } from '../lib/dmNotifications';
import { UsernameDisplay } from './UsernameDisplay';
import type { AppNotification, MusicMatch } from '../types';

function isVisibleNotification(n: AppNotification): boolean {
  return (
    n.type === 'match' ||
    n.type === 'live_started' ||
    n.type === 'live_don' ||
    n.type === 'favorite_online' ||
    n.type === 'dm_message' ||
    n.type === 'group_message' ||
    n.type === 'heart' ||
    n.type === 'content_heart' ||
    n.type === 'follow' ||
    n.type === 'event_created' ||
    n.type === 'mention'
  );
}

function shouldShowToast(n: AppNotification): boolean {
  return (
    n.type === 'match' ||
    n.type === 'live_started' ||
    n.type === 'live_don' ||
    n.type === 'favorite_online' ||
    n.type === 'heart' ||
    n.type === 'content_heart' ||
    n.type === 'follow' ||
    n.type === 'event_created' ||
    n.type === 'mention'
  );
}

function opensProfileFromNotification(n: AppNotification): boolean {
  return (
    n.type === 'match' ||
    n.type === 'heart' ||
    n.type === 'content_heart' ||
    n.type === 'follow' ||
    n.type === 'event_created' ||
    n.type === 'mention'
  );
}

const NOTIF_VIEWED_LS_PREFIX = 'soundy:notifications-viewed:';

function notifViewedLsKey(userId: string): string {
  return `${NOTIF_VIEWED_LS_PREFIX}${userId}`;
}

function countVisibleUnread(notifications: AppNotification[]): number {
  return notifications.filter((n) => isVisibleNotification(n) && !n.read).length;
}

function notificationEmoji(n: AppNotification): string {
  switch (n.type) {
    case 'match':
      return '💞';
    case 'heart':
      return '💜';
    case 'content_heart':
      return '❤️';
    case 'follow':
      return '👤';
    case 'event_created':
      return '📅';
    case 'live_started':
      return '🔴';
    case 'live_don':
      return '💝';
    case 'favorite_online':
      return '⭐';
    case 'mention':
      return '📣';
    case 'group_message':
      return '👥';
    case 'dm_message':
      return '💬';
    default:
      return '♥';
  }
}

interface NotificationBellProps {
  onOpenLive?: (liveId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenDm?: (peerUserId: string) => void;
  onOpenGroup?: (groupId: string) => void;
}

export function NotificationBell({ onOpenLive, onOpenProfile, onOpenSalon, onOpenDm, onOpenGroup }: NotificationBellProps) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [matches, setMatches] = useState<MusicMatch[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const markedReadRef = useRef(false);

  const clearViewedLocalFlag = useCallback(() => {
    if (!user?.id) return;
    try {
      localStorage.removeItem(notifViewedLsKey(user.id));
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const setViewedLocalFlag = useCallback(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(notifViewedLsKey(user.id), '1');
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const hasViewedLocalFlag = useCallback((): boolean => {
    if (!user?.id) return false;
    try {
      return localStorage.getItem(notifViewedLsKey(user.id)) === '1';
    } catch {
      return false;
    }
  }, [user?.id]);

  const markAllAsRead = useCallback(() => {
    if (!token) return;
    markedReadRef.current = true;
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setViewedLocalFlag();
    void api.markNotificationsRead(token).catch(() => {
      markedReadRef.current = false;
      clearViewedLocalFlag();
    });
  }, [token, setViewedLocalFlag, clearViewedLocalFlag]);

  const load = useCallback(() => {
    if (!token) return;
    api.getNotifications(token).then((r) => {
      const visible = r.notifications.filter(isVisibleNotification);
      setItems(visible);
      const unreadFromServer = countVisibleUnread(visible);
      if (markedReadRef.current) {
        setUnread(0);
        return;
      }
      if (hasViewedLocalFlag() && unreadFromServer > 0) {
        markAllAsRead();
        return;
      }
      setUnread(unreadFromServer);
    });
    api.getMatches(token).then((r) => setMatches(r.matches));
  }, [token, hasViewedLocalFlag, markAllAsRead]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (open && token) {
      markAllAsRead();
    }
  }, [open, token, markAllAsRead]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;
    const onNotif = (n: AppNotification) => {
      if (!isVisibleNotification(n)) return;
      markedReadRef.current = false;
      clearViewedLocalFlag();
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 50));
      setUnread((c) => c + 1);
      const skipDonToast = n.type === 'live_don' && n.liveId === getActiveHostLiveId();
      if (shouldShowToast(n) && !skipDonToast) {
        setToast(n);
        if (n.type === 'match') {
          showMatchSystemNotification(n.senderName);
        }
        const toastMs =
          n.type === 'match'
            ? 5500
            : n.type === 'heart' || n.type === 'content_heart'
              ? 5000
              : n.type === 'follow'
                ? 4500
                : n.type === 'event_created'
                  ? 5500
                  : n.type === 'live_started'
                    ? 6000
                    : n.type === 'live_don'
                      ? 5000
                      : n.type === 'favorite_online'
                        ? 5500
                        : 4000;
        window.setTimeout(() => setToast(null), toastMs);
      }
      if (n.type === 'match') load();
    };
    socket.on('notification', onNotif);
    return () => {
      socket.off('notification', onNotif);
    };
  }, [token, load, clearViewedLocalFlag]);

  const openPanel = () => setOpen((v) => !v);

  const isMatchToast = toast?.type === 'match';
  const isLiveToast = toast?.type === 'live_started';
  const isDonToast = toast?.type === 'live_don';
  const isFavToast = toast?.type === 'favorite_online';
  const isDmToast = toast?.type === 'dm_message';
  const isGroupToast = toast?.type === 'group_message';
  const isHeartToast = toast?.type === 'heart';
  const isContentHeartToast = toast?.type === 'content_heart';
  const isFollowToast = toast?.type === 'follow';
  const isEventCreatedToast = toast?.type === 'event_created';
  const isMentionToast = toast?.type === 'mention';
  const isMessageToast = isDmToast || isGroupToast;

  const openFromNotif = (n: AppNotification) => {
    if (n.type === 'group_message' && n.groupId && onOpenGroup) {
      onOpenGroup(n.groupId);
      setToast(null);
      setOpen(false);
      return;
    }
    if (n.type === 'dm_message' && onOpenDm) {
      const peerId = n.peerUserId ?? n.senderId;
      onOpenDm(peerId);
      setToast(null);
      setOpen(false);
      return;
    }
    if (opensProfileFromNotification(n) && onOpenProfile) {
      onOpenProfile(n.peerUserId ?? n.senderId);
      setToast(null);
      setOpen(false);
      return;
    }
    if ((n.type === 'live_started' || n.type === 'live_don') && n.liveId && onOpenLive) {
      onOpenLive(n.liveId);
      setOpen(false);
      return;
    }
    if (n.type === 'favorite_online') {
      if (n.salonId && onOpenSalon) {
        onOpenSalon(n.salonId);
        setToast(null);
        setOpen(false);
      } else if (n.liveId && onOpenLive) {
        onOpenLive(n.liveId);
        setToast(null);
        setOpen(false);
      } else if (onOpenProfile) {
        onOpenProfile(n.senderId);
        setToast(null);
        setOpen(false);
      }
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed top-16 left-4 right-4 z-[60] mx-auto max-w-sm">
          <button
            type="button"
            onClick={() => openFromNotif(toast)}
            disabled={
              isMessageToast
                ? isGroupToast
                  ? !onOpenGroup
                  : !onOpenDm
                : isMatchToast || isHeartToast || isContentHeartToast || isFollowToast || isEventCreatedToast || isMentionToast
                  ? !onOpenProfile
                  : (!isLiveToast && !isDonToast) || !toast.liveId || !onOpenLive
            }
            className={`w-full flex items-center gap-3 p-3 rounded-xl shadow-xl text-left ${
              isMatchToast
                ? 'bg-gradient-to-r from-pink-950/90 to-purple-950/90 border border-pink-400/50 animate-pulse'
                : isHeartToast || isContentHeartToast
                  ? 'bg-gradient-to-r from-pink-950/90 to-rose-950/90 border border-pink-500/50'
                  : isFollowToast
                    ? 'bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border border-indigo-400/50'
                    : isEventCreatedToast
                      ? 'bg-gradient-to-r from-emerald-950/90 to-purple-950/90 border border-emerald-400/50'
                      : isLiveToast
                        ? 'bg-gradient-to-r from-red-950/90 to-purple-950/90 border border-red-400/50'
                        : isDonToast
                          ? 'bg-gradient-to-r from-amber-950/90 to-pink-950/90 border border-amber-400/50'
                          : isFavToast
                            ? 'bg-gradient-to-r from-yellow-950/90 to-purple-950/90 border border-yellow-500/50'
                            : isMentionToast
                              ? 'bg-gradient-to-r from-cyan-950/90 to-purple-950/90 border border-cyan-400/50'
                              : isMessageToast
                                ? 'bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border border-purple-400/50'
                                : 'bg-[#1a1a26] border border-pink-500/40'
            } ${
              (isDmToast && onOpenDm) ||
              (isGroupToast && onOpenGroup) ||
              ((isMatchToast || isHeartToast || isContentHeartToast || isFollowToast || isEventCreatedToast || isMentionToast) &&
                onOpenProfile) ||
              ((isLiveToast || isDonToast) && toast.liveId && onOpenLive) ||
              (isFavToast && (toast.salonId || toast.liveId || onOpenProfile))
                ? 'cursor-pointer active:scale-[0.99]'
                : ''
            }`}
          >
            <img
              src={toast.senderAvatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${toast.senderId}`}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  isMatchToast
                    ? 'text-pink-200'
                    : isHeartToast || isContentHeartToast
                      ? 'text-pink-300'
                      : isFollowToast
                        ? 'text-indigo-200'
                        : isEventCreatedToast
                          ? 'text-emerald-200'
                          : isLiveToast
                            ? 'text-red-200'
                            : isDonToast
                              ? 'text-amber-200'
                              : isFavToast
                                ? 'text-yellow-200'
                                : isMentionToast
                                  ? 'text-cyan-300'
                                  : 'text-pink-300'
                }`}
              >
                {isMatchToast
                  ? 'Nouveau match !'
                  : isHeartToast
                    ? 'Cœur reçu !'
                    : isContentHeartToast
                      ? 'Like reçu !'
                      : isFollowToast
                        ? 'Nouvel abonné !'
                        : isEventCreatedToast
                          ? 'Nouvel événement !'
                          : isLiveToast
                            ? 'En live !'
                            : isDonToast
                              ? 'Don reçu !'
                              : isFavToast
                                ? 'Favori en ligne !'
                                : isMentionToast
                                  ? 'Vous avez été mentionné !'
                                  : isMessageToast
                                    ? isGroupToast
                                      ? 'Message de groupe'
                                      : 'Nouveau message'
                                    : 'Nouvelle notification'}
              </p>
              <p className="text-xs text-gray-300 truncate">{toast.message}</p>
            </div>
            <span className="text-2xl">
              {isMatchToast
                ? '💞'
                : isHeartToast
                  ? '💜'
                  : isContentHeartToast
                    ? '❤️'
                    : isFollowToast
                      ? '👤'
                      : isEventCreatedToast
                        ? '📅'
                        : isLiveToast
                          ? '🔴'
                          : isDonToast
                            ? '💝'
                            : isFavToast
                              ? '⭐'
                              : isMentionToast
                                ? '📣'
                                : isGroupToast
                                  ? '👥'
                                  : isDmToast
                                    ? '💬'
                                    : '♥'}
            </span>
          </button>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={openPanel}
          className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] text-gray-300 hover:text-white"
          aria-label="Notifications"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5M9 17v1a3 3 0 0 0 6 0v-1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-pink-600 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              aria-label="Fermer les notifications"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-50 w-72 max-h-96 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-2xl">
              {matches.length > 0 && (
                <div className="border-b border-[#1e1e2f]">
                  <p className="px-3 py-2 text-xs font-bold text-pink-400">Mes matchs ({matches.length})</p>
                  {matches.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                      <img
                        src={
                          m.otherUser.avatarUrl ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.otherUser.id}`
                        }
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <UsernameDisplay
                        username={m.otherUser.username}
                        usernameColor={m.otherUser.usernameColor}
                        usernameWaveFrom={m.otherUser.usernameWaveFrom}
                        usernameWaveTo={m.otherUser.usernameWaveTo}
                        className="text-xs font-semibold truncate"
                      />
                      <span className="ml-auto text-sm">💞</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="px-3 py-2 text-xs font-bold text-gray-400 border-b border-[#1e1e2f]">
                Notifications
              </p>
              {items.length === 0 && (
                <p className="p-4 text-center text-xs text-gray-500">Aucune notification</p>
              )}
              {items.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => openFromNotif(n)}
                  disabled={
                    n.type === 'group_message'
                      ? !onOpenGroup
                      : n.type === 'dm_message'
                        ? !onOpenDm
                        : opensProfileFromNotification(n)
                          ? !onOpenProfile
                          : n.type === 'favorite_online'
                            ? !(n.salonId || n.liveId || onOpenProfile)
                            : (n.type !== 'live_started' && n.type !== 'live_don') || !n.liveId || !onOpenLive
                  }
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2f]/50 text-left ${
                    !n.read
                      ? n.type === 'match'
                        ? 'bg-purple-950/30'
                        : n.type === 'heart' || n.type === 'content_heart'
                          ? 'bg-pink-950/30'
                          : n.type === 'follow'
                            ? 'bg-indigo-950/25'
                            : n.type === 'event_created'
                              ? 'bg-emerald-950/20'
                              : n.type === 'live_started'
                                ? 'bg-red-950/25'
                                : n.type === 'live_don'
                                  ? 'bg-pink-950/25'
                                  : n.type === 'favorite_online'
                                    ? 'bg-yellow-950/20'
                                    : n.type === 'mention'
                                      ? 'bg-cyan-950/20'
                                      : n.type === 'dm_message' || n.type === 'group_message'
                                        ? 'bg-purple-950/25'
                                        : 'bg-pink-950/20'
                      : ''
                  } ${
                    (n.type === 'dm_message' && onOpenDm) ||
                    (n.type === 'group_message' && onOpenGroup) ||
                    (opensProfileFromNotification(n) && onOpenProfile) ||
                    ((n.type === 'live_started' || n.type === 'live_don') && n.liveId && onOpenLive) ||
                    (n.type === 'favorite_online' && (n.salonId || n.liveId || onOpenProfile))
                      ? n.type === 'match'
                        ? 'hover:bg-purple-950/30 cursor-pointer'
                        : n.type === 'heart' || n.type === 'content_heart'
                          ? 'hover:bg-pink-950/30 cursor-pointer'
                          : n.type === 'follow'
                            ? 'hover:bg-indigo-950/25 cursor-pointer'
                            : n.type === 'event_created'
                              ? 'hover:bg-emerald-950/20 cursor-pointer'
                              : n.type === 'live_don'
                                ? 'hover:bg-pink-950/20 cursor-pointer'
                                : n.type === 'favorite_online'
                                  ? 'hover:bg-yellow-950/20 cursor-pointer'
                                  : n.type === 'mention'
                                    ? 'hover:bg-cyan-950/20 cursor-pointer'
                                    : n.type === 'dm_message' || n.type === 'group_message'
                                      ? 'hover:bg-purple-950/25 cursor-pointer'
                                      : 'hover:bg-red-950/20 cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  <img
                    src={n.senderAvatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${n.senderId}`}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-200 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(n.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-base">{notificationEmoji(n)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
