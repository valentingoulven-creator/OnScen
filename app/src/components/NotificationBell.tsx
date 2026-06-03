import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getActiveHostLiveId } from '../lib/liveHostContext';
import type { AppNotification, MusicMatch } from '../types';

function isVisibleNotification(n: AppNotification): boolean {
  return n.type === 'match' || n.type === 'live_started' || n.type === 'live_don';
}

function shouldShowToast(n: AppNotification): boolean {
  return n.type === 'match' || n.type === 'live_started' || n.type === 'live_don';
}

interface NotificationBellProps {
  onOpenLive?: (liveId: string) => void;
}

export function NotificationBell({ onOpenLive }: NotificationBellProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [matches, setMatches] = useState<MusicMatch[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api.getNotifications(token).then((r) => {
      const visible = r.notifications.filter(isVisibleNotification);
      setItems(visible);
      setUnread(r.unreadCount);
    });
    api.getMatches(token).then((r) => setMatches(r.matches));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    const onNotif = (n: AppNotification) => {
      if (!isVisibleNotification(n)) return;
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 50));
      setUnread((c) => c + 1);
      const skipDonToast = n.type === 'live_don' && n.liveId === getActiveHostLiveId();
      if (shouldShowToast(n) && !skipDonToast) {
        setToast(n);
        const toastMs =
          n.type === 'match' ? 5500 : n.type === 'live_started' ? 6000 : n.type === 'live_don' ? 5000 : 4000;
        window.setTimeout(() => setToast(null), toastMs);
      }
      if (n.type === 'match') load();
    };
    socket.on('notification', onNotif);
    return () => {
      socket.off('notification', onNotif);
    };
  }, [token, load]);

  const openPanel = () => {
    setOpen((v) => !v);
    if (!open && token) {
      api.markNotificationsRead(token).then(() => {
        setUnread(0);
        setItems((list) => list.map((n) => ({ ...n, read: true })));
      });
    }
  };

  const isMatchToast = toast?.type === 'match';
  const isLiveToast = toast?.type === 'live_started';
  const isDonToast = toast?.type === 'live_don';

  const openLiveFromNotif = (n: AppNotification) => {
    if ((n.type === 'live_started' || n.type === 'live_don') && n.liveId && onOpenLive) {
      onOpenLive(n.liveId);
      setOpen(false);
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed top-16 left-4 right-4 z-[60] mx-auto max-w-sm">
          <button
            type="button"
            onClick={() => openLiveFromNotif(toast)}
            disabled={(!isLiveToast && !isDonToast) || !toast.liveId || !onOpenLive}
            className={`w-full flex items-center gap-3 p-3 rounded-xl shadow-xl text-left ${
              isMatchToast
                ? 'bg-gradient-to-r from-pink-950/90 to-purple-950/90 border border-pink-400/50 animate-pulse'
                : isLiveToast
                  ? 'bg-gradient-to-r from-red-950/90 to-purple-950/90 border border-red-400/50'
                  : isDonToast
                    ? 'bg-gradient-to-r from-amber-950/90 to-pink-950/90 border border-amber-400/50'
                    : 'bg-[#1a1a26] border border-pink-500/40'
            } ${(isLiveToast || isDonToast) && toast.liveId && onOpenLive ? 'cursor-pointer active:scale-[0.99]' : ''}`}
          >
            <img
              src={toast.senderAvatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${toast.senderId}`}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  isMatchToast ? 'text-pink-200' : isLiveToast ? 'text-red-200' : isDonToast ? 'text-amber-200' : 'text-pink-300'
                }`}
              >
                {isMatchToast ? 'Nouveau match !' : isLiveToast ? 'En live !' : isDonToast ? 'Don reçu !' : 'Nouvelle notification'}
              </p>
              <p className="text-xs text-gray-300 truncate">{toast.message}</p>
            </div>
            <span className="text-2xl">{isMatchToast ? '💞' : isLiveToast ? '🔴' : isDonToast ? '💝' : '♥'}</span>
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
                      <span className="text-xs text-white font-semibold truncate">
                        {m.otherUser.username}
                      </span>
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
                  onClick={() => openLiveFromNotif(n)}
                  disabled={(n.type !== 'live_started' && n.type !== 'live_don') || !n.liveId || !onOpenLive}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e2f]/50 text-left ${
                    !n.read
                      ? n.type === 'match'
                        ? 'bg-purple-950/30'
                        : n.type === 'live_started'
                          ? 'bg-red-950/25'
                          : n.type === 'live_don'
                            ? 'bg-pink-950/25'
                            : 'bg-pink-950/20'
                      : ''
                  } ${
                    (n.type === 'live_started' || n.type === 'live_don') && n.liveId && onOpenLive
                      ? n.type === 'live_don'
                        ? 'hover:bg-pink-950/20 cursor-pointer'
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
                  <span
                    className={
                      n.type === 'match'
                        ? 'text-pink-300'
                        : n.type === 'live_started'
                          ? 'text-red-400'
                          : n.type === 'live_don'
                            ? 'text-pink-400'
                            : 'text-pink-400'
                    }
                  >
                    {n.type === 'match' ? '💞' : n.type === 'live_started' ? '🔴' : n.type === 'live_don' ? '💝' : '♥'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
