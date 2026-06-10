import { useEffect, useRef } from 'react';
import { getSocket, onSocketConnect } from '../lib/socket';

export type SalonForcedEndReason = 'denied' | 'kicked' | 'banned' | 'ended';

/** Explicit socket leave — only for voluntary quit or forced session end. */
export function emitLeaveSalon(salonId: string): void {
  try {
    getSocket().emit('leave_salon', { salonId });
  } catch {
    /* socket not ready */
  }
}

/**
 * Single app-level salon socket membership.
 * Join/rejoin on reconnect; never leave_salon on effect cleanup (UI unmount must not drop membership).
 */
export function useSalonSocketMembership(
  salonId: string | null,
  user: { id: string; username: string } | null,
  onForcedEnd: (reason: SalonForcedEndReason) => void
): void {
  const onForcedEndRef = useRef(onForcedEnd);
  onForcedEndRef.current = onForcedEnd;
  const joinedSalonIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!salonId || !user) return;

    const socket = getSocket();
    const joinSalon = () => {
      socket.emit('join_salon', {
        salonId,
        userId: user.id,
        username: user.username,
      });
    };

    if (joinedSalonIdRef.current && joinedSalonIdRef.current !== salonId) {
      emitLeaveSalon(joinedSalonIdRef.current);
    }
    joinedSalonIdRef.current = salonId;
    joinSalon();

    const onDenied = ({ salonId: deniedId }: { salonId: string }) => {
      if (deniedId === salonId) onForcedEndRef.current('denied');
    };
    const onKicked = ({ salonId: kickedId }: { salonId: string }) => {
      if (kickedId === salonId) onForcedEndRef.current('kicked');
    };
    const onBanned = ({ salonId: bannedId }: { salonId: string }) => {
      if (bannedId === salonId) onForcedEndRef.current('banned');
    };
    const onEnded = (payload: { salonId: string; reason: string }) => {
      if (payload.salonId === salonId) onForcedEndRef.current('ended');
    };

    socket.on('salon_join_denied', onDenied);
    socket.on('salon_kicked', onKicked);
    socket.on('salon_banned', onBanned);
    socket.on('salon_ended', onEnded);
    const offReconnect = onSocketConnect(joinSalon);

    return () => {
      offReconnect();
      socket.off('salon_join_denied', onDenied);
      socket.off('salon_kicked', onKicked);
      socket.off('salon_banned', onBanned);
      socket.off('salon_ended', onEnded);
      // Intentionally no leave_salon — membership survives SalonPage/HomePage unmount.
    };
  }, [salonId, user?.id, user?.username]);

  useEffect(() => {
    if (salonId) return;
    if (joinedSalonIdRef.current) {
      joinedSalonIdRef.current = null;
    }
  }, [salonId]);
}
