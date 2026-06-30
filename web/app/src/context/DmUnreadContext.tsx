import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { requestDmNotificationPermission, showDmSystemNotification } from '../lib/dmNotifications';
import { shouldAlertForIncomingDm } from '../lib/dmMuteAlerts';
import type { DirectMessage, GroupMessage } from '../types';

export interface DmIncomingToast {
  id: string;
  senderId: string;
  senderName: string;
  preview: string;
  groupId?: string;
  groupName?: string;
}

interface DmUnreadContextValue {
  unreadCount: number;
  incomingToast: DmIncomingToast | null;
  mutedPeerIds: Set<string>;
  refreshUnread: () => void;
  refreshMuted: () => void;
  isPeerMuted: (userId: string) => boolean;
  setActivePeer: (userId: string | null) => void;
  setActiveGroup: (groupId: string | null) => void;
  setDmTabActive: (active: boolean) => void;
  dismissToast: () => void;
}

const DmUnreadContext = createContext<DmUnreadContextValue | null>(null);

export function DmUnreadProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [incomingToast, setIncomingToast] = useState<DmIncomingToast | null>(null);
  const [mutedPeerIds, setMutedPeerIds] = useState<Set<string>>(new Set());
  const activePeerRef = useRef<string | null>(null);
  const activeGroupRef = useRef<string | null>(null);
  const dmTabActiveRef = useRef(false);
  const seenDmIdsRef = useRef<Set<string>>(new Set());
  const mutedPeerIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  const refreshUnread = useCallback(() => {
    if (!token) return;
    api.getDmUnreadCount(token).then((r) => setUnreadCount(r.unreadCount));
  }, [token]);

  const refreshMuted = useCallback(() => {
    if (!token) return;
    api.getMutedUserIds(token).then((r) => {
      const next = new Set(r.mutedUserIds);
      mutedPeerIdsRef.current = next;
      // Bail out when the muted-IDs set is identical to avoid a spurious context
      // re-render that would cascade to all useDmUnread() consumers (#185).
      setMutedPeerIds((prev) => {
        if (prev.size === next.size && r.mutedUserIds.every((id) => prev.has(id))) return prev;
        return next;
      });
    });
  }, [token]);

  const isPeerMuted = useCallback((userId: string) => mutedPeerIdsRef.current.has(userId), []);

  const setActivePeer = useCallback((userId: string | null) => {
    activePeerRef.current = userId;
    if (userId) activeGroupRef.current = null;
  }, []);

  const setActiveGroup = useCallback((groupId: string | null) => {
    activeGroupRef.current = groupId;
    if (groupId) activePeerRef.current = null;
  }, []);

  const setDmTabActive = useCallback((active: boolean) => {
    dmTabActiveRef.current = active;
  }, []);

  const dismissToast = useCallback(() => setIncomingToast(null), []);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      mutedPeerIdsRef.current = new Set();
      setMutedPeerIds(new Set());
      return;
    }
    requestDmNotificationPermission();
    refreshUnread();
    refreshMuted();
  }, [token, refreshUnread, refreshMuted]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket();
    if (!socket) return;

    const onDm = (msg: DirectMessage) => {
      if (msg.receiverId !== user.id) return;
      if (seenDmIdsRef.current.has(msg.id)) return;
      seenDmIdsRef.current.add(msg.id);
      if (seenDmIdsRef.current.size > 200) {
        const kept = [...seenDmIdsRef.current].slice(-100);
        seenDmIdsRef.current = new Set(kept);
      }
      const senderId = msg.senderId;
      const inOpenThread =
        dmTabActiveRef.current && activePeerRef.current === senderId;
      if (inOpenThread) {
        void api.markDmThreadRead(token, senderId, msg.timestamp).then(() => refreshUnread());
        return;
      }
      if (
        !shouldAlertForIncomingDm(mutedPeerIdsRef.current, senderId, false)
      ) {
        return;
      }
      setUnreadCount((c) => c + 1);
      const senderName =
        (msg as DirectMessage & { senderName?: string }).senderName ?? 'Nouveau message';
      setIncomingToast({
        id: msg.id,
        senderId,
        senderName,
        preview: msg.content,
      });
      showDmSystemNotification(senderName, msg.content);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        setIncomingToast(null);
      }, 5000);
    };

    const onGroupMessage = (msg: GroupMessage) => {
      if (msg.senderId === user.id) return;
      if (seenDmIdsRef.current.has(msg.id)) return;
      seenDmIdsRef.current.add(msg.id);
      if (seenDmIdsRef.current.size > 200) {
        const kept = [...seenDmIdsRef.current].slice(-100);
        seenDmIdsRef.current = new Set(kept);
      }
      const inOpenGroup =
        dmTabActiveRef.current && activeGroupRef.current === msg.groupId;
      if (inOpenGroup) {
        void api.markGroupThreadRead(token, msg.groupId, msg.timestamp).then(() => refreshUnread());
        return;
      }
      if (!shouldAlertForIncomingDm(mutedPeerIdsRef.current, msg.senderId, false)) {
        return;
      }
      setUnreadCount((c) => c + 1);
      const senderName = msg.senderName ?? 'Nouveau message';
      const groupName = msg.groupName ?? 'Groupe';
      setIncomingToast({
        id: msg.id,
        senderId: msg.senderId,
        senderName: `${groupName} — ${senderName}`,
        preview: msg.content,
        groupId: msg.groupId,
        groupName,
      });
      showDmSystemNotification(`${groupName} — ${senderName}`, msg.content);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        setIncomingToast(null);
      }, 5000);
    };

    const onUnread = (payload: { unreadCount: number }) => {
      if (typeof payload?.unreadCount === 'number') setUnreadCount(payload.unreadCount);
    };

    socket.on('dm', onDm);
    socket.on('group_message', onGroupMessage);
    socket.on('dm_unread', onUnread);
    return () => {
      socket.off('dm', onDm);
      socket.off('group_message', onGroupMessage);
      socket.off('dm_unread', onUnread);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [token, user, refreshUnread]);

  // Memoize the context value so that consumers only re-render when a value they
  // actually care about changes, not on every DmUnreadProvider render (#185).
  const contextValue = useMemo<DmUnreadContextValue>(
    () => ({
      unreadCount,
      incomingToast,
      mutedPeerIds,
      refreshUnread,
      refreshMuted,
      isPeerMuted,
      setActivePeer,
      setActiveGroup,
      setDmTabActive,
      dismissToast,
    }),
    [
      unreadCount,
      incomingToast,
      mutedPeerIds,
      refreshUnread,
      refreshMuted,
      isPeerMuted,
      setActivePeer,
      setActiveGroup,
      setDmTabActive,
      dismissToast,
    ]
  );

  return (
    <DmUnreadContext.Provider value={contextValue}>
      {children}
    </DmUnreadContext.Provider>
  );
}

export function useDmUnread(): DmUnreadContextValue {
  const ctx = useContext(DmUnreadContext);
  if (!ctx) throw new Error('useDmUnread must be used within DmUnreadProvider');
  return ctx;
}
